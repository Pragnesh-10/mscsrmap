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

  // Fetch all existing registrations for this event to check against
  const { data: existingRegs } = await supabase
    .from('registrations')
    .select('lead_email, team_data')
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

  // 3. Generate secure hash payload using lead_email + eventId + timestamp
  const message = `${leadEmail}${eventId}${new Date().toISOString()}`
  const hashPayload = crypto.createHash('sha256').update(message).digest('hex')

  // 4. Remove team-specific arrays from the base form data
  const baseFormData = { ...formData }
  delete baseFormData.teamMembers
  delete baseFormData.teamLeadIndex

  // 5. Insert into Supabase registrations table
  const { error } = await supabase
    .from('registrations')
    .insert([{
      event_id: eventId,
      lead_email: leadEmail,
      form_data: baseFormData,
      team_data: teamMembers.length > 0 ? { members: teamMembers, leadIndex: teamLeadIndex } : null,
      hash_payload: hashPayload
    }])

  if (error) {
    // 23505 is PostgreSQL code for unique_violation, but we removed the strict constraint on user_id+event_id.
    // However, if we added a constraint on lead_email + event_id, this would catch it.
    if (error.code === '23505') {
      return { error: 'This email is already registered for this event!' }
    }
    return { error: error.message }
  }

  // 6. Revalidate cache so the UI updates
  revalidatePath('/events')

  return { success: true, hash_payload: hashPayload }
}
