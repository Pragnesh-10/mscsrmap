'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Next.js redirect MUST be called outside try/catch if used inside one, but here it's fine
  redirect('/onboarding')
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const newPassword = formData.get('new_password') as string

  if (!email || !newPassword) {
    return { error: 'Email and new password are required.' }
  }

  // Insert the pending request
  const { error } = await supabase
    .from('password_reset_requests')
    .insert([{ email, new_password: newPassword, status: 'pending' }])

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
