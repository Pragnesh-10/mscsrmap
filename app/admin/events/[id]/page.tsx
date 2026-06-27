import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import RegistrationsTable from './RegistrationsTable'
import CSVImportBlock from './CSVImportBlock'

export const dynamic = 'force-dynamic'

export default async function AdminEventViewer({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  // Verify access (handled by proxy.ts but safe to check)
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return notFound()

  // Fetch user role
  const { data: profile } = await supabase
    .from('member_profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const userRole = profile?.role

  // Fetch Event by slug (or UUID fallback)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .or(`slug.eq.${id}${isUUID ? `,id.eq.${id}` : ''}`)
    .single()

  if (eventError || !event) return notFound()

  // Fetch all registrations using the verified event UUID
  const { data: registrations, error: regsError } = await supabase
    .from('registrations')
    .select('*')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex h-screen bg-[#09090b] text-[#f4f4f5] font-sans overflow-hidden">
      <main className="flex-1 overflow-y-auto p-4 md:p-10 relative">
        <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full bg-blue-500/15 blur-[100px] z-0 pointer-events-none"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto">
          <Link href="/admin" className="text-white/40 hover:text-white transition-colors flex items-center gap-2 text-sm font-semibold mb-8">
            <i className="fas fa-arrow-left"></i> Back to Dashboard
          </Link>

          <div className="bg-[#18181b]/60 backdrop-blur-xl border border-white/10 rounded-[20px] p-8 mb-8 shadow-2xl flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{event.title}</h1>
              <p className="text-white/40 text-sm">
                <i className="fas fa-calendar-alt mr-2 text-blue-400"></i> {new Date(event.date_start).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black bg-gradient-to-br from-blue-400 to-purple-400 bg-clip-text text-transparent">
                {registrations?.length || 0}
              </p>
              <p className="text-sm font-bold uppercase tracking-wider text-white/40">Total Registrations</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8 flex flex-wrap gap-4">
            <Link href={`/admin/events/${event.slug || id}/scanner`} className="px-6 py-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white rounded-xl font-bold transition-colors flex items-center gap-3">
              <i className="fas fa-qrcode"></i> Open Live Scanner
            </Link>
            {userRole === 'admin' && (
              <Link href={`/admin/events/${event.slug || id}/edit`} className="px-6 py-3 bg-white/5 text-white/80 border border-white/10 hover:bg-white/10 hover:text-white rounded-xl font-bold transition-colors flex items-center gap-3">
                <i className="fas fa-edit"></i> Edit Event Details
              </Link>
            )}
          </div>

          <CSVImportBlock eventId={event.id} />

          <RegistrationsTable registrations={registrations || []} eventTitle={event.title} eventId={event.id} />
        </div>
      </main>
    </div>
  )
}
