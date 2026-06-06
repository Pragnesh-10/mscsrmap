'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'

export async function submitPublicRegistration(eventId: string, formData: any) {
  const supabase = await createClient()

  const leadEmail = formData.email?.toLowerCase().trim()

  if (!leadEmail) {
    return { error: 'Email is required to register.' }
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
    .select('form_requirements, max_capacity')
    .eq('id', eventId)
    .single()

  if (eventError || !eventData) {
    return { error: 'Event not found.' }
  }

  const reqs = eventData.form_requirements || {}
  if (!reqs.allow_external_students) {
    for (const email of allIncomingEmails) {
      if (email && !email.toLowerCase().endsWith('@srmap.edu.in')) {
        return { error: 'All team members must use @srmap.edu.in email addresses for this event.' }
      }
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
  let incomingCount = 1 + teamMembers.length
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

  // 6. Insert into Supabase registrations table
  const { data: insertedData, error } = await supabase
    .from('registrations')
    .insert([{
      event_id: eventId,
      lead_email: leadEmail,
      form_data: baseFormData,
      team_data: teamMembers.length > 0 ? { members: teamMembers, leadIndex: teamLeadIndex, teamName: formData.teamName } : null,
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

  // 7. Matchmaking Hook: If they want more members, create a team row
  if (formData.lookingForMembers && formData.teamName) {
    const leaderFullName = baseFormData.fullName || ''
    const leaderEmail = leadEmail
    const leaderBranch = baseFormData.branch || ''
    const leaderYear = baseFormData.year || ''

    await supabase.from('teams').insert([{
      registration_id: insertedData.id,
      event_id: eventId,
      team_name: formData.teamName,
      max_team_size: eventData.form_requirements?.max_team_size || 4,
      looking_for_members: true,
      leader_name: leaderFullName,
      leader_email: leaderEmail,
      leader_branch: leaderBranch,
      leader_year: leaderYear
    }])
  }

  // 8. Revalidate cache so the UI updates
  revalidatePath('/events')

  return { 
    success: true, 
    hash_payload: hashPayload, 
    registration: insertedData,
    isWaitlisted: assignedStatus === 'waitlisted'
  }
}

export async function lookupTeamRegistration(eventId: string, email: string) {
  const supabase = await createClient()

  // First check if they are the primary registrant
  const { data: primaryReg } = await supabase
    .from('registrations')
    .select('*')
    .eq('event_id', eventId)
    .eq('lead_email', email.toLowerCase().trim())
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
  const supabase = await createClient()

  // 1. Fetch the matchmaking team to get the registration link
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('registration_id, max_team_size, looking_for_members')
    .eq('id', teamId)
    .single()

  if (teamError || !team || !team.looking_for_members) {
    return { error: 'Team not found or is no longer accepting members.' }
  }

  // 2. Fetch the actual registration data
  const { data: reg, error: regError } = await supabase
    .from('registrations')
    .select('id, team_data, hash_payload')
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

  // 4. Append the new member
  const newMembers = [...existingMembers, memberData]
  const newTeamData = {
    ...reg.team_data,
    members: newMembers
  }

  // 5. Update Registration
  const { error: updateError } = await supabase
    .from('registrations')
    .update({ team_data: newTeamData })
    .eq('id', reg.id)

  if (updateError) return { error: 'Failed to join team.' }

  // 6. If the team is now full, close the matchmaking slot
  if (newMembers.length + 1 >= team.max_team_size) {
    await supabase.from('teams').update({ looking_for_members: false }).eq('id', teamId)
  }

  revalidatePath('/events')
  
  // Return the team's hash payload so the new member can view their ticket instantly
  return { success: true, hash_payload: reg.hash_payload }
}
