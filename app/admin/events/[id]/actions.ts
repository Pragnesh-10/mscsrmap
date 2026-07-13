'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendRegistrationEmail } from '@/utils/resend'

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

  // Create Admin Supabase Client for bypassing RLS
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all target registrations to update their form_data
  const { data: regs, error: fetchError } = await supabaseAdmin
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

    const { error: updateError } = await supabaseAdmin
      .from('registrations')
      .update({ form_data: updatedFormData })
      .eq('id', reg.id)

    if (updateError) {
      console.error(`Failed to update cert for reg ${reg.id}`, updateError)
    }
  }

  revalidatePath(`/admin/events/${eventId}`)
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

  // Create Admin Supabase Client for bypassing RLS
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabaseAdmin
    .from('registrations')
    .update({
      lead_email: leadEmail,
      form_data: formData,
      team_data: teamData
    })
    .eq('id', regId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/events/${eventId}`)
  return { success: true }
}

export async function deleteRegistration(eventId: string, regId: string) {
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

  // Create Admin Supabase Client for bypassing RLS
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get hash_payload to delete from teams if applicable
  const { data: regData } = await supabaseAdmin
    .from('registrations')
    .select('hash_payload')
    .eq('id', regId)
    .single()

  if (regData?.hash_payload) {
    await supabaseAdmin.from('teams').delete().eq('hash_payload', regData.hash_payload)
  }

  const { error } = await supabaseAdmin
    .from('registrations')
    .delete()
    .eq('id', regId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/events/${eventId}`)
  return { success: true }
}

export async function importExternalRegistrations(eventId: string, rows: any[]) {
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

  // Create Admin Supabase Client for creating users
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch event details for confirmation emails
  const { data: eventData } = await supabaseAdmin
    .from('events')
    .select('title, date_start, location')
    .eq('id', eventId)
    .single();

  let successCount = 0;
  let skipCount = 0;
  let errors: string[] = [];

  for (const row of rows) {
    const email = row['Email Address'] || row['Email'] || row['email'];
    const name = row['Name'] || row['Full Name'] || row['name'] || row['First Name'];
    const teamName = row['Team Name'] || row['Team'] || row['team_name'];
    const regNum = row['Registration Number'] || row['Registration No'] || row['Roll Number'] || row['reg_num'];
    const collegeName = row['College Name'] || row['College'] || row['Institution Name'];
    const year = row['Year of Study'] || row['Year'] || 'Unknown';

    if (!email) {
      skipCount++;
      continue;
    }

    try {
      // 1. Ensure user profile exists
      const { data: existingUser } = await supabaseAdmin.from('member_profiles').select('id').eq('email', email).single();
      
      let userId = existingUser?.id;

      if (!existingUser) {
        // Create an auth user first
        const randomPassword = require('crypto').randomUUID();
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: randomPassword,
          email_confirm: true
        });

        if (authError || !authUser.user) {
          errors.push(`Failed to create auth user for ${email}: ${authError?.message}`);
          skipCount++;
          continue;
        }
        
        userId = authUser.user.id;

        // Create profile
        await supabaseAdmin.from('member_profiles').insert({
          id: userId,
          email: email,
          full_name: name || email.split('@')[0],
          role: 'user',
          registration_number: regNum || null
        });
      }

      // 2. Insert Registration
      // We will create individual registrations for now, or if Team Name exists, group them? 
      // Unstop usually provides one row per team OR one row per member. 
      // If it's one row per team, Unstop will have "Member 1 Email", "Member 2 Email".
      // Assuming a flattened structure for simplicity where we just make a Team Lead registration.
      
      // Let's check if a registration for this email already exists for this event
      const { data: existingReg } = await supabaseAdmin.from('registrations')
        .select('id')
        .eq('event_id', eventId)
        .eq('lead_email', email)
        .single();
        
      if (existingReg) {
        skipCount++;
        continue; // Already registered
      }

      const formData = {
        fullName: name || email.split('@')[0],
        email: email,
        regNum: regNum || undefined,
        collegeName: collegeName || undefined,
        year: year
      };
      
      const teamData = teamName ? {
        teamName: teamName,
        leadIndex: 0,
        members: [] // Not parsing complex nested members for now
      } : null;

      const hashPayload = require('crypto').randomUUID();
      const { error: regError } = await supabaseAdmin.from('registrations').insert({
        event_id: eventId,
        lead_email: email,
        form_data: formData,
        team_data: teamData,
        hash_payload: hashPayload
      });

      if (regError) {
        errors.push(`Failed to create registration for ${email}: ${regError.message}`);
        skipCount++;
      } else {
        successCount++;
        
        // Send email via Resend
        if (eventData) {
          const eventDateString = eventData.date_start 
            ? new Date(eventData.date_start).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' })
            : 'TBA';
            
          sendRegistrationEmail({
            to: email,
            name: name || email.split('@')[0],
            eventTitle: eventData.title || 'Event',
            eventDate: eventDateString,
            eventLocation: eventData.location || '',
            status: 'confirmed',
            hashPayload: hashPayload,
            isTeam: !!teamName,
            teamName: teamName || undefined
          }).catch(err => console.error(`Failed to send import confirmation email to ${email}:`, err));
        }
      }

    } catch (err: any) {
      errors.push(`Exception for ${email}: ${err.message}`);
      skipCount++;
    }
  }

  revalidatePath(`/admin/events/${eventId}`);
  
  return { success: true, successCount, skipCount, errors };
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

  revalidatePath('/admin', 'layout')
  revalidatePath('/events', 'layout')
  return { success: true }
}

export async function syncOfflineCheckins(eventId: string, checkins: Array<{
  hash: string;
  type: 'PRIMARY' | 'MEMBER';
  memberIndex?: number;
}>) {
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

  // Create Admin Supabase Client for bypassing RLS
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let successCount = 0;
  const errors: string[] = [];

  for (const checkin of checkins) {
    try {
      if (checkin.type === 'PRIMARY') {
        const { error } = await supabaseAdmin
          .from('registrations')
          .update({ checked_in: true })
          .eq('hash_payload', checkin.hash)
          .eq('event_id', eventId);
          
        if (error) {
          errors.push(`Failed to check in primary ${checkin.hash}: ${error.message}`);
        } else {
          successCount++;
        }
      } else if (checkin.type === 'MEMBER' && typeof checkin.memberIndex === 'number') {
        // Fetch latest team_data
        const { data: reg, error: fetchError } = await supabaseAdmin
          .from('registrations')
          .select('team_data')
          .eq('hash_payload', checkin.hash)
          .eq('event_id', eventId)
          .single();

        if (fetchError || !reg) {
          errors.push(`Failed to fetch registration for member checkin: ${fetchError?.message}`);
          continue;
        }

        const teamData = { ...reg.team_data };
        if (teamData && teamData.members && teamData.members[checkin.memberIndex]) {
          teamData.members[checkin.memberIndex].checked_in = true;
          
          const { error: updateError } = await supabaseAdmin
            .from('registrations')
            .update({ team_data: teamData })
            .eq('hash_payload', checkin.hash)
            .eq('event_id', eventId);

          if (updateError) {
            errors.push(`Failed to check in member index ${checkin.memberIndex} of ${checkin.hash}: ${updateError.message}`);
          } else {
            successCount++;
          }
        } else {
          errors.push(`Invalid member index ${checkin.memberIndex} for ${checkin.hash}`);
        }
      }
    } catch (e: any) {
      errors.push(`System exception checking in ${checkin.hash}: ${e.message}`);
    }
  }

  revalidatePath(`/admin/events/${eventId}`)
  return { success: true, successCount, errors };
}

