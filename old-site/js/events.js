// js/events.js

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth state
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    document.getElementById('sandboxAuthPrompt').style.display = 'none';
    document.getElementById('sandboxContent').style.display = 'block';
  }

  loadActiveEvents();
  if (currentUser) {
    loadTeams();
  }
});

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag])
  );
}

async function loadActiveEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .neq('status', 'completed')
    .order('date_start', { ascending: true });

  if (error) {
    console.error('Error loading events:', error);
    return;
  }

  if (data && data.length > 0) {
    document.getElementById('activeEventsSection').style.display = 'block';
    const grid = document.getElementById('activeEventsGrid');
    grid.innerHTML = '';

    data.forEach(event => {
      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `
        <div class="event-date">
          <span class="month">${new Date(event.date_start).toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
          <span class="day">${new Date(event.date_start).getDate()}</span>
        </div>
        <div class="event-content">
          <h4>${event.title}</h4>
          <p>${event.description || ''}</p>
          <div class="event-details">
            <span class="event-time"><i class="fas fa-clock"></i> ${event.status}</span>
            <span class="event-location"><i class="fas fa-map-marker-alt"></i> ${event.location || 'TBA'}</span>
          </div>
          <button class="btn btn-primary" style="margin-top: 10px;" onclick="registerForEvent('${event.id}')">Register & Get Ticket</button>
        </div>
      `;
      grid.appendChild(card);
    });
  }
}

async function registerForEvent(eventId) {
  if (!currentUser) {
    alert('Please log in to register for events.');
    window.location.href = 'login.html';
    return;
  }

  // Generate hash payload
  const hashPayload = await generateHash(currentUser.id + eventId + new Date().toISOString());

  const { error } = await supabase
    .from('registrations')
    .insert([{
      user_id: currentUser.id,
      event_id: eventId,
      hash_payload: hashPayload
    }]);

  if (error) {
    if (error.code === '23505') {
      alert('You are already registered for this event!');
    } else {
      console.error(error);
      alert('Failed to register.');
    }
    return;
  }

  showQRModal(hashPayload);
}

async function generateHash(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function showQRModal(payload) {
  // Create modal dynamically
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '0'; modal.style.left = '0';
  modal.style.width = '100vw'; modal.style.height = '100vh';
  modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.zIndex = '9999';

  const content = document.createElement('div');
  content.style.background = '#fff';
  content.style.padding = '20px';
  content.style.borderRadius = '8px';
  content.style.textAlign = 'center';
  content.style.color = '#000';

  const title = document.createElement('h3');
  title.textContent = 'Your Event Ticket';
  
  const canvas = document.createElement('canvas');
  QRCode.toCanvas(canvas, payload, { width: 250 }, function (error) {
    if (error) console.error(error);
  });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.marginTop = '15px';
  closeBtn.style.padding = '8px 16px';
  closeBtn.onclick = () => document.body.removeChild(modal);

  content.appendChild(title);
  content.appendChild(canvas);
  content.appendChild(document.createElement('br'));
  content.appendChild(closeBtn);
  modal.appendChild(content);
  document.body.appendChild(modal);
}

async function loadTeams() {
  document.getElementById('teamsList').style.display = 'block';
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('looking_for_members', true);

  if (error) {
    console.error(error);
    return;
  }

  const grid = document.getElementById('teamsGrid');
  grid.innerHTML = '';
  if (data && data.length > 0) {
    data.forEach(team => {
      const safeName = escapeHTML(team.team_name);
      const safePitch = escapeHTML(team.project_pitch);

      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `
        <div class="event-content" style="padding: 15px;">
          <h4>${safeName}</h4>
          <p>${safePitch || 'No pitch provided.'}</p>
          <button class="btn btn-secondary" style="margin-top:10px;" onclick="requestJoin('${team.id}')">Request to Join</button>
        </div>
      `;
      grid.appendChild(card);
    });
  } else {
    grid.innerHTML = '<p>No teams are currently looking for members.</p>';
  }
}

window.requestJoin = async function(teamId) {
  if (!currentUser) return;
  alert('Request sent to team leader!');
  // Logic would append currentUser.id to pending_requests array of the team
}

document.getElementById('btnCreateTeam')?.addEventListener('click', async () => {
  const teamName = prompt("Enter your Team Name:");
  if (teamName) {
    // In a real flow, event_id would be selected. We use a placeholder logic.
    const { error } = await supabase.from('teams').insert([{
      team_name: teamName,
      leader_id: currentUser.id,
      project_pitch: "New Hackathon Project",
      looking_for_members: true
    }]);
    if (!error) {
      alert('Team created!');
      loadTeams();
    } else {
      alert('Failed to create team. (Make sure an active event exists and is selected in a full implementation)');
    }
  }
});
