import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import EditEventForm from './EditEventForm'

export const dynamic = 'force-dynamic'

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  // Verify access
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return notFound()

  const { data: profile } = await supabase
    .from('member_profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.role !== 'admin') return notFound()

  const decodedId = decodeURIComponent(id)
  
  // Fetch Event by slug or ID fallback
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodedId)
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .or(`slug.eq.${id}${isUUID ? `,id.eq.${id}` : ''}`)
    .single()

  if (eventError || !event) return notFound()

  return (
    <div className="flex h-screen bg-[#09090b] text-[#f4f4f5] font-sans overflow-hidden">
      <main className="flex-1 overflow-y-auto p-4 md:p-10 relative">
        <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full bg-blue-500/15 blur-[100px] z-0 pointer-events-none"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto">
          <Link href={`/admin/events/${event.slug || id}`} className="text-white/40 hover:text-white transition-colors flex items-center gap-2 text-sm font-semibold mb-8">
            <i className="fas fa-arrow-left"></i> Back to Event Details
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Edit Event: {event.title}</h1>
            <p className="text-white/40 text-sm">Make changes to the event configuration.</p>
          </div>

          <EditEventForm event={event} />
        </div>
      </main>
    </div>
  )
}
