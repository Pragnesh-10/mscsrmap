// js/user-dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
    const btnLogout = document.getElementById('btnLogout');
    const userName = document.getElementById('userName');
    const userRegNo = document.getElementById('userRegNo');
    const userDept = document.getElementById('userDept');
    const userYear = document.getElementById('userYear');

    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        
        if (!session) return; // guard.js will handle redirect

        const { data: profile, error } = await window.supabase
            .from('member_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (error) throw error;

        if (profile) {
            userName.textContent = profile.full_name || 'Student';
            userRegNo.textContent = profile.registration_number || '--';
            userDept.textContent = profile.department || '--';
            userYear.textContent = profile.year_of_study ? `Year ${profile.year_of_study}` : '--';
        }

    } catch (err) {
        console.error("Failed to load dashboard data:", err);
    }

    btnLogout.addEventListener('click', async () => {
        await window.supabase.auth.signOut();
        window.location.replace('login.html');
    });
});
