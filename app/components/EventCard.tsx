'use client'

import React from 'react'

export default function EventCard({ event, isPast }: { event: any, isPast: boolean }) {
  const date = new Date(event.date_start)
  const month = date.toLocaleString('default', { month: 'short' }).toUpperCase()
  const day = date.getDate()

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
          {!isPast && (
            <a href={`/events/${event.slug || event.id}`} className="gallery-link" onClick={e => e.stopPropagation()}>
              Register Now <i className="fa-solid fa-arrow-right"></i>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
