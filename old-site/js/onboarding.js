// js/onboarding.js

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('onboardingForm');
    const btnSubmit = document.getElementById('btnSubmit');
    const errorMsg = document.getElementById('errorMsg');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fullName = document.getElementById('fullName').value.trim();
        const regNumber = document.getElementById('regNumber').value.trim();
        const phoneNumber = document.getElementById('phoneNumber').value.trim();
        const department = document.getElementById('department').value;
        const yearOfStudy = document.getElementById('yearOfStudy').value;

        if (!fullName || !regNumber || !phoneNumber || !department || !yearOfStudy) {
            showError("Please fill out all fields.");
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.textContent = "Saving...";
        errorMsg.style.display = 'none';

        try {
            // Get current session
            const { data: { session } } = await window.supabase.auth.getSession();
            
            if (!session) {
                window.location.replace('login.html');
                return;
            }

            // Update profile
            const { error: updateError } = await window.supabase
                .from('member_profiles')
                .update({
                    full_name: fullName,
                    registration_number: regNumber,
                    phone_number: phoneNumber,
                    department: department,
                    year_of_study: yearOfStudy,
                    is_onboarded: true
                })
                .eq('id', session.user.id);

            if (updateError) throw updateError;

            // Fetch role to redirect properly
            const { data: profile } = await window.supabase
                .from('member_profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            const role = profile?.role || 'user';
            
            // Redirect based on role
            if (role === 'admin') window.location.replace('admin.html');
            else if (role === 'core_member') window.location.replace('core-dashboard.html');
            else window.location.replace('dashboard.html');

        } catch (err) {
            showError(err.message || "Failed to complete onboarding.");
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Complete Profile";
        }
    });

    function showError(msg) {
        errorMsg.textContent = msg;
        errorMsg.style.display = 'block';
    }
});
