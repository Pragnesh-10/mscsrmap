'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { validateEmail, encrypt } from '@/utils/security'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = (formData.get('email') as string || '').toLowerCase().trim()
  const password = formData.get('password') as string || ''

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  if (!validateEmail(email)) {
    return { error: 'Invalid email format.' }
  }

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

  const email = (formData.get('email') as string || '').toLowerCase().trim()
  const newPassword = formData.get('new_password') as string || ''

  if (!email || !newPassword) {
    return { error: 'Email and new password are required.' }
  }

  if (!validateEmail(email)) {
    return { error: 'Invalid email format.' }
  }

  if (newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters long.' }
  }

  // Check if the user exists in member_profiles
  const { data: profile, error: profileError } = await supabase
    .from('member_profiles')
    .select('email')
    .eq('email', email)
    .single()

  if (profileError || !profile) {
    // Return standard error to prevent email enumeration attacks (or keep legacy behaviour, but returning generic error is secure)
    return { error: 'If an account exists, a password reset request has been submitted.' }
  }

  // Encrypt the password securely before storing it in the database
  const encryptedPassword = encrypt(newPassword)

  // Insert the pending request
  const { error } = await supabase
    .from('password_reset_requests')
    .insert([{ email, new_password: encryptedPassword, status: 'pending' }])

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

