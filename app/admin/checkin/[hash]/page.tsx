import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function CheckinPage({ params, searchParams }: { params: Promise<{ hash: string }>, searchParams: Promise<{ eventId?: string }> }) {
  const supabase = await createClient()
  const { hash } = await params
  const { eventId } = await searchParams

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

  // Fetch the registration (including events slug)
  const { data: reg, error } = await supabase
    .from('registrations')
    .select(`
      *,
      events ( id, title, date_start, location, slug )
    `)
    .eq('hash_payload', hash)
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
          <Link href={eventId ? `/admin/events/${eventId}/scanner` : "/admin"} className="text-blue-400 hover:text-blue-300 text-sm font-semibold">
            {eventId ? "Back to Scanner" : "Back to Dashboard"}
          </Link>
        </div>
      </div>
    )
  }

  // Cross-reference with the scanner's event ID or event slug if provided
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId || '')
  const matchesEvent = eventId 
    ? (isUUID ? reg.event_id === eventId : (reg.events as any)?.slug === eventId)
    : true

  if (eventId && !matchesEvent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] text-white p-6">
        <div className="p-8 bg-[#18181b] border border-orange-500/20 rounded-2xl text-center w-full max-w-md shadow-2xl">
          <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-orange-500/20">
            <i className="fas fa-exclamation-triangle text-3xl text-orange-500"></i>
          </div>
          <h2 className="text-2xl font-bold mb-2">Wrong Event!</h2>
          <p className="text-white/60 mb-8">This ticket is valid, but it is for <strong>{(reg.events as any)?.title}</strong>, not the event you are currently scanning for.</p>
          <Link href={`/admin/events/${eventId}/scanner`} className="text-blue-400 hover:text-blue-300 text-sm font-semibold">Back to Scanner</Link>
        </div>
      </div>
    )
  }

  const isTeam = reg.team_data && reg.team_data.members && reg.team_data.members.length > 0;
  const primaryCheckedIn = reg.checked_in;
  const allMembersCheckedIn = isTeam ? reg.team_data.members.every((m: any) => m.checked_in) : true;
  const completelyCheckedIn = primaryCheckedIn && allMembersCheckedIn;
  const event = reg.events

  // The Server Action to check in Primary
  async function markPrimaryAsAttended() {
    'use server'
    const sb = await createClient()
    await sb.from('registrations').update({ checked_in: true }).eq('hash_payload', hash)
    revalidatePath(`/admin/checkin/${hash}`)
  }

  // The Server Action to check in an individual Team Member
  async function markMemberAsAttended(memberIndex: number) {
    'use server'
    const sb = await createClient()
    const { data: latestReg } = await sb.from('registrations').select('team_data').eq('hash_payload', hash).single()
    if (!latestReg || !latestReg.team_data || !latestReg.team_data.members) return;
    
    const updatedTeamData = { ...latestReg.team_data }
    if (updatedTeamData.members[memberIndex]) {
      updatedTeamData.members[memberIndex].checked_in = true
    }
    
    await sb.from('registrations').update({ team_data: updatedTeamData }).eq('hash_payload', hash)
    revalidatePath(`/admin/checkin/${hash}`)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white p-6 md:p-12 flex flex-col items-center">
      {/* Background Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>
      
      <div className="w-full max-w-3xl">
        <div className="flex justify-between items-center mb-8">
          <Link href={eventId ? `/admin/events/${eventId}/scanner` : "/admin"} className="text-white/40 hover:text-white transition-colors flex items-center gap-2 text-sm font-semibold">
            <i className="fas fa-arrow-left"></i> {eventId ? "Back to Scanner" : "Workspace Dashboard"}
          </Link>
          <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-white/60 tracking-wider">
            CHECK-IN PORTAL
          </div>
        </div>

        {/* Status Banner */}
        <div className={`w-full p-6 rounded-2xl mb-8 flex items-center gap-4 shadow-xl border ${completelyCheckedIn ? 'bg-green-500/10 border-green-500/20' : 'bg-[#18181b] border-white/10'}`}>
          <div className={`w-14 h-14 rounded-full flex items-center justify-center border ${completelyCheckedIn ? 'bg-green-500/20 border-green-500/30 text-green-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
            <i className={`fas ${completelyCheckedIn ? 'fa-check-double text-xl' : 'fa-ticket-alt text-xl'}`}></i>
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${completelyCheckedIn ? 'text-green-400' : 'text-white'}`}>
              {completelyCheckedIn ? 'Everyone Checked In!' : isTeam ? 'Valid Team Ticket' : 'Valid Ticket Found'}
            </h2>
            <p className={`${completelyCheckedIn ? 'text-green-500/60' : 'text-blue-400/60'} text-sm font-medium`}>
              {event.title}
            </p>
          </div>
        </div>

        {/* Global Action Button (Only if NOT a team) */}
        {!isTeam && !primaryCheckedIn && (
          <form action={markPrimaryAsAttended} className="mb-8">
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
          {/* Individual Check In for Primary if Team Mode */}
          {isTeam && (
            <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
              <span className="text-sm font-bold text-white/60">Check-In Status</span>
              {primaryCheckedIn ? (
                <span className="px-4 py-2 bg-green-500/10 border border-green-500/30 text-green-500 rounded-lg text-sm font-bold flex items-center gap-2">
                  <i className="fas fa-check-circle"></i> Checked In
                </span>
              ) : (
                <form action={markPrimaryAsAttended}>
                  <button type="submit" className="px-5 py-2 bg-blue-500 hover:bg-blue-600 rounded-xl text-white font-bold transition-colors text-sm shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                    Check In Primary
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Team Details (If any) */}
        {reg.team_data && reg.team_data.members && reg.team_data.members.length > 0 && (
          <div className="bg-[#18181b]/40 backdrop-blur-md border border-white/5 rounded-2xl p-8">
            <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-6 border-b border-white/5 pb-4 flex items-center justify-between">
              <span>
                Team Members ({reg.team_data.members.length})
                {reg.team_data.teamName && <span className="ml-3 text-purple-400 font-extrabold uppercase bg-purple-500/10 px-3 py-1 rounded-full text-xs">Team: {reg.team_data.teamName}</span>}
              </span>
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
                    {/* Individual Check In for Team Member */}
                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-xs font-bold text-white/60">Check-In Status</span>
                      {member.checked_in ? (
                        <span className="px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-500 rounded-lg text-xs font-bold flex items-center gap-2">
                          <i className="fas fa-check-circle"></i> Checked In
                        </span>
                      ) : (
                        <form action={markMemberAsAttended.bind(null, index)}>
                          <button type="submit" className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-bold transition-colors text-xs shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                            Check In Member
                          </button>
                        </form>
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
