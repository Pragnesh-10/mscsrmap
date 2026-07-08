import { Resend } from 'resend';

// Initialize Resend with the API key from environment variables
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface EmailPayload {
  to: string;
  name: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  status: 'confirmed' | 'waitlisted';
  hashPayload: string;
  isTeam: boolean;
  teamName?: string;
  teamMembers?: Array<{ name?: string; fullName?: string; email: string }>;
}

/**
 * Sends a registration confirmation email using Resend.
 * Fallbacks gracefully if Resend API key is not configured.
 */
export async function sendRegistrationEmail(payload: EmailPayload) {
  if (!resend) {
    console.warn('⚠️ RESEND_API_KEY is not set. Registration email was not sent. Payload:', payload);
    return { success: false, error: 'RESEND_API_KEY is not set' };
  }

  const {
    to,
    name,
    eventTitle,
    eventDate,
    eventLocation,
    status,
    hashPayload,
    isTeam,
    teamName,
    teamMembers
  } = payload;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mscsrmap.edu.in';
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(hashPayload)}`;
  const ticketUrl = `${appUrl}/events?recovered_email=${encodeURIComponent(to)}`;

  const isConfirmed = status === 'confirmed';
  const statusColor = isConfirmed ? '#22c55e' : '#eab308';
  const statusBackground = isConfirmed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)';
  const statusBorder = isConfirmed ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)';
  const statusText = isConfirmed ? 'CONFIRMED' : 'WAITLISTED';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Registration Confirmation - ${eventTitle}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #0a0a0b;
            color: #f4f4f5;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #18181b;
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          }
          .gradient-bar {
            height: 6px;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          }
          .content {
            padding: 40px;
          }
          .logo {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo img {
            height: 48px;
            width: auto;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header p {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 3px;
            color: rgba(255, 255, 255, 0.4);
            text-transform: uppercase;
            margin: 0 0 10px 0;
          }
          .header h1 {
            font-size: 28px;
            font-weight: 800;
            color: #ffffff;
            margin: 0;
            letter-spacing: -0.5px;
          }
          .badge-container {
            text-align: center;
            margin-bottom: 30px;
          }
          .badge {
            display: inline-block;
            padding: 8px 16px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 1.5px;
            border-radius: 100px;
            color: ${statusColor};
            background-color: ${statusBackground};
            border: 1px solid ${statusBorder};
          }
          .greeting {
            font-size: 16px;
            line-height: 1.6;
            color: rgba(255, 255, 255, 0.7);
            margin-bottom: 25px;
          }
          .greeting strong {
            color: #ffffff;
          }
          .card {
            background-color: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 30px;
          }
          .card-title {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 1px;
            color: rgba(255, 255, 255, 0.4);
            text-transform: uppercase;
            margin: 0 0 15px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            padding-bottom: 8px;
          }
          .detail-row {
            display: flex;
            margin-bottom: 12px;
            font-size: 14px;
          }
          .detail-row:last-child {
            margin-bottom: 0;
          }
          .detail-label {
            width: 100px;
            color: rgba(255, 255, 255, 0.4);
            font-weight: 500;
          }
          .detail-value {
            flex: 1;
            color: rgba(255, 255, 255, 0.85);
            font-weight: 600;
          }
          .ticket-section {
            text-align: center;
            background-color: rgba(0, 0, 0, 0.3);
            border: 1px dashed rgba(255, 255, 255, 0.15);
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 30px;
          }
          .qr-code {
            background-color: #ffffff;
            padding: 15px;
            border-radius: 16px;
            display: inline-block;
            margin-bottom: 20px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
          }
          .qr-code img {
            display: block;
            width: 180px;
            height: 180px;
          }
          .ticket-info h4 {
            margin: 0 0 5px 0;
            font-size: 16px;
            font-weight: 700;
            color: #ffffff;
          }
          .ticket-info p {
            margin: 0;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.4);
            font-family: monospace;
          }
          .btn {
            display: inline-block;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6);
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 28px;
            font-size: 14px;
            font-weight: 700;
            border-radius: 12px;
            margin-top: 20px;
            box-shadow: 0 10px 20px rgba(59, 130, 246, 0.2);
            transition: all 0.2s ease;
          }
          .footer {
            text-align: center;
            padding: 30px 40px;
            background-color: #0f0f11;
            border-top: 1px solid rgba(255, 255, 255, 0.03);
            font-size: 12px;
            color: rgba(255, 255, 255, 0.35);
          }
          .footer p {
            margin: 0 0 10px 0;
          }
          .footer p:last-child {
            margin-bottom: 0;
          }
          .footer a {
            color: #3b82f6;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="gradient-bar"></div>
          <div class="content">
            <div class="logo">
              <img src="https://lkbwunzswqbnoygxtilm.supabase.co/storage/v1/object/public/webpage/MSC%20Logo.png" alt="Microsoft Student Community Logo">
            </div>
            
            <div class="header">
              <p>SRM University AP</p>
              <h1>Registration ${isConfirmed ? 'Confirmed' : 'Waitlisted'}</h1>
            </div>

            <div class="badge-container">
              <span class="badge">${statusText}</span>
            </div>

            <div class="greeting">
              Hi <strong>${name}</strong>,<br><br>
              ${isConfirmed 
                ? `Your registration for <strong>${eventTitle}</strong> has been successfully confirmed! We are thrilled to have you join us. Here are your event details and entry pass.`
                : `Thank you for your interest in <strong>${eventTitle}</strong>. You have been added to the waitlist. We will notify you if a slot opens up!`
              }
            </div>

            <div class="card">
              <h3 class="card-title">Event Details</h3>
              <div class="detail-row">
                <div class="detail-label">Event</div>
                <div class="detail-value">${eventTitle}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Date</div>
                <div class="detail-value">${eventDate}</div>
              </div>
              ${eventLocation ? `
              <div class="detail-row">
                <div class="detail-label">Location</div>
                <div class="detail-value">${eventLocation}</div>
              </div>
              ` : ''}
              ${isTeam && teamName ? `
              <div class="detail-row" style="margin-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 12px;">
                <div class="detail-label">Team Name</div>
                <div class="detail-value" style="color: #c084fc;">${teamName}</div>
              </div>
              ` : ''}
              ${isTeam && teamMembers && teamMembers.length > 0 ? `
              <div class="detail-row">
                <div class="detail-label">Members</div>
                <div class="detail-value" style="font-size: 13px; font-weight: normal; color: rgba(255, 255, 255, 0.65);">
                  ${teamMembers.map(m => `${m.fullName || m.name || 'Participant'} (${m.email})`).join('<br>')}
                </div>
              </div>
              ` : ''}
            </div>

            ${isConfirmed ? `
            <div class="ticket-section">
              <div class="qr-code">
                <img src="${qrCodeUrl}" alt="Event Ticket QR Code">
              </div>
              <div class="ticket-info">
                <h4>Your Entry Pass</h4>
                <p>${hashPayload}</p>
                <span style="display: block; font-size: 12px; color: rgba(255, 255, 255, 0.5); margin-top: 10px; line-height: 1.4;">
                  Please present this QR code at the check-in desk for entry verification.
                </span>
              </div>
            </div>
            ` : ''}

            <div style="text-align: center;">
              <a href="${ticketUrl}" class="btn">View Ticket Online</a>
            </div>
          </div>
          
          <div class="footer">
            <p>Microsoft Student Community • SRM University AP</p>
            <p>Have questions? Reply to this email or reach out to us at <a href="mailto:msc.community@srmap.edu.in">msc.community@srmap.edu.in</a></p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const data = await resend.emails.send({
      from: 'Microsoft Student Community <noreply@mscsrmap.edu.in>',
      to: [to],
      subject: `Registration ${isConfirmed ? 'Confirmed' : 'Waitlisted'}: ${eventTitle}`,
      html: html,
    });
    console.log(`✉️ Email successfully sent to ${to} via Resend. ID:`, data);
    return { success: true, data };
  } catch (error) {
    console.error(`❌ Failed to send registration email to ${to}:`, error);
    return { success: false, error };
  }
}

interface TeamJoinPayload {
  to: string;
  leaderName: string;
  teamName: string;
  eventTitle: string;
  newMemberName: string;
  newMemberEmail: string;
}

export async function sendTeamJoinNotificationEmail(payload: TeamJoinPayload) {
  if (!resend) {
    console.warn('⚠️ RESEND_API_KEY is not set. Notification email was not sent. Payload:', payload);
    return { success: false, error: 'RESEND_API_KEY is not set' };
  }

  const {
    to,
    leaderName,
    teamName,
    eventTitle,
    newMemberName,
    newMemberEmail,
  } = payload;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>New Team Member Joined - ${teamName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #0a0a0b; color: #f4f4f5; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #18181b; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 30px; }
          h2 { color: #ffffff; }
          p { color: rgba(255, 255, 255, 0.7); line-height: 1.6; }
          .highlight { color: #c084fc; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>New Team Member Alert!</h2>
          <p>Hi <strong>${leaderName || 'Team Leader'}</strong>,</p>
          <p>Great news! A new member has just joined your team <span class="highlight">${teamName}</span> for the event <strong>${eventTitle}</strong>.</p>
          <div style="background-color: rgba(0, 0, 0, 0.2); border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>New Member Details:</strong></p>
            <p style="margin: 5px 0 0 0;">Name: ${newMemberName || 'Participant'}</p>
            <p style="margin: 5px 0 0 0;">Email: <a href="mailto:${newMemberEmail}" style="color: #3b82f6;">${newMemberEmail}</a></p>
          </div>
          <p>Feel free to reach out and welcome them to the team!</p>
          <p style="margin-top: 30px; font-size: 12px; color: rgba(255, 255, 255, 0.4);">
            Microsoft Student Community • SRM University AP
          </p>
        </div>
      </body>
    </html>
  `;

  try {
    const data = await resend.emails.send({
      from: 'Microsoft Student Community <noreply@mscsrmap.edu.in>',
      to: [to],
      subject: `New Team Member Joined: ${teamName} (${eventTitle})`,
      html: html,
    });
    console.log(`✉️ Team join notification sent to ${to} via Resend. ID:`, data);
    return { success: true, data };
  } catch (error) {
    console.error(`❌ Failed to send team join notification to ${to}:`, error);
    return { success: false, error };
  }
}
