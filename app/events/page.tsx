import { createClient } from '@/utils/supabase/server'
import Navbar from '../components/Navbar'
import Link from 'next/link'

// Disable caching for this route so it updates when new events are added
export const dynamic = 'force-dynamic'

export default async function EventsPage() {
  const supabase = await createClient()

  // Fetch events from Supabase
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .order('date_start', { ascending: false })

  const activeEvents = events?.filter(e => e.status === 'upcoming') || []
  const pastEvents = events?.filter(e => e.status === 'completed') || []

  return (
    <>
      <Navbar />

      {/* Background */}
      <div className="fixed inset-0 bg-[#0a0a0b] -z-20"></div>
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[150px] -z-10 pointer-events-none"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-500/10 blur-[150px] -z-10 pointer-events-none"></div>

      <main className="max-w-[1200px] mx-auto px-6 pt-32 pb-24 min-h-screen">
        <h2 className="text-4xl md:text-5xl font-bold mb-16 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Events</h2>

        {/* Active Events */}
        {activeEvents.length > 0 && (
          <div className="mb-20">
            <h3 className="text-2xl font-semibold mb-8 border-b border-white/10 pb-4">Upcoming Events</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {activeEvents.map(evt => (
                <div key={evt.id} className="bg-[#18181b]/60 backdrop-blur-xl border border-blue-500/30 rounded-2xl overflow-hidden hover:transform hover:-translate-y-2 transition-all duration-300 shadow-lg shadow-blue-500/10 flex flex-col h-full">
                  {evt.image_url && (
                    <div className="w-full h-48 bg-black/50">
                      <img src={evt.image_url} alt={evt.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-xl font-bold text-white leading-tight">{evt.title}</h4>
                      <span className="px-3 py-1 bg-green-500/15 text-green-400 border border-green-500/30 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ml-4">
                        Upcoming
                      </span>
                    </div>
                    <p className="text-white/60 text-sm mb-6 flex-1 line-clamp-4">{evt.description}</p>
                    <div className="flex flex-col gap-2 mt-auto text-sm text-white/50">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-calendar-alt text-blue-400 w-4 text-center"></i>
                        <span>{new Date(evt.date_start).toLocaleString()}</span>
                      </div>
                      {evt.location && (
                        <div className="flex items-center gap-2 text-white/40">
                          <i className="fas fa-map-marker-alt text-blue-400 w-4 text-center"></i>
                          <span>{evt.location}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-4">
                      <Link 
                        href={`/events/${evt.id}`}
                        className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold transition-all w-full flex justify-center items-center gap-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                      >
                        <span>Open Event Portal</span><i className="fas fa-arrow-right"></i>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Past Events */}
        <div>
          <h3 className="text-2xl font-semibold mb-8 border-b border-white/10 pb-4">Past Events</h3>
          {pastEvents.length === 0 ? (
            <p className="text-white/40 text-center py-12">No past events found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {pastEvents.map(evt => (
                <div key={evt.id} className="bg-[#18181b]/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden hover:bg-[#18181b]/60 transition-colors flex flex-col h-full opacity-80 hover:opacity-100 grayscale-[30%] hover:grayscale-0">
                  {evt.image_url && (
                    <div className="w-full h-40 bg-black/50">
                      <img src={evt.image_url} alt={evt.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-lg font-bold text-white/90 leading-tight">{evt.title}</h4>
                      <span className="px-3 py-1 bg-white/5 text-white/40 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ml-4">
                        Completed
                      </span>
                    </div>
                    <p className="text-white/50 text-sm mb-6 flex-1 line-clamp-3">{evt.description}</p>
                    <div className="flex flex-col gap-2 mt-auto text-xs text-white/40">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-calendar-alt w-4 text-center"></i>
                        <span>{new Date(evt.date_start).toLocaleString()}</span>
                      </div>
                      {evt.location && (
                        <div className="flex items-center gap-2">
                          <i className="fas fa-map-marker-alt w-4 text-center"></i>
                          <span>{evt.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
