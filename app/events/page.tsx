import { createClient } from '@/utils/supabase/server';
import Navbar from '../components/Navbar';
import BackgroundVideo from '../components/BackgroundVideo';
import './events.css';
import Link from 'next/link';
import EventsClientLogic from './EventsClientLogic';

// Disable caching for this route so it updates when new events are added
export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const supabase = await createClient();

  // Fetch events from Supabase
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .order('date_start', { ascending: false });

  // Fallback to empty array if no events
  const safeEvents = events || [];

  return (
    <div className="events-page text-[#ededed]">
      <canvas id="canvas-particles"></canvas>

      <BackgroundVideo
        id="bgVideo"
        src="https://lkbwunzswqbnoygxtilm.supabase.co/storage/v1/object/public/webpage/Microsoft_Student_Community_Title_Card.mp4"
        className="background-video"
      />

      <Navbar />

      <section className="events-header-section">
        <div className="container mx-auto px-6">
          <div className="events-eyebrow-wrap">
            <span className="events-eyebrow-accent"></span>
            <span className="events-eyebrow-tag">MSC SRMAP ARCHIVE</span>
          </div>
          <h1 className="events-main-title">
            The <span className="title-serif-italic">Chronicles</span> of Build
          </h1>
          <p className="events-intro-text">
            A premium record of our technical coding bootcamps, developer hackathons, and open source workshops.
          </p>
        </div>
      </section>

      <section id="events" style={{ position: 'relative', padding: '2rem 0 6rem' }}>
        <div className="container mx-auto px-6 max-w-[1200px]">
          
          <div className="featured-event-hero glow-card">
            <div className="featured-hero-visual">
              <img src="featured_event_banner.png" alt="Microsoft Student Community banner" className="featured-hero-img" />
              <div className="featured-overlay-grad"></div>
              <div className="featured-status-badge" style={{ borderColor: 'rgba(0, 120, 212, 0.4)', color: 'var(--blue)' }}>
                <div className="pulse-dot" style={{ background: 'var(--blue)', boxShadow: '0 0 10px var(--blue-glow)', animation: 'pulseBlue 2s infinite' }}></div> ANNOUNCEMENT
              </div>
            </div>
            <div className="featured-hero-content">
              <div className="featured-meta">
                <span className="featured-date">STAY TUNED</span>
                <span className="featured-type">Next Event Brewing</span>
              </div>
              <h3 className="featured-title">Something Big is Coming</h3>
              <p className="featured-desc">We are currently planning our next major technical hackathon and hands-on workshop series. Connect with us on Discord and LinkedIn to be the first to know when registrations open!</p>
              <a href="https://discord.com/invite/wZ55nBhWtJ/" target="_blank" rel="noreferrer" className="featured-cta-btn">Join Discord <i className="fa-brands fa-discord"></i></a>
            </div>
          </div>

          <div className="events-filter-bar">
            <button className="filter-btn active" data-filter="all">All Events</button>
            <button className="filter-btn" data-filter="hackathon">Hackathons</button>
            <button className="filter-btn" data-filter="workshop">Workshops</button>
          </div>

          <div className="events-list-container">
            {safeEvents.map(event => {
              const startDate = new Date(event.date_start);
              const month = startDate.toLocaleString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }).toUpperCase();
              let dayStr = startDate.toLocaleString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' });

              // If there's an end date, calculate range formatting
              if (event.date_end && event.date_end !== event.date_start) {
                const endDate = new Date(event.date_end);
                const endDay = endDate.toLocaleString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' });
                const endMonth = endDate.toLocaleString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }).toUpperCase();
                
                // If months differ, format as OCT-NOV, else just OCT
                // If months differ, we might want to just show start month or both
                // Here we'll just append it to the day for simplicity if needed, 
                // but standard formatting: range = "1-2"
                dayStr = `${dayStr}-${endDay}`;
              }

              const isPast = event.status === 'completed';

              return (
                <div key={event.id} className="event-cassette glow-card" data-category={event.type || 'all'}>
                  <div className="event-cassette-row">
                    <div className="event-date-col">
                      <span className="event-month-lbl">{month}</span>
                      <span className={`event-day-lbl ${dayStr.includes('-') ? 'range' : ''}`}>{dayStr}</span>
                    </div>
                    <div className="event-info-col">
                      <div className="event-info-header">
                        <h3>{event.title}</h3>
                        <span className="event-cat-tag">{event.type || 'Event'}</span>
                      </div>
                      <p className="event-lead-desc">
                        {event.description}
                      </p>
                      <div className="event-meta-strip">
                        <span className="event-meta-item">
                          <i className={isPast ? "fas fa-calendar-check" : "fas fa-clock"}></i> 
                          {isPast ? 'Completed' : 'Upcoming'}
                        </span>
                        {event.location && (
                          <span className="event-meta-item">
                            <i className="fas fa-map-marker-alt"></i> {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="event-toggle-col">
                      <span className="indicator-arrow"><i className="fas fa-chevron-down"></i></span>
                    </div>
                  </div>
                  
                  {/* Expandable drawer details */}
                  <div className="event-summary-drawer">
                    <div className="event-drawer-content">
                      <div className="drawer-poster-frame">
                        {/* Placeholder image for dynamically fetched events, you can map real ones if in DB */}
                        <img 
                          src={event.image_url || "https://lkbwunzswqbnoygxtilm.supabase.co/storage/v1/object/public/webpage/hackmsc1.jpg"} 
                          alt={`${event.title} banner`} 
                        />
                      </div>
                      <div className="event-summary-left">
                        <h4>Event Summary</h4>
                        <p>
                          {event.long_description || event.description || "Join us to explore and learn together!"}
                        </p>
                        <div className="event-actions-row">
                          <Link href={`/gallery#gallery-${event.slug || event.id}`} className="gallery-link">
                            View Event Photos <i className="fa-solid fa-arrow-right"></i>
                          </Link>
                          <Link href={`/events/${event.slug || event.id}`} className="event-portal-link">
                            Open Event Portal <i className="fa-solid fa-up-right-from-square"></i>
                          </Link>
                        </div>
                      </div>
                      <div className="event-summary-right">
                        <div className="blueprint-console">
                          <div className="blueprint-console-header">
                            <span>SYS_BLUEPRINT_LOG</span>
                            <span className="console-green-val">ONLINE</span>
                          </div>
                          <div className="blueprint-row">
                            <span className="blueprint-lbl">Status:</span>
                            <span className="blueprint-val">{isPast ? 'Archived' : 'Active'}</span>
                          </div>
                          <div className="blueprint-row">
                            <span className="blueprint-lbl">Category:</span>
                            <span className="blueprint-val capitalize">{event.type || 'General'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
      
      {/* Client-side interactions */}
      <EventsClientLogic />
    </div>
  );
}
