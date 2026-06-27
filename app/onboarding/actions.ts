'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { sanitizeString, validatePhone } from '@/utils/security'

export async function submitOnboarding(formData: FormData) {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return { error: 'Not authenticated' }
  }

  const fullName = sanitizeString(formData.get('fullName') as string || '')
  const regNumber = sanitizeString(formData.get('regNumber') as string || '')
  const phoneNumber = sanitizeString(formData.get('phoneNumber') as string || '')
  const department = sanitizeString(formData.get('department') as string || '')
  const yearOfStudy = sanitizeString(formData.get('yearOfStudy') as string || '')

  if (!fullName || !regNumber || !phoneNumber || !department || !yearOfStudy) {
    return { error: 'All onboarding fields are required.' }
  }

  if (!validatePhone(phoneNumber)) {
    return { error: 'Invalid phone number format. Please enter a valid phone number.' }
  }

  const { error } = await supabase
    .from('member_profiles')
    .update({
      full_name: fullName,
      registration_number: regNumber,
      phone_number: phoneNumber,
      department: department,
      year_of_study: yearOfStudy,
      is_onboarded: true
    })
    .eq('id', session.user.id)

  if (error) {
    return { error: error.message }
  }

  // We need to fetch the role to know where to redirect
  const { data: profile } = await supabase
    .from('member_profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (profile?.role === 'admin' || profile?.role === 'core_member') {
    redirect('/admin')
  } else {
    redirect('/dashboard')
  }
}
