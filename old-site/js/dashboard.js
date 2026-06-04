// js/dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Authenticate and authorize
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const { data: profile, error } = await supabase
    .from('member_profiles')
    .select('is_core_member')
    .eq('id', session.user.id)
    .single();

  if (error || !profile || !profile.is_core_member) {
    alert('Access Denied. Core Member access required.');
    window.location.href = 'index.html';
    return;
  }

  // Allow body to show
  document.getElementById('dashboardBody').style.display = 'block';

  // 2. Initialize QR Scanner
  const html5QrcodeScanner = new Html5QrcodeScanner(
    "reader",
    { fps: 10, qrbox: { width: 250, height: 250 } },
    false
  );
  
  let isProcessing = false;

  async function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return; // Prevent multiple rapid scans of same code
    isProcessing = true;
    html5QrcodeScanner.pause();

    const statusDiv = document.getElementById('scanStatus');
    statusDiv.className = 'scan-status show';
    statusDiv.textContent = 'Verifying ticket...';
    statusDiv.style.color = '#fff';

    try {
      // Find the registration by hash
      const { data: registration, error: fetchError } = await supabase
        .from('registrations')
        .select('*')
        .eq('hash_payload', decodedText)
        .single();

      if (fetchError || !registration) {
        throw new Error('Invalid or unknown ticket.');
      }

      if (registration.checked_in) {
        statusDiv.className = 'scan-status show error';
        statusDiv.textContent = 'Ticket already checked in!';
      } else {
        // Perform check in
        const { error: updateError } = await supabase
          .from('registrations')
          .update({ checked_in: true })
          .eq('id', registration.id);

        if (updateError) throw updateError;

        statusDiv.className = 'scan-status show success';
        statusDiv.textContent = 'Check-in Successful!';
      }
    } catch (err) {
      statusDiv.className = 'scan-status show error';
      statusDiv.textContent = err.message || 'Error processing ticket.';
      console.error(err);
    }

    // Resume scanner after 3 seconds
    setTimeout(() => {
      statusDiv.classList.remove('show');
      isProcessing = false;
      html5QrcodeScanner.resume();
    }, 3000);
  }

  function onScanFailure(error) {
    // handle scan failure, usually better to ignore and keep scanning
  }

  html5QrcodeScanner.render(onScanSuccess, onScanFailure);

  // Logout handler
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  });
});
