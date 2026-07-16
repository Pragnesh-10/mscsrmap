'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import { sendRegistrationEmail, sendTeamJoinNotificationEmail } from '@/utils/resend'
import { validateEmail } from '@/utils/security'

export async function submitPublicRegistration(eventId: string, formData: any) {
  eventId = typeof eventId === 'string' ? eventId.trim() : ''

  const supabase = createAdminClient()

  const leadEmail = formData.email?.toLowerCase().trim()

  if (!leadEmail || !validateEmail(leadEmail)) {
    return { error: 'A valid email is required to register.' }
  }

  // Validate all team member emails
  if (formData.teamMembers && Array.isArray(formData.teamMembers)) {
    for (const member of formData.teamMembers) {
      if (member.email) {
        member.email = member.email.toLowerCase().trim()
        if (!validateEmail(member.email)) {
          return { error: `Invalid email address format for team member: ${member.fullName || member.email}` }
        }
      }
    }
  }

  // 1. Separate form_data and team_data
  const teamMembers = formData.teamMembers || []
  const teamLeadIndex = formData.teamLeadIndex !== undefined ? formData.teamLeadIndex : -1
  
  // 2. Validate Uniqueness (Check if ANY email is already registered for this event)
  const allIncomingEmails = [leadEmail, ...teamMembers.map((m: any) => m.email?.toLowerCase().trim())]
  
  // Check for duplicates within their own form submission
  const uniqueIncomingEmails = new Set(allIncomingEmails)
  if (uniqueIncomingEmails.size !== allIncomingEmails.length) {
    return { error: 'Duplicate emails found within your team. Each member must have a unique email address.' }
  }

  // 3. Fetch Event Requirements for Backend Domain Validation
  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .select('title, date_start, location, form_requirements, max_capacity')
    .eq('id', eventId)
    .single()

  if (eventError || !eventData) {
    return { error: 'Event not found.' }
  }

  const reqs = eventData.form_requirements || {}

  // Validate payment for paid events
  if (reqs.event_pricing === 'paid') {
    if (!formData.payment_data?.razorpay_payment_id) {
      return { error: 'Payment is required for this event. Please complete the payment first.' }
    }
  }

  if (!reqs.allow_external_students) {
    for (const email of allIncomingEmails) {
      if (email && !email.toLowerCase().endsWith('@srmap.edu.in')) {
        return { error: 'All team members must use @srmap.edu.in email addresses for this event.' }
      }
    }
  }

  // Validate Team Name uniqueness for this event
  if (formData.teamName) {
    const { data: existingTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('event_id', eventId)
      .ilike('team_name', formData.teamName)
      .limit(1)
      
    if (existingTeam && existingTeam.length > 0) {
      return { error: 'This team name is already taken for this event. Please choose another one.' }
    }
  }

  // Fetch all existing registrations for this event to check against
  const { data: existingRegs } = await supabase
    .from('registrations')
    .select('lead_email, team_data, status')
    .eq('event_id', eventId)

  if (existingRegs) {
    for (const reg of existingRegs) {
      const registeredEmails = [reg.lead_email?.toLowerCase().trim()]
      if (reg.team_data?.members) {
        reg.team_data.members.forEach((m: any) => {
          if (m.email) registeredEmails.push(m.email.toLowerCase().trim())
        })
      }

      // Check if any incoming email matches an already registered email
      for (const email of allIncomingEmails) {
        if (registeredEmails.includes(email)) {
          return { error: `The email ${email} is already registered for this event! A student cannot join multiple teams.` }
        }
      }
    }
  }

  // 3. Capacity Check
  const incomingCount = 1 + teamMembers.length
  let currentConfirmedCount = 0
  
  if (eventData.max_capacity) {
    existingRegs?.forEach(reg => {
      if (reg.status === 'confirmed') {
        currentConfirmedCount += 1 + (reg.team_data?.members?.length || 0)
      }
    })
  }

  const assignedStatus = (eventData.max_capacity && (currentConfirmedCount + incomingCount > eventData.max_capacity))
    ? 'waitlisted'
    : 'confirmed'

  // 4. Generate secure hash payload using lead_email + eventId + timestamp
  const message = `${leadEmail}${eventId}${new Date().toISOString()}`
  const hashPayload = crypto.createHash('sha256').update(message).digest('hex')

  // 5. Remove team-specific arrays from the base form data
  const baseFormData = { ...formData }
  delete baseFormData.teamMembers
  delete baseFormData.teamLeadIndex
  delete baseFormData.teamName
  // payment_data stays in baseFormData for record-keeping

  // 6. Insert into Supabase registrations table
  const { data: insertedData, error } = await supabase
    .from('registrations')
    .insert([{
      event_id: eventId,
      lead_email: leadEmail,
      form_data: baseFormData,
      team_data: (teamMembers.length > 0 || formData.teamName) ? { members: teamMembers, leadIndex: teamLeadIndex, teamName: formData.teamName } : null,
      hash_payload: hashPayload,
      status: assignedStatus
    }])
    .select('*')
    .single()

  if (error) {
    // 23505 is PostgreSQL code for unique_violation, but we removed the strict constraint on user_id+event_id.
    // However, if we added a constraint on lead_email + event_id, this would catch it.
    if (error.code === '23505') {
      return { error: 'This email is already registered for this event!' }
    }
    return { error: error.message }
  }

  // 7. Team Creation Hook: If they registered a team, create a team row for invite links
  let createdTeamId = null
  if (formData.teamName) {
    const leaderFullName = baseFormData.fullName || ''
    const leaderEmail = leadEmail
    const leaderBranch = baseFormData.branch || ''
    const leaderYear = baseFormData.year || ''

    const computedMaxTeamSize = formData.maxTeamSize ? Math.min(formData.maxTeamSize, eventData.form_requirements?.max_team_size || 4) : (eventData.form_requirements?.max_team_size || 4);
    const initialMemberCount = 1 + (baseFormData.teamMembers ? baseFormData.teamMembers.length : 0);
    const isActuallyLooking = !!formData.lookingForMembers && (initialMemberCount < computedMaxTeamSize);

    const { data: newTeam } = await supabase.from('teams').insert([{
      registration_id: insertedData.id,
      event_id: eventId,
      team_name: formData.teamName,
      max_team_size: computedMaxTeamSize,
      looking_for_members: isActuallyLooking,
      leader_name: leaderFullName,
      leader_email: leaderEmail,
      leader_branch: leaderBranch,
      leader_year: leaderYear
    }]).select('id').single()

    if (newTeam) createdTeamId = newTeam.id
  }

  // Email confirmations are disabled per user request
  // (Previously sent emails via Resend here)

  // 8. Revalidate cache so the UI updates
  revalidatePath('/events', 'layout')

  return { 
    success: true, 
    hash_payload: hashPayload, 
    registration: insertedData,
    isWaitlisted: assignedStatus === 'waitlisted',
    team_id: createdTeamId
  }
}

export async function lookupTeamRegistration(eventId: string, email: string) {
  eventId = typeof eventId === 'string' ? eventId.trim() : ''
  email = typeof email === 'string' ? email.toLowerCase().trim() : ''

  if (!email || !validateEmail(email)) {
    return { error: 'A valid email is required to look up registration.' }
  }

  const supabase = createAdminClient()

  // First check if they are the primary registrant
  const { data: primaryReg } = await supabase
    .from('registrations')
    .select('*')
    .eq('event_id', eventId)
    .eq('lead_email', email)
    .single()

  if (primaryReg) {
    return { success: true, hash_payload: primaryReg.hash_payload, registration: primaryReg }
  }

  // If not primary, search through the team_data arrays
  const { data: allRegs } = await supabase
    .from('registrations')
    .select('*')
    .eq('event_id', eventId)

  if (allRegs) {
    for (const reg of allRegs) {
      if (reg.team_data && reg.team_data.members) {
        for (const member of reg.team_data.members) {
          if (member.email && member.email.toLowerCase().trim() === email.toLowerCase().trim()) {
            return { success: true, hash_payload: reg.hash_payload, registration: reg }
          }
        }
      }
    }
  }

  return { error: "No registration found for that email address. Make sure you entered the correct email used during registration." }
}

export async function joinMatchmakingTeam(teamId: string, memberData: any) {
  teamId = typeof teamId === 'string' ? teamId.trim() : ''

  const email = memberData.email?.toLowerCase().trim()
  if (!email || !validateEmail(email)) {
    return { error: 'A valid email is required to join a team.' }
  }
  memberData.email = email

  const supabase = createAdminClient()

  // 1. Fetch the matchmaking team to get the registration link
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('registration_id, max_team_size, looking_for_members, leader_email, leader_name, team_name')
    .eq('id', teamId)
    .single()

  if (teamError || !team) {
    return { error: 'Team not found.' }
  }

  // 2. Fetch the actual registration data
  const { data: reg, error: regError } = await supabase
    .from('registrations')
    .select(`
      id,
      status,
      team_data,
      hash_payload,
      event_id,
      events ( title, date_start, location )
    `)
    .eq('id', team.registration_id)
    .single()

  if (regError || !reg) {
    return { error: 'Registration not found for this team.' }
  }

  // 3. Prevent duplicate emails within the team
  const existingMembers = reg.team_data?.members || []
  for (const member of existingMembers) {
    if (member.email?.toLowerCase().trim() === memberData.email?.toLowerCase().trim()) {
      return { error: 'You are already registered on this team!' }
    }
  }

  // 6. Check Capacity
  if (existingMembers.length + 1 >= team.max_team_size) {
    return { error: 'This team is already at maximum capacity.' }
  }

  // 7. Append the new member
  const newMembers = [...existingMembers, memberData]
  const newTeamData = {
    ...reg.team_data,
    members: newMembers
  }

  // 8. Update Registration
  const { error: updateError } = await supabase
    .from('registrations')
    .update({ team_data: newTeamData })
    .eq('id', reg.id)

  if (updateError) return { error: 'Failed to join team.' }

  // 9. If the team is now full, close the matchmaking slot
  if (newMembers.length + 1 >= team.max_team_size) {
    await supabase.from('teams').update({ looking_for_members: false }).eq('id', teamId)
  }

  // Email confirmations are disabled per user request
  // (Previously sent emails via Resend here)

  if (team.leader_email) {
    await sendTeamJoinNotificationEmail({
      to: team.leader_email,
      leaderName: team.leader_name || '',
      teamName: team.team_name || 'Your Team',
      eventTitle: Array.isArray(reg.events) ? reg.events[0]?.title : (reg.events as any)?.title || 'an Event',
      newMemberName: memberData.fullName || memberData.name || 'A participant',
      newMemberEmail: memberData.email,
    });
  }

  revalidatePath('/events', 'layout')
  
  // Return the team's hash payload so the new member can view their ticket instantly
  return { success: true, hash_payload: reg.hash_payload }
}
