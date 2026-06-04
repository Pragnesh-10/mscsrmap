'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function submitOnboarding(formData: FormData) {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return { error: 'Not authenticated' }
  }

  const fullName = formData.get('fullName') as string
  const regNumber = formData.get('regNumber') as string
  const phoneNumber = formData.get('phoneNumber') as string
  const department = formData.get('department') as string
  const yearOfStudy = formData.get('yearOfStudy') as string

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

  if (profile?.role === 'admin') {
    redirect('/admin')
  } else if (profile?.role === 'core_member') {
    redirect('/core-dashboard')
  } else {
    redirect('/dashboard')
  }
}
