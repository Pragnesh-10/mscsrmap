import { createClient } from '@/utils/supabase/server'
import Navbar from '../../components/Navbar'
import Link from 'next/link'
import EventPortalTabs from '../../components/EventPortalTabs'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function EventPortalPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  const { data: evt, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !evt) {
    return notFound()
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
                <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
                  {evt.title}
                </h1>
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
                  <span>{new Date(evt.date_start).toLocaleString()}</span>
                </div>
                {evt.location && (
                  <div className="flex items-center gap-2">
                    <i className="fas fa-map-marker-alt text-blue-400"></i>
                    <span>{evt.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <EventPortalTabs event={evt} />
        </div>
      </main>
    </>
  )
}
