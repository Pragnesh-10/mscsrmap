document.addEventListener('DOMContentLoaded', () => {
    // Only load if supabase is initialized
    if (window.supabase) {
        loadPublicTeam();
        loadPublicEvents();
    }
});

async function loadPublicTeam() {
    const teamGrid = document.querySelector('.team-grid');
    
    if (!teamGrid) return;

    const { data: teamMembers, error } = await supabase
        .from('team_members')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error loading team:", error);
        return;
    }

    let teamHTML = '';

    teamMembers.forEach(member => {
        const fallbackImg = 'https://lkbwunzswqbnoygxtilm.supabase.co/storage/v1/object/public/webpage/MSC%20Logo.png';
        const img = member.image_url || fallbackImg;
        
        let cardHTML = `
            <div class="team-card" style="background: rgba(25, 25, 25, 0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 30px 20px; text-align: center; color: white; transition: transform 0.3s ease;">
                <img src="${img}" alt="${member.name}" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; margin-bottom: 20px; border: 3px solid #0078d4;">
                <h3 style="font-size: 1.4rem; margin-bottom: 5px; font-weight: 700;">${member.name}</h3>
                <p style="color: #0078d4; font-weight: 600; margin-bottom: 20px; font-size: 1rem; text-transform: uppercase; letter-spacing: 1px;">${member.role}</p>
                <div class="social-links" style="display: flex; justify-content: center; gap: 15px;">
                    ${member.linkedin_url ? `<a href="${member.linkedin_url}" target="_blank" style="color: #aaaaaa; font-size: 1.4rem; transition: color 0.3s;" onmouseover="this.style.color='white'" onmouseout="this.style.color='#aaaaaa'"><i class="fab fa-linkedin"></i></a>` : ''}
                    ${member.github_url ? `<a href="${member.github_url}" target="_blank" style="color: #aaaaaa; font-size: 1.4rem; transition: color 0.3s;" onmouseover="this.style.color='white'" onmouseout="this.style.color='#aaaaaa'"><i class="fab fa-github"></i></a>` : ''}
                </div>
            </div>
        `;

        teamHTML += cardHTML;
    });

    if (teamGrid && teamHTML) teamGrid.innerHTML = teamHTML;
}

async function loadPublicEvents() {
    const activeEventsGrid = document.getElementById('activeEventsGrid');
    const activeEventsSection = document.getElementById('activeEventsSection');
    
    if (!activeEventsGrid) return;

    const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'upcoming')
        .order('date_start', { ascending: true });

    if (error || !events || events.length === 0) return;

    activeEventsSection.style.display = 'block';
    
    let html = '';
    events.forEach(evt => {
        let dateDisplay = 'TBA';
        if (evt.date_start) {
            const d = new Date(evt.date_start);
            const month = d.toLocaleString('default', { month: 'short' }).toUpperCase();
            const day = d.getDate();
            dateDisplay = `
                <div class="event-date" style="background: #0078d4; padding: 20px; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 90px;">
                    <span class="month" style="font-size: 1rem; font-weight: 600; text-transform: uppercase;">${month}</span>
                    <span class="day" style="font-size: 2.2rem; font-weight: 800;">${day}</span>
                </div>
            `;
        }
        
        html += `
          <div class="event-card" style="background: rgba(25, 25, 25, 0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; overflow: hidden; display: flex; flex-direction: row;">
            ${dateDisplay !== 'TBA' ? dateDisplay : '<div class="event-date" style="background:#0078d4; padding:20px; color:white; display:flex; align-items:center; min-width:90px;">TBA</div>'}
            <div class="event-content" style="padding: 25px; color: white; flex: 1;">
              <h4 style="margin-bottom: 10px; font-size: 1.4rem; font-weight: 700;">${evt.title}</h4>
              <p style="color: #aaaaaa; margin-bottom: 15px; font-size: 1rem; line-height: 1.6;">${evt.description}</p>
              ${evt.image_url ? `<img src="${evt.image_url}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin-top: 15px;">` : ''}
            </div>
          </div>
        `;
    });
    
    activeEventsGrid.innerHTML = html;
}
