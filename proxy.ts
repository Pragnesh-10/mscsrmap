import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const { data: { session } } = await supabase.auth.getSession();

  const currentPath = request.nextUrl.pathname;
  
  // Hard Localhost Guard for Admin Dashboard
  if (currentPath.startsWith('/admin')) {
    const hostname = request.headers.get('host') || '';
    if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
      return new NextResponse('403 FORBIDDEN - Admin Dashboard is strictly inaccessible from public networks.', { status: 403 });
    }
  }

  const isProtected = currentPath.startsWith('/admin') || currentPath.startsWith('/dashboard') || currentPath.startsWith('/onboarding') || currentPath.startsWith('/core-dashboard');

  if (isProtected) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Fetch user profile for RBAC
    const { data: profile } = await supabase
      .from('member_profiles')
      .select('role, is_onboarded')
      .eq('id', session.user.id)
      .single();

    if (!profile) {
      return NextResponse.redirect(new URL('/login?message=Unauthorized', request.url));
    }

    const { role, is_onboarded } = profile;

    // Handle onboarding flow
    const exemptFromOnboarding = role === 'admin';

    if (currentPath.startsWith('/onboarding')) {
      if (is_onboarded || exemptFromOnboarding) {
        return NextResponse.redirect(new URL(role === 'admin' || role === 'core_member' ? '/admin' : '/dashboard', request.url));
      }
    } else {
      if (!is_onboarded && !exemptFromOnboarding) {
        return NextResponse.redirect(new URL('/onboarding', request.url));
      }
    }

    // RBAC logic
    if (currentPath.startsWith('/admin') && role !== 'admin' && role !== 'core_member') {
      return NextResponse.redirect(new URL('/login?message=Unauthorized', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
