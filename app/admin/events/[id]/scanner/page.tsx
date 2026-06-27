import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRScanner from '@/app/admin/QRScanner'

export const dynamic = 'force-dynamic'

export default async function EventScannerPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  // Verify access (handled by proxy.ts but safe to check)
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return notFound()

  // Fetch Event by slug or ID fallback
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, title, date_start, slug')
    .or(`slug.eq.${id}${isUUID ? `,id.eq.${id}` : ''}`)
    .single()

  if (eventError || !event) return notFound()

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans overflow-hidden flex flex-col items-center pt-20 p-6">
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-[150px] z-0 pointer-events-none"></div>
      
      <div className="relative z-10 max-w-xl w-full">
        <Link href={`/admin/events/${event.slug || id}`} className="text-white/40 hover:text-white transition-colors flex items-center gap-2 text-sm font-semibold mb-8">
          <i className="fas fa-arrow-left"></i> Back to Event
        </Link>
        
        <div className="mb-8 text-center bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="inline-block px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-4">
            Dedicated Scanner
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{event.title}</h1>
          <p className="text-white/40 text-sm">
            <i className="fas fa-calendar-alt mr-2"></i> {new Date(event.date_start).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' })}
          </p>
        </div>

        <QRScanner eventId={event.id} />
      </div>
    </div>
  )
}
