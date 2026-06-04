// js/admin.js

// Show the admin content immediately
document.getElementById('admin-content').style.display = 'block';

// We now securely use the global `supabase` client initialized in supabase-config.js
// using the ANON key. Authentication state is automatically managed by the session.
const usersTableBody = document.getElementById('usersTableBody');

async function loadUsers() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    usersTableBody.innerHTML = `<tr><td colspan="3" style="color:#ff5555;">Please log in as an administrator to view this page.</td></tr>`;
    const form = document.getElementById('createUserForm');
    if (form) form.style.display = 'none';
    return;
  }

  // Fetch users. RLS will allow reading all profiles if authenticated.
  const { data, error } = await supabase
    .from('member_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    usersTableBody.innerHTML = `<tr><td colspan="3" style="color:#ff5555;">Error loading users: ${error.message}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    usersTableBody.innerHTML = `<tr><td colspan="3">No users found.</td></tr>`;
    return;
  }

  usersTableBody.innerHTML = '';
  data.forEach(user => {
    // Basic HTML escaping for email to prevent XSS
    const safeEmail = user.email.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${safeEmail}</td>
      <td>
        <select id="role_${user.id}" style="padding: 6px; border-radius: 4px; background: rgba(0,0,0,0.3); color: white; border: 1px solid rgba(255,255,255,0.2);" ${user.role === 'admin' ? 'disabled' : ''}>
          <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
          <option value="core_member" ${user.role === 'core_member' ? 'selected' : ''}>Core Member</option>
          ${user.role === 'admin' ? '<option value="admin" selected>Admin</option>' : ''}
        </select>
      </td>
      <td style="text-align: right; white-space: nowrap;">
        <button class="btn-edit" onclick="changeUserPassword('${user.id}', '${safeEmail}')" ${user.role === 'admin' && user.id !== session.user.id ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>Change Password</button>
        <button class="btn-update" style="padding: 10px 16px; margin-left: 5px;" onclick="updateUserRole('${user.id}')" ${user.role === 'admin' ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>Update Access</button>
        <div class="status-msg" id="msg_${user.id}" style="margin-top: 5px; display: block; text-align: right;"></div>
      </td>
    `;
    usersTableBody.appendChild(tr);
  });
}

window.updateUserRole = async function(userId) {
  const newRole = document.getElementById(`role_${userId}`).value;
  const msgSpan = document.getElementById(`msg_${userId}`);
  
  msgSpan.textContent = 'Updating...';
  msgSpan.style.color = '#aaaaaa';
  msgSpan.classList.add('show');

  const { error } = await supabase.rpc('set_user_roles', {
    target_user_id: userId,
    new_role: newRole
  });

  if (error) {
    msgSpan.textContent = 'Failed: ' + (error.message || 'Access Denied');
    msgSpan.style.color = '#ff5555';
    console.error(error);
  } else {
    msgSpan.textContent = 'Updated!';
    msgSpan.style.color = '#55ff55';
    setTimeout(() => {
      msgSpan.classList.remove('show');
    }, 2000);
  }
};

window.changeUserPassword = async function(userId, email) {
  const newPassword = prompt(`Enter new password for ${email}:`);
  if (!newPassword) return;
  if (newPassword.length < 6) {
    alert('Password must be at least 6 characters.');
    return;
  }

  const msgSpan = document.getElementById(`msg_${userId}`);
  msgSpan.textContent = 'Updating password...';
  msgSpan.style.color = '#aaaaaa';
  msgSpan.classList.add('show');

  const { data: { session } } = await supabase.auth.getSession();
  let errorMsg = null;

  if (session && session.user.id === userId) {
    // Admin changing their OWN password natively
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    errorMsg = error ? error.message : null;
  } else {
    // Admin changing someone ELSE's password via secure RPC
    const { error } = await supabase.rpc('admin_change_password', {
      target_user_id: userId,
      new_password: newPassword
    });
    errorMsg = error ? error.message : null;
  }

  if (errorMsg) {
    msgSpan.textContent = 'Failed: ' + errorMsg;
    msgSpan.style.color = '#ff5555';
    console.error(errorMsg);
  } else {
    msgSpan.textContent = 'Password Updated!';
    msgSpan.style.color = '#55ff55';
    setTimeout(() => {
      msgSpan.classList.remove('show');
    }, 3000);
  }
};

document.getElementById('btnCreateUser')?.addEventListener('click', async () => {
  const emailInput = document.getElementById('newEmail');
  const passwordInput = document.getElementById('newPassword');
  const roleInput = document.getElementById('newUserRole');
  const statusSpan = document.getElementById('createStatus');
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  if (!email || !password) {
    alert("Please enter both email and password.");
    return;
  }
  
  if (password.length < 6) {
    alert("Password must be at least 6 characters.");
    return;
  }

  statusSpan.textContent = 'Creating account...';
  statusSpan.style.color = '#aaaaaa';
  statusSpan.classList.add('show');

  try {
    // We use a temporary client so signUp doesn't log the admin out!
    const tempClient = window.supabaseFactory.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data, error } = await tempClient.auth.signUp({
      email: email,
      password: password
    });

    if (error) {
      statusSpan.textContent = 'Failed: ' + error.message;
      statusSpan.style.color = '#ff5555';
      console.error("SignUp Error:", error);
      return;
    } 
    
    if (!data.user) {
      statusSpan.textContent = 'Failed: Unknown error, no user returned.';
      statusSpan.style.color = '#ff5555';
      return;
    }

    if (data.user.identities && data.user.identities.length === 0) {
      statusSpan.textContent = 'Failed: This email already exists!';
      statusSpan.style.color = '#ffaa00';
      return;
    }

    // Elevate the newly created user using the MAIN admin session
    if (roleInput.value !== 'user') {
      const { error: elevateError } = await supabase.rpc('set_user_roles', {
        target_user_id: data.user.id,
        new_role: roleInput.value
      });
      if (elevateError) {
        statusSpan.textContent = 'Created, but elevation failed: ' + elevateError.message;
        statusSpan.style.color = '#ffaa00';
        console.error("Elevate Error:", elevateError);
        loadUsers();
        return;
      }
    }

    statusSpan.textContent = 'Account Created Successfully!';
    statusSpan.style.color = '#55ff55';
    emailInput.value = '';
    passwordInput.value = '';
    
    // Refresh the table
    loadUsers();
    
    setTimeout(() => {
      statusSpan.classList.remove('show');
    }, 3000);

  } catch (err) {
    statusSpan.textContent = 'Crash: ' + err.message;
    statusSpan.style.color = '#ff5555';
    console.error("Crash:", err);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // Ensure the supabase config script is loaded before calling loadUsers
  if (typeof supabase !== 'undefined') {
    loadUsers();
    loadEvents();
    loadTeam();
  } else {
    usersTableBody.innerHTML = `<tr><td colspan="3" style="color:#ff5555;">Database connection error.</td></tr>`;
  }
});

// --- TABS LOGIC ---
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    // Remove active class from all tabs and sections
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    
    // Add active class to clicked tab and corresponding section
    tab.classList.add('active');
    const target = tab.getAttribute('data-target');
    document.getElementById(target).classList.add('active');
  });
});

// --- EVENTS MANAGEMENT ---
let editingEventId = null;

async function loadEvents() {
  const tbody = document.getElementById('eventsTableBody');
  const { data, error } = await supabase.from('events').select('*').order('date_start', { ascending: false });
  
  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:#ffaa00;">Error: ${error.message}</td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#aaaaaa;">No events found.</td></tr>`;
    return;
  }
  
  tbody.innerHTML = '';
  data.forEach(evt => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${evt.title}</td>
      <td>${evt.date_start ? new Date(evt.date_start).toLocaleString() : 'TBA'}</td>
      <td><span class="status-pill status-${evt.status.toLowerCase()}">${evt.status}</span></td>
      <td style="text-align: right; white-space: nowrap;">
        <button class="btn-edit" onclick="editEvent('${evt.id}')">Edit</button>
        <button class="btn-delete" onclick="deleteEvent('${evt.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// --- UPLOAD HELPER ---
async function uploadImage(file, pathPrefix) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${pathPrefix}-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  
  const { data, error } = await supabase.storage.from('images').upload(fileName, file);
  if (error) throw error;
  
  const { data: publicData } = supabase.storage.from('images').getPublicUrl(fileName);
  return publicData.publicUrl;
}

let editingEventImageUrl = '';

document.getElementById('btnSaveEvent')?.addEventListener('click', async () => {
  const title = document.getElementById('eventTitle').value.trim();
  const date_start = document.getElementById('eventDate').value;
  const status = document.getElementById('eventStatus').value;
  const description = document.getElementById('eventDesc').value.trim();
  const imageFile = document.getElementById('eventImageFile').files[0];
  const statusMsg = document.getElementById('eventStatusMsg');
  
  if (!title || !date_start) {
    alert("Title and Date are required.");
    return;
  }
  
  statusMsg.textContent = 'Saving...';
  statusMsg.style.color = '#aaaaaa';
  statusMsg.classList.add('show');
  
  let image_url = editingEventImageUrl;
  if (imageFile) {
    try {
      statusMsg.textContent = 'Uploading image...';
      image_url = await uploadImage(imageFile, 'event');
    } catch (e) {
      statusMsg.textContent = 'Upload Error: ' + e.message;
      statusMsg.style.color = '#ff5555';
      return;
    }
  }
  
  statusMsg.textContent = 'Saving event...';
  
  const payload = { title, date_start, status, description, image_url };
  let res;
  
  if (editingEventId) {
    res = await supabase.from('events').update(payload).eq('id', editingEventId);
  } else {
    res = await supabase.from('events').insert([payload]);
  }
  
  if (res.error) {
    statusMsg.textContent = 'Error: ' + res.error.message;
    statusMsg.style.color = '#ff5555';
  } else {
    statusMsg.textContent = 'Event Saved!';
    statusMsg.style.color = '#55ff55';
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventDate').value = '';
    document.getElementById('eventDesc').value = '';
    document.getElementById('eventImageFile').value = '';
    editingEventId = null;
    editingEventImageUrl = '';
    document.getElementById('btnSaveEvent').textContent = 'Save Event';
    loadEvents();
  }
  
  setTimeout(() => statusMsg.classList.remove('show'), 3000);
});

window.editEvent = async (id) => {
  const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
  if (data) {
    document.getElementById('eventTitle').value = data.title || '';
    if (data.date_start) {
      // format for datetime-local
      const d = new Date(data.date_start);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      document.getElementById('eventDate').value = d.toISOString().slice(0,16);
    }
    document.getElementById('eventStatus').value = data.status || 'upcoming';
    document.getElementById('eventDesc').value = data.description || '';
    document.getElementById('eventImageFile').value = '';
    editingEventImageUrl = data.image_url || '';
    editingEventId = id;
    document.getElementById('btnSaveEvent').textContent = 'Update Event';
    window.scrollTo({ top: document.getElementById('createEventForm').offsetTop, behavior: 'smooth' });
  }
};

window.deleteEvent = async (id) => {
  if (confirm("Are you sure you want to delete this event?")) {
    await supabase.from('events').delete().eq('id', id);
    loadEvents();
  }
};


// --- TEAM MANAGEMENT ---
let editingTeamId = null;

async function loadTeam() {
  const tbody = document.getElementById('teamTableBody');
  const { data, error } = await supabase.from('team_members').select('*').order('created_at', { ascending: true });
  
  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:#ffaa00;">Error: ${error.message}</td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#aaaaaa;">No team members found.</td></tr>`;
    return;
  }
  
  tbody.innerHTML = '';
  data.forEach(member => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${member.name}</td>
      <td>${member.role}</td>
      <td style="text-align: right; white-space: nowrap;">
        <button class="btn-edit" onclick="editTeam('${member.id}')">Edit</button>
        <button class="btn-delete" onclick="deleteTeam('${member.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

let editingTeamImageUrl = '';

document.getElementById('btnSaveTeam')?.addEventListener('click', async () => {
  const name = document.getElementById('teamName').value.trim();
  const role = document.getElementById('teamRole').value.trim();
  const category = 'team';
  const imageFile = document.getElementById('teamImageFile').files[0];
  const linkedin_url = document.getElementById('teamLinkedin').value.trim();
  const github_url = document.getElementById('teamGithub').value.trim();
  const statusMsg = document.getElementById('teamStatusMsg');
  
  if (!name || !role) {
    alert("Name and Role are required.");
    return;
  }
  
  statusMsg.textContent = 'Saving...';
  statusMsg.style.color = '#aaaaaa';
  statusMsg.classList.add('show');
  
  let image_url = editingTeamImageUrl;
  if (imageFile) {
    try {
      statusMsg.textContent = 'Uploading image...';
      image_url = await uploadImage(imageFile, 'team');
    } catch (e) {
      statusMsg.textContent = 'Upload Error: ' + e.message;
      statusMsg.style.color = '#ff5555';
      return;
    }
  }
  
  statusMsg.textContent = 'Saving member...';
  
  const payload = { name, role, category, image_url, linkedin_url, github_url };
  let res;
  
  if (editingTeamId) {
    res = await supabase.from('team_members').update(payload).eq('id', editingTeamId);
  } else {
    res = await supabase.from('team_members').insert([payload]);
  }
  
  if (res.error) {
    statusMsg.textContent = 'Error: ' + res.error.message;
    statusMsg.style.color = '#ff5555';
  } else {
    statusMsg.textContent = 'Member Saved!';
    statusMsg.style.color = '#55ff55';
    document.getElementById('teamName').value = '';
    document.getElementById('teamRole').value = '';
    document.getElementById('teamImageFile').value = '';
    document.getElementById('teamLinkedin').value = '';
    document.getElementById('teamGithub').value = '';
    editingTeamId = null;
    editingTeamImageUrl = '';
    document.getElementById('btnSaveTeam').textContent = 'Save Member';
    loadTeam();
  }
  
  setTimeout(() => statusMsg.classList.remove('show'), 3000);
});

window.editTeam = async (id) => {
  try {
    const { data, error } = await supabase.from('team_members').select('*').eq('id', id).single();
    if (error) {
      alert("Error fetching team member: " + error.message);
      return;
    }
    if (data) {
      document.getElementById('teamName').value = data.name || '';
      document.getElementById('teamRole').value = data.role || '';

      document.getElementById('teamImageFile').value = '';
      editingTeamImageUrl = data.image_url || '';
      document.getElementById('teamLinkedin').value = data.linkedin_url || '';
      document.getElementById('teamGithub').value = data.github_url || '';
      editingTeamId = id;
      document.getElementById('btnSaveTeam').textContent = 'Update Member';
      window.scrollTo({ top: document.getElementById('createTeamForm').offsetTop, behavior: 'smooth' });
    }
  } catch (err) {
    alert("Unexpected error: " + err.message);
    console.error(err);
  }
};

window.deleteTeam = async (id) => {
  if (confirm("Are you sure you want to delete this member?")) {
    try {
      const { error } = await supabase.from('team_members').delete().eq('id', id);
      if (error) {
        alert("Failed to delete: " + error.message);
      } else {
        loadTeam();
      }
    } catch (err) {
      alert("Unexpected error: " + err.message);
      console.error(err);
    }
  }
};
