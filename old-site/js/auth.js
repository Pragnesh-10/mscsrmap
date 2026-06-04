// js/auth.js

document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const btnSignIn = document.getElementById('btnSignIn');
  const authMessage = document.getElementById('authMessage');

  const showMessage = (msg, isError = true) => {
    authMessage.textContent = msg;
    authMessage.style.color = isError ? '#ff5555' : '#55ff55';
  };

  // Check for redirect messages from guard.js
  const urlParams = new URLSearchParams(window.location.search);
  const msgParam = urlParams.get('message');
  if (msgParam) {
    showMessage(msgParam, true);
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Check if already logged in as core member
  const checkSession = async () => {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (session) {
      const { data: profile } = await window.supabase
        .from('member_profiles')
        .select('role, is_onboarded')
        .eq('id', session.user.id)
        .single();
      
      if (profile && !profile.is_onboarded) {
        window.location.href = 'onboarding.html';
      } else if (profile && profile.role === 'admin') {
        window.location.href = 'admin.html';
      } else if (profile && profile.role === 'core_member') {
        window.location.href = 'core-dashboard.html';
      } else if (profile && profile.role === 'user') {
        window.location.href = 'dashboard.html';
      } else {
        await window.supabase.auth.signOut();
      }
    }
  };

  btnSignIn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showMessage('Please enter email and password.');
      return;
    }

    btnSignIn.disabled = true;
    btnSignIn.textContent = 'Signing In...';
    showMessage('', false);

    const { data, error } = await window.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      showMessage(error.message);
      btnSignIn.disabled = false;
      btnSignIn.textContent = 'Sign In';
    } else {
      // STRICT ROLE VALIDATION
      const { data: profile } = await window.supabase
        .from('member_profiles')
        .select('role, is_onboarded')
        .eq('id', data.user.id)
        .single();

      if (profile && !profile.is_onboarded) {
        showMessage('Please complete your profile...', false);
        window.location.href = 'onboarding.html';
      } else if (profile && profile.role === 'admin') {
        showMessage('Admin sign in successful! Redirecting...', false);
        window.location.href = 'admin.html';
      } else if (profile && profile.role === 'core_member') {
        showMessage('Sign in successful! Redirecting...', false);
        window.location.href = 'core-dashboard.html';
      } else if (profile && profile.role === 'user') {
        showMessage('Sign in successful! Redirecting...', false);
        window.location.href = 'dashboard.html';
      } else {
        // Reject and sign out immediately
        await window.supabase.auth.signOut();
        showMessage('Unauthorized: You do not have valid privileges.', true);
        btnSignIn.disabled = false;
        btnSignIn.textContent = 'Sign In';
      }
    }
  });



  checkSession();
});
