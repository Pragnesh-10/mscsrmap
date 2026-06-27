'use client'

import React from 'react'

export default function EventCard({ event, isPast }: { event: any, isPast: boolean }) {
  const date = new Date(event.date_start)
  const month = date.toLocaleString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }).toUpperCase()
  const day = parseInt(date.toLocaleString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' }), 10)

  return (
    <div 
      className={`event-card ${isPast ? 'past-event' : ''}`}
      onClick={(e) => e.currentTarget.classList.toggle('expanded')}
    >
      <div className="event-date">
        <span className="month">{month}</span>
        <span className="day">{day}</span>
      </div>
      <div className="event-content">
        <h4>{event.title}</h4>
        <p>{event.description}</p>
        <div className="event-details">
          {event.type && (event.type === 'hackathon' || event.type === 'workshop') && (
            <span className="event-type font-semibold capitalize flex items-center gap-1.5">
              <i className={event.type === 'hackathon' ? 'fa-solid fa-code text-purple-400' : 'fa-solid fa-chalkboard-user text-blue-400'}></i>
              <span className={event.type === 'hackathon' ? 'text-purple-400' : 'text-blue-400'}>{event.type}</span>
            </span>
          )}
          <span className="event-time">
            <i className="fas fa-clock"></i> {event.status === 'completed' ? 'Completed' : 'Upcoming'}
          </span>
          {event.location && (
            <span className="event-location">
              <i className="fas fa-map-marker-alt"></i> {event.location}
            </span>
          )}
        </div>
        
        {/* We can show an extra summary or link when expanded */}
        <div className="event-summary">
          <p>Join us to explore and learn together!</p>
          {isPast ? (
            <a href={`/events/${event.slug || event.id}`} className="gallery-link" onClick={e => e.stopPropagation()}>
              View Certificates & Details <i className="fa-solid fa-arrow-right"></i>
            </a>
          ) : (
            <a href={`/events/${event.slug || event.id}`} className="gallery-link" onClick={e => e.stopPropagation()}>
              Register Now <i className="fa-solid fa-arrow-right"></i>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
