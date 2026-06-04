// js/guard.js
// This script acts as a centralized middleware to protect routes.
// It must be loaded AFTER supabase-config.js in the <head> of protected pages.

(async function initGuard() {
    // 1. Wait for Supabase to be ready
    if (!window.supabase) {
        console.error("Guard Error: Supabase client not found.");
        return;
    }

    const currentPath = window.location.pathname;
    const isProtected = currentPath.includes('admin.html') || 
                        currentPath.includes('core-dashboard.html') || 
                        currentPath.includes('dashboard.html') || 
                        currentPath.includes('onboarding.html');
    
    if (!isProtected) return; // Only run on protected routes

    try {
        // 2. Check Authentication Session
        const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
        
        if (sessionError || !session) {
            handleUnauthorized('Please log in to access this page.');
            return;
        }

        // 3. Fetch User Role & Onboarding Status
        const { data: profile, error: profileError } = await window.supabase
            .from('member_profiles')
            .select('role, is_onboarded')
            .eq('id', session.user.id)
            .single();

        if (profileError || !profile) {
            handleUnauthorized('Could not verify access permissions.');
            return;
        }

        const role = profile.role;
        const isOnboarded = profile.is_onboarded;

        // If trying to access onboarding but already onboarded, redirect to their dashboard
        if (currentPath.includes('onboarding.html')) {
            if (isOnboarded) {
                window.location.replace(role === 'admin' ? 'admin.html' : role === 'core_member' ? 'core-dashboard.html' : 'dashboard.html');
            }
            return; // Allowed to stay on onboarding
        }

        // If accessing any other protected page and NOT onboarded, force onboarding
        if (!isOnboarded) {
            window.location.replace('onboarding.html');
            return;
        }

        // 4. Enforce Route Permissions
        if (currentPath.includes('admin.html')) {
            // Localhost-only Security Block
            const hostname = window.location.hostname;
            if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
                document.body.innerHTML = `
                    <div style="display:flex; flex-direction:column; height:100vh; align-items:center; justify-content:center; background:#050505; color:#ff5555; font-family:sans-serif;">
                        <h1 style="font-size:3rem; margin:0;">403 FORBIDDEN</h1>
                        <p style="color:#aaa;">The Admin Dashboard is strictly inaccessible from public networks.</p>
                    </div>`;
                throw new Error("Public access to admin panel blocked.");
            }

            if (role !== 'admin') {
                handleUnauthorized('Unauthorized. Admin privileges required.');
                return;
            }
        }

        if (currentPath.includes('core-dashboard.html') && role !== 'admin' && role !== 'core_member') {
            handleUnauthorized('Unauthorized. Core Member privileges required.');
            return;
        }

        if (currentPath.includes('dashboard.html') && role !== 'user' && role !== 'admin' && role !== 'core_member') {
            handleUnauthorized('Unauthorized access to dashboard.');
            return;
        }

        // If we get here, the user is authorized!
        // We can optionally expose their role globally for other scripts to use
        window.USER_ROLE = role;

    } catch (err) {
        console.error("Guard Execution Failed:", err);
        handleUnauthorized('An unexpected authentication error occurred.');
    }
})();

async function handleUnauthorized(message) {
    if (window.supabase) {
        await window.supabase.auth.signOut();
    }
    // Redirect to login page with message
    window.location.replace(`login.html?message=${encodeURIComponent(message)}`);
}
