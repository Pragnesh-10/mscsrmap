import { createClient } from '@/utils/supabase/server';
import Navbar from '../components/Navbar';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function GalleryPage() {
  const supabase = await createClient();

  // Fetch events that have gallery URLs
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .order('date_start', { ascending: false });

  // Filter events to only those with non-empty gallery_urls
  const eventsWithGallery = (events || []).filter(evt => evt.gallery_urls && evt.gallery_urls.length > 0);

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans">
      <Navbar />

      <section className="pt-32 pb-16 px-6 relative">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none"></div>
        <div className="container mx-auto max-w-[1200px] relative z-10">
          <div className="mb-4 inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-bold tracking-widest uppercase text-blue-400">
            MSC SRMAP Visual Archive
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
            Event <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 font-serif italic">Gallery</span>
          </h1>
          <p className="text-white/50 max-w-2xl text-lg mb-12">
            A visual journey through our hackathons, workshops, and community meetups. Relive the best moments of MSC SRMAP.
          </p>

          {eventsWithGallery.length === 0 ? (
            <div className="py-20 text-center border border-white/5 bg-white/5 rounded-3xl">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-white/20">
                <i className="fas fa-images text-3xl"></i>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">No Photos Yet</h3>
              <p className="text-white/40">Check back later after our upcoming events!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-24">
              {eventsWithGallery.map((event) => {
                const galleryUrls = event.gallery_urls as string[];
                return (
                  <div key={event.id} id={`gallery-${event.slug || event.id}`} className="scroll-mt-32">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4 border-b border-white/10 pb-6">
                      <div>
                        <Link href={`/events/${event.slug || event.id}`} className="hover:text-blue-400 transition-colors">
                          <h2 className="text-3xl font-bold text-white mb-2">{event.title}</h2>
                        </Link>
                        <p className="text-white/50 text-sm flex items-center gap-2">
                          <i className="fas fa-calendar-alt"></i> 
                          {new Date(event.date_start).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long' })}
                          <span className="mx-2">•</span>
                          <span className="capitalize">{event.type || 'Event'}</span>
                        </p>
                      </div>
                      <Link href={`/events/${event.slug || event.id}`} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-bold text-white transition-all whitespace-nowrap">
                        View Event Details <i className="fas fa-arrow-right ml-1"></i>
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {galleryUrls.map((url, i) => (
                        <div key={i} className="group relative rounded-2xl overflow-hidden aspect-video bg-white/5 border border-white/10 cursor-pointer">
                          <img 
                            src={url} 
                            alt={`${event.title} photo ${i + 1}`} 
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                            <a href={url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-white/20 hover:bg-blue-500 backdrop-blur-md rounded-lg text-xs font-bold text-white transition-colors">
                              <i className="fas fa-expand mr-1"></i> View Full
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <footer className="py-12 border-t border-white/10 mt-12 bg-black/50">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <img src="https://lkbwunzswqbnoygxtilm.supabase.co/storage/v1/object/public/webpage/MSC%20Logo.png"
                alt="Microsoft Student Community Logo" className="h-12 w-auto" loading="lazy" decoding="async" />
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm text-white/50 mb-3">Connect with us</p>
              <div className="flex justify-center md:justify-end gap-5 text-white/70">
                <a href="https://linkedin.com/company/microsoft-student-community-srm-university/" target="_blank" rel="noreferrer" className="hover:text-white transition-colors"><i className="fab fa-linkedin text-xl"></i></a>
                <a href="mailto:msc.community@srmap.edu.in" target="_blank" rel="noreferrer" className="hover:text-white transition-colors"><i className="fa fa-envelope text-xl"></i></a>
                <a href="https://www.instagram.com/msc.srmap/?igsh=YmEwdnlteHUwNjVs#/" target="_blank" rel="noreferrer" className="hover:text-white transition-colors"><i className="fab fa-instagram text-xl"></i></a>
                <a href="https://discord.com/invite/wZ55nBhWtJ/" target="_blank" rel="noreferrer" className="hover:text-white transition-colors"><i className="fab fa-discord text-xl"></i></a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
