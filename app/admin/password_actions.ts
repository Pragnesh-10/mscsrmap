'use server'

import { createClient } from '@/utils/supabase/server'
import { decrypt } from '@/utils/security'

export async function acceptPasswordRequest(requestId: string, email: string, newPassword: string) {
  const supabase = await createClient()

  // 1. Verify caller is Admin
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('member_profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Access Denied: Only Admins can accept password resets.' }

  // 2. Lookup the user ID by email
  const { data: targetUser, error: lookupError } = await supabase
    .from('member_profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (lookupError || !targetUser) {
    return { error: 'User not found for this email address.' }
  }

  // Decrypt the stored password securely
  const decryptedPassword = decrypt(newPassword)

  // 3. Call the secure RPC to change the password
  const { error: rpcError } = await supabase.rpc('admin_change_password', {
    target_user_id: targetUser.id,
    new_password: decryptedPassword
  })

  if (rpcError) {
    return { error: `Failed to change password: ${rpcError.message}` }
  }

  // 4. Update the request status to approved
  const { error: updateError } = await supabase
    .from('password_reset_requests')
    .update({ status: 'approved' })
    .eq('id', requestId)

  if (updateError) {
    return { error: 'Password was changed, but failed to update request status.' }
  }

  return { success: true }
}

export async function rejectPasswordRequest(requestId: string) {
  const supabase = await createClient()

  // Verify caller is Admin
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('member_profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Access Denied.' }

  // Update status
  const { error } = await supabase
    .from('password_reset_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)

  if (error) return { error: error.message }

  return { success: true }
}
