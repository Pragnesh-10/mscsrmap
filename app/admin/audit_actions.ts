'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function logAudit(action_type: string, details: Record<string, any>) {
  const supabase = await createClient()
  
  // Get current user securely from server session
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user || !user.email) {
    console.error('Audit Log Error: Unauthenticated user attempted an action.', action_type, details)
    return { error: 'Unauthenticated' }
  }

  // Insert audit log
  const { error } = await supabase.from('audit_logs').insert([{
    admin_email: user.email,
    action_type,
    details
  }])

  if (error) {
    console.error('Audit Log Insertion Error:', error)
    return { error: error.message }
  }

  return { success: true }
}

export async function fetchAuditLogs() {
  const supabase = await createClient()
  
  // Verify admin role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthenticated' }
  
  const { data: profile } = await supabase.from('member_profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return { error: 'Unauthorized: Only admins can view audit logs.' }
  }

  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return { error: error.message }
  
  return { data }
}
