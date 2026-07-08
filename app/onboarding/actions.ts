'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { validatePhone } from '@/utils/security'

export async function submitOnboarding(formData: FormData) {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return { error: 'Not authenticated' }
  }

  const fullName = (formData.get('fullName') as string || '').trim()
  const regNumber = (formData.get('regNumber') as string || '').trim()
  const phoneNumber = (formData.get('phoneNumber') as string || '').trim()
  const department = (formData.get('department') as string || '').trim()
  const yearOfStudy = (formData.get('yearOfStudy') as string || '').trim()

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
