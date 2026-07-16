import { createClient } from '@/utils/supabase/server'
import Navbar from '../../components/Navbar'
import Link from 'next/link'
import EventPortalTabs from '../../components/EventPortalTabs'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function EventPage(props: { 
  params: Promise<{ slug: string }>, 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> 
}) {
  const supabase = await createClient()
  const { slug } = await props.params
  const searchParams = await props.searchParams
  const inviteId = searchParams?.invite as string | undefined

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)

  // Fetch event details by slug or ID
  const { data: evt, error } = await supabase
    .from('events')
    .select('*')
    .or(`slug.eq.${slug}${isUUID ? `,id.eq.${slug}` : ''}`)
    .single()

  if (error || !evt) {
    return notFound()
  }

  // Calculate waitlist mode
  let isWaitlistMode = false
  if (evt.max_capacity) {
    const { data: existingRegs } = await supabase
      .from('registrations')
      .select('team_data, status')
      .eq('event_id', evt.id)
      .eq('status', 'confirmed')

    let currentConfirmedCount = 0
    existingRegs?.forEach(reg => {
      currentConfirmedCount += 1 + (reg.team_data?.members?.length || 0)
    })
    
    if (currentConfirmedCount >= evt.max_capacity) {
      isWaitlistMode = true
    }
  }

  // Fetch Matchmaking Teams
  let openTeams: any[] = []
  let invitedTeam: any = null
  if (evt.form_requirements?.allow_teams) {
    const { data: teamsData } = await supabase
      .from('teams')
      .select('*')
      .eq('event_id', evt.id)
      .eq('looking_for_members', true)
      
    if (teamsData) openTeams = teamsData

    if (inviteId) {
      const { data: specificTeam } = await supabase
        .from('teams')
        .select('*')
        .eq('id', inviteId)
        .single()
      
      if (specificTeam) invitedTeam = specificTeam
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0a0a0b] text-white pt-32 pb-24 px-6 md:px-12 flex flex-col items-center">
        {/* Background Glow */}
        <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>
        
        <div className="w-full max-w-4xl">
          <Link href="/events" className="text-white/40 hover:text-white transition-colors flex items-center gap-2 text-sm font-semibold mb-8">
            <i className="fas fa-arrow-left"></i> Back to Events
          </Link>
          
          <div className="bg-[#18181b]/60 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden mb-8 shadow-2xl relative">
            {evt.image_url && (
              <div className="absolute top-0 left-0 w-full h-48 opacity-20 pointer-events-none mask-image-b">
                <img src={evt.image_url} alt={evt.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-8 md:p-12 relative z-10">
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
                <div className="flex flex-col gap-2">
                  {evt.type && (evt.type === 'hackathon' || evt.type === 'workshop') && (
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider w-fit ${
                      evt.type === 'hackathon' 
                        ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' 
                        : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                    }`}>
                      {evt.type}
                    </span>
                  )}
                  <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
                    {evt.title}
                  </h1>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap self-start ${
                  evt.status === 'upcoming' 
                    ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                    : 'bg-white/5 text-white/40 border border-white/10'
                }`}>
                  {evt.status === 'upcoming' ? 'Upcoming Event' : 'Completed'}
                </span>
              </div>
              <p className="text-white/60 text-lg mb-8 max-w-2xl">{evt.description}</p>
              
              <div className="flex flex-wrap gap-6 text-sm text-white/50 bg-black/20 p-5 rounded-2xl border border-white/5 inline-flex">
                <div className="flex items-center gap-2">
                  <i className="fas fa-calendar-alt text-blue-400"></i>
                  <span>{new Date(evt.date_start).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' })}</span>
                </div>
                {evt.location && (
                  <div className="flex items-center gap-2">
                    <i className="fas fa-map-marker-alt text-blue-400"></i>
                    <span>{evt.location}</span>
                  </div>
                )}
                {evt.form_requirements?.event_pricing === 'paid' && (
                  <div className="flex items-center gap-2">
                    <i className="fas fa-rupee-sign text-amber-400"></i>
                    <span className="text-amber-400 font-bold">
                      ₹{evt.form_requirements.registration_fee}
                      {evt.form_requirements.charge_type === 'per_team' ? ' per team' : ' per person'}
                    </span>
                  </div>
                )}
                {evt.form_requirements?.event_pricing === 'free' && (
                  <div className="flex items-center gap-2">
                    <i className="fas fa-gift text-green-400"></i>
                    <span className="text-green-400 font-bold">Free Event</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Event Photo Gallery */}
          {evt.gallery_urls && Array.isArray(evt.gallery_urls) && evt.gallery_urls.length > 0 && (
            <div className="mb-8 bg-[#18181b]/40 backdrop-blur-md p-6 md:p-8 rounded-[20px] border border-white/5 shadow-xl">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <i className="fas fa-camera-retro text-blue-400"></i> Event Gallery
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {evt.gallery_urls.map((url: string, idx: number) => (
                  <div key={idx} className="relative aspect-video rounded-xl overflow-hidden group">
                    <img src={url} alt={`${evt.title} photo ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500"></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <EventPortalTabs event={evt} isWaitlistMode={isWaitlistMode} openTeams={openTeams} invitedTeam={invitedTeam} />
        </div>
      </main>
    </>
  )
}
