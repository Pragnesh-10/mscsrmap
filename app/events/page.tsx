import { createClient } from '@/utils/supabase/server'
import Navbar from '../components/Navbar'
import Link from 'next/link'
import EventCard from '../components/EventCard'
import './events.css'

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

      <section id="events" className="events relative z-10 pt-32">
        <div className="max-w-[1000px] mx-auto px-6">
          <h2 className="section-title text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-12">Events</h2>

          {activeEvents.length > 0 && (
            <div className="events-section">
              <h3 className="events-subtitle text-blue-400">Upcoming Events</h3>
              <div className="events-grid">
                {activeEvents.map(evt => (
                  <EventCard key={evt.id} event={evt} isPast={false} />
                ))}
              </div>
            </div>
          )}

          {pastEvents.length > 0 && (
            <div className="events-section">
              <h3 className="events-subtitle text-white/50">Past Events</h3>
              <div className="events-grid">
                {pastEvents.map(evt => (
                  <EventCard key={evt.id} event={evt} isPast={true} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
