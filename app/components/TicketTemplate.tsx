import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface TicketProps {
  eventTitle: string;
  eventDate?: string;
  eventTime?: string;
  eventVenue?: string;
  eventType?: string;
  posterUrl?: string;
  name?: string;
  email?: string;
  registrationId: string;
  collegeName?: string;
  qrCodeUrl: string;
  teamName?: string;
  teamMembers?: number;
  registrationType?: string;
}

export const TicketTemplate = forwardRef<HTMLDivElement, TicketProps>(({
  eventTitle,
  eventDate = 'TBD',
  eventTime = 'TBD',
  eventVenue = 'TBD',
  eventType = 'Event',
  posterUrl,
  name = '-',
  email = 'msc.srmap@outlook.com',
  registrationId,
  collegeName = 'SRM University AP',
  qrCodeUrl,
  teamName,
  teamMembers,
  registrationType = 'Individual'
}, ref) => {
  return (
    <div
      ref={ref}
      style={{
        width: '400px',
        background: '#F3F5F8',
        padding: '20px',
        fontFamily: "'Inter', sans-serif",
        display: 'flex',
        justifyContent: 'center'
      }}
    >
      <div style={{
        width: '100%',
        background: '#FFFFFF',
        borderRadius: '24px',
        boxShadow: '0 10px 35px rgba(0,0,0,.08)',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Cutouts */}
        <div style={{ position: 'absolute', width: '24px', height: '24px', background: '#F3F5F8', borderRadius: '50%', left: '-12px', top: '160px' }}></div>
        <div style={{ position: 'absolute', width: '24px', height: '24px', background: '#F3F5F8', borderRadius: '50%', right: '-12px', top: '160px' }}></div>
        
        <div style={{ position: 'absolute', width: '24px', height: '24px', background: '#F3F5F8', borderRadius: '50%', left: '-12px', top: '380px' }}></div>
        <div style={{ position: 'absolute', width: '24px', height: '24px', background: '#F3F5F8', borderRadius: '50%', right: '-12px', top: '380px' }}></div>
        
        <div style={{ position: 'absolute', width: '24px', height: '24px', background: '#F3F5F8', borderRadius: '50%', left: '-12px', bottom: '260px' }}></div>
        <div style={{ position: 'absolute', width: '24px', height: '24px', background: '#F3F5F8', borderRadius: '50%', right: '-12px', bottom: '260px' }}></div>

        {/* Header Section */}
        <div style={{ padding: '24px', display: 'flex', height: '170px', boxSizing: 'border-box', position: 'relative' }}>
          <div style={{ width: '90px', height: '120px', borderRadius: '18px', overflow: 'hidden', flexShrink: 0, marginRight: '16px', background: '#e0e0e0', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
            <img src={posterUrl || 'https://placehold.co/90x120?text=Event'} alt="Poster" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, paddingRight: '20px' }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 700, color: '#000', lineHeight: 1.2 }}>{eventTitle}</h2>
            <span style={{ fontSize: '13px', color: '#5E5E5E', marginBottom: '8px', fontWeight: 500 }}>Offline Event</span>
            
            <div style={{ fontSize: '13px', color: '#5E5E5E', marginBottom: '4px', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '6px' }}>📅</span> {eventDate}
            </div>
            <div style={{ fontSize: '13px', color: '#5E5E5E', marginBottom: '4px', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '6px' }}>🕒</span> {eventTime}
            </div>
            <div style={{ fontSize: '13px', color: '#5E5E5E', marginBottom: '4px', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '6px' }}>📍</span> {eventVenue}
            </div>
            <div style={{ fontSize: '13px', color: '#5E5E5E', marginBottom: '4px', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '6px' }}>🎟</span> {eventType}
            </div>
          </div>
          <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%) rotate(90deg)', transformOrigin: 'center right', color: '#0078D4', fontWeight: 700, fontSize: '12px', letterSpacing: '2px', opacity: 0.8 }}>
            MSC TICKET
          </div>
        </div>

        {/* Hide Details Bar (Static for image gen) */}
        <div style={{ height: '55px', backgroundColor: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5E5E5E', fontSize: '12px', fontWeight: 500, borderTop: '1px dashed #E7E7E7', borderBottom: '1px dashed #E7E7E7', flexDirection: 'column' }}>
          <span style={{ fontSize: '14px', marginBottom: '-4px' }}>⌃</span>
          <span>Tap to hide details</span>
        </div>

        {/* Ticket Section */}
        <div style={{ textAlign: 'center', padding: '30px 20px' }}>
          <p style={{ color: '#5E5E5E', fontSize: '18px', margin: '0 0 10px 0', fontWeight: 500 }}>1 Registration</p>
          <h1 style={{ margin: 0, fontSize: '42px', fontWeight: 800, color: '#000', letterSpacing: '-0.5px' }}>GENERAL ENTRY</h1>
        </div>

        {/* QR Section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px 30px' }}>
          <div style={{ width: '250px', height: '250px', background: 'white', borderRadius: '20px', padding: '10px', boxShadow: '0 2px 15px rgba(0,0,0,0.05)', marginBottom: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <QRCodeSVG value={qrCodeUrl} size={230} level="H" />
          </div>
          <p style={{ color: '#5E5E5E', fontSize: '12px', fontWeight: 600, letterSpacing: '1px', margin: '0 0 4px 0' }}>BOOKING ID:</p>
          <p style={{ color: '#0078D4', fontSize: '24px', fontWeight: 700, margin: 0 }}>MSC{registrationId.substring(0, 7).toUpperCase()}</p>
        </div>

        {/* Notice Card */}
        <div style={{ margin: '0 24px 24px', backgroundColor: '#EEF6FF', border: '1px solid rgba(0, 120, 212, 0.2)', borderRadius: '18px', padding: '16px', display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#0078D4', fontSize: '18px', marginRight: '12px' }}>ℹ</span>
          <p style={{ margin: 0, color: '#000', fontSize: '14px', fontWeight: 500 }}>Please show this QR code during registration.</p>
        </div>

        {/* Contact Support */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ marginRight: '8px', fontSize: '16px', color: '#5E5E5E' }}>✉</span>
            <h4 style={{ margin: 0, color: '#5E5E5E', fontSize: '14px', fontWeight: 500 }}>Contact Support</h4>
          </div>
          <p style={{ margin: 0, color: '#0078D4', fontWeight: 600, fontSize: '16px' }}>msc.community@srmap.edu.in</p>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '2px dashed #E7E7E7', margin: '0 24px', position: 'relative' }}></div>

        {/* Team Details Section */}
        <div style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '22px', fontWeight: 700, color: '#000' }}>Registration Details</h3>
          
          {teamName && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                <div style={{ color: '#5E5E5E', fontSize: '14px', fontWeight: 500 }}><span style={{ marginRight: '12px' }}>👥</span> Team Name</div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#000', textAlign: 'right' }}>{teamName}</div>
              </div>
              <div style={{ height: '1px', backgroundColor: '#E7E7E7', opacity: 0.5 }}></div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
            <div style={{ color: '#5E5E5E', fontSize: '14px', fontWeight: 500 }}><span style={{ marginRight: '12px' }}>👤</span> {teamName ? 'Team Leader' : 'Attendee'}</div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#000', textAlign: 'right' }}>{name}</div>
          </div>
          <div style={{ height: '1px', backgroundColor: '#E7E7E7', opacity: 0.5 }}></div>

          {teamMembers && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
                <div style={{ color: '#5E5E5E', fontSize: '14px', fontWeight: 500 }}><span style={{ marginRight: '12px' }}>👥</span> Members</div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#000', textAlign: 'right' }}>{teamMembers}</div>
              </div>
              <div style={{ height: '1px', backgroundColor: '#E7E7E7', opacity: 0.5 }}></div>
            </>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
            <div style={{ color: '#5E5E5E', fontSize: '14px', fontWeight: 500 }}><span style={{ marginRight: '12px' }}>📝</span> Type</div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#000', textAlign: 'right' }}>{registrationType}</div>
          </div>
          <div style={{ height: '1px', backgroundColor: '#E7E7E7', opacity: 0.5 }}></div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
            <div style={{ color: '#5E5E5E', fontSize: '14px', fontWeight: 500 }}><span style={{ marginRight: '12px' }}>🏫</span> College</div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#000', textAlign: 'right' }}>{collegeName}</div>
          </div>
        </div>

      </div>
    </div>
  );
});

TicketTemplate.displayName = 'TicketTemplate';
