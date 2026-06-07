'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAudit } from '../../audit_actions'

export async function assignCertificates(eventId: string, registrationIds: string[], type: string) {
  const supabase = await createClient()

  // Verify access
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('member_profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'core_member')) {
    return { error: 'Unauthorized' }
  }

  // Fetch all target registrations to update their form_data
  const { data: regs, error: fetchError } = await supabase
    .from('registrations')
    .select('id, form_data')
    .in('id', registrationIds)

  if (fetchError || !regs) return { error: fetchError?.message || 'Failed to fetch registrations' }

  // Update each registration's form_data individually to inject certificate_type
  for (const reg of regs) {
    const updatedFormData = {
      ...(reg.form_data as Record<string, any> || {}),
      certificate_type: type
    }

    const { error: updateError } = await supabase
      .from('registrations')
      .update({ form_data: updatedFormData })
      .eq('id', reg.id)

    if (updateError) {
      console.error(`Failed to update cert for reg ${reg.id}`, updateError)
    }
  }

  revalidatePath(`/admin/events/${eventId}`)
  await logAudit('ASSIGN_CERTIFICATES', { event_id: eventId, count: regs.length, type })
  return { success: true }
}

export async function updateRegistrationDetails(eventId: string, regId: string, leadEmail: string, formData: any, teamData: any) {
  const supabase = await createClient()

  // Verify access
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('member_profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'core_member')) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('registrations')
    .update({
      lead_email: leadEmail,
      form_data: formData,
      team_data: teamData
    })
    .eq('id', regId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/events/${eventId}`)
  await logAudit('UPDATE_REGISTRATION', { event_id: eventId, reg_id: regId, lead_email: leadEmail })
  return { success: true }
}

export async function updateEventDetails(eventId: string, updateData: any) {
  const supabase = await createClient()

  // Verify access
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('member_profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('events')
    .update(updateData)
    .eq('id', eventId)

  if (error) return { error: error.message }

  revalidatePath('/admin')
  revalidatePath('/events', 'layout')
  await logAudit('UPDATE_EVENT', { event_id: eventId, title: updateData.title })
  return { success: true }
}
