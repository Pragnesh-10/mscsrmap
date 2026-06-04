import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function CheckinPage({ params }: { params: { hash: string } }) {
  const supabase = await createClient()

  // Verify Admin / Core Team status is handled by proxy.ts, but let's be safe
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] text-white">
        <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-2xl text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Unauthorized Access</h2>
          <p className="text-white/60 mb-6">You must be logged in as a Core Team member to access the check-in scanner.</p>
          <Link href="/login" className="px-6 py-3 bg-red-500 hover:bg-red-600 rounded-xl font-bold transition-colors">Go to Login</Link>
        </div>
      </div>
    )
  }

  // Fetch the registration
  const { data: reg, error } = await supabase
    .from('registrations')
    .select(`
      *,
      events ( title, date_start, location )
    `)
    .eq('hash_payload', params.hash)
    .single()

  if (error || !reg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] text-white p-6">
        <div className="p-8 bg-[#18181b] border border-white/10 rounded-2xl text-center w-full max-w-md shadow-2xl">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <i className="fas fa-times text-3xl text-red-500"></i>
          </div>
          <h2 className="text-2xl font-bold mb-2">Invalid Ticket</h2>
          <p className="text-white/60 mb-8">This QR code does not match any valid registration in the database. It may be forged or from an old event.</p>
          <Link href="/admin" className="text-blue-400 hover:text-blue-300 text-sm font-semibold">Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  const isCheckedIn = reg.checked_in
  const event = reg.events

  // The Server Action to check them in
  async function markAsAttended() {
    'use server'
    const sb = await createClient()
    await sb.from('registrations').update({ checked_in: true }).eq('hash_payload', params.hash)
    revalidatePath(`/admin/checkin/${params.hash}`)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white p-6 md:p-12 flex flex-col items-center">
      {/* Background Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>
      
      <div className="w-full max-w-3xl">
        <div className="flex justify-between items-center mb-8">
          <Link href="/admin" className="text-white/40 hover:text-white transition-colors flex items-center gap-2 text-sm font-semibold">
            <i className="fas fa-arrow-left"></i> Admin Dashboard
          </Link>
          <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-white/60 tracking-wider">
            CHECK-IN PORTAL
          </div>
        </div>

        {/* Status Banner */}
        <div className={`w-full p-6 rounded-2xl mb-8 flex items-center gap-4 shadow-xl border ${isCheckedIn ? 'bg-green-500/10 border-green-500/20' : 'bg-[#18181b] border-white/10'}`}>
          <div className={`w-14 h-14 rounded-full flex items-center justify-center border ${isCheckedIn ? 'bg-green-500/20 border-green-500/30 text-green-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
            <i className={`fas ${isCheckedIn ? 'fa-check-double text-xl' : 'fa-ticket-alt text-xl'}`}></i>
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${isCheckedIn ? 'text-green-400' : 'text-white'}`}>
              {isCheckedIn ? 'Already Checked In!' : 'Valid Ticket Found'}
            </h2>
            <p className={`${isCheckedIn ? 'text-green-500/60' : 'text-blue-400/60'} text-sm font-medium`}>
              {event.title}
            </p>
          </div>
        </div>

        {/* Action Button */}
        {!isCheckedIn && (
          <form action={markAsAttended} className="mb-8">
            <button type="submit" className="w-full py-5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-2xl font-bold text-lg transition-all shadow-[0_0_30px_rgba(59,130,246,0.2)] text-white flex justify-center items-center gap-3">
              <i className="fas fa-user-check"></i> Mark as Attended
            </button>
          </form>
        )}

        {/* Registration Details */}
        <div className="bg-[#18181b]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-8 mb-8">
          <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-6 border-b border-white/5 pb-4">Primary Registrant Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Full Name</p>
              <p className="text-lg font-bold text-white">{reg.form_data?.fullName || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Email</p>
              <p className="text-lg font-bold text-white">{reg.lead_email}</p>
            </div>
            {reg.form_data?.regNum && (
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Registration No.</p>
                <p className="text-lg font-bold text-blue-400 font-mono">{reg.form_data.regNum}</p>
              </div>
            )}
            {reg.form_data?.branch && (
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Branch</p>
                <p className="text-lg font-bold text-white">{reg.form_data.branch}</p>
              </div>
            )}
            {reg.form_data?.specialization && (
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Specialization</p>
                <p className="text-lg font-bold text-white">{reg.form_data.specialization}</p>
              </div>
            )}
            {reg.form_data?.year && (
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Year of Study</p>
                <p className="text-lg font-bold text-white">{reg.form_data.year}</p>
              </div>
            )}
          </div>
        </div>

        {/* Team Details (If any) */}
        {reg.team_data && reg.team_data.members && reg.team_data.members.length > 0 && (
          <div className="bg-[#18181b]/40 backdrop-blur-md border border-white/5 rounded-2xl p-8">
            <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-6 border-b border-white/5 pb-4 flex items-center justify-between">
              <span>Team Members ({reg.team_data.members.length})</span>
              {reg.team_data.leadIndex === 0 && <span className="text-blue-400 text-xs px-2 py-1 bg-blue-500/10 rounded-md">Primary is Team Lead</span>}
            </h3>

            <div className="flex flex-col gap-6">
              {reg.team_data.members.map((member: any, index: number) => {
                const memberIndex = index + 1; // Primary is 0, members are 1, 2, 3...
                const isLead = reg.team_data.leadIndex === memberIndex;
                
                return (
                  <div key={index} className="bg-black/20 rounded-xl p-5 border border-white/5 relative">
                    {isLead && (
                      <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2">
                        <span className="bg-purple-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg border border-purple-400/50">Team Lead</span>
                      </div>
                    )}
                    <h4 className="text-white font-bold mb-4">Member {index + 2}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Name</p>
                        <p className="text-sm font-bold text-white/90">{member.fullName || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Email</p>
                        <p className="text-sm font-bold text-white/90 truncate" title={member.email}>{member.email || 'N/A'}</p>
                      </div>
                      {member.regNum && (
                        <div>
                          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Reg No.</p>
                          <p className="text-sm font-bold text-blue-400 font-mono">{member.regNum}</p>
                        </div>
                      )}
                      {member.branch && (
                        <div>
                          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Branch</p>
                          <p className="text-sm font-bold text-white/90">{member.branch}</p>
                        </div>
                      )}
                      {member.specialization && (
                        <div>
                          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Spec.</p>
                          <p className="text-sm font-bold text-white/90">{member.specialization}</p>
                        </div>
                      )}
                      {member.year && (
                        <div>
                          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Year</p>
                          <p className="text-sm font-bold text-white/90">{member.year}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
