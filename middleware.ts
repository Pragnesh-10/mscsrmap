import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, getClientIp } from "./utils/rateLimiter";

// CORS configuration: Load allowed origins from environment or default to local/production values
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'https://mscsrmap.edu.in',
      'https://msc-srmap.web.app',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.NEXT_PUBLIC_APP_URL || ''
    ].filter(Boolean);

export async function middleware(request: NextRequest) {
  const currentPath = request.nextUrl.pathname;
  const origin = request.headers.get('origin');
  const isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin);

  // 1. CORS Preflight & Policy Enforcement
  if (request.method === 'OPTIONS') {
    if (origin && !isAllowedOrigin) {
      return new NextResponse(JSON.stringify({ error: 'CORS policy violation' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Next-Action, Next-Router-State-Tree, Next-Router-Prefetch',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });



  // 2. Initialize Supabase Client to refresh sessions and perform RBAC checks
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
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

  // Retrieve user session
  const { data: { session } } = await supabase.auth.getSession();

  // Inject CORS headers into the response if request has Origin
  if (origin && isAllowedOrigin) {
    supabaseResponse.headers.set('Access-Control-Allow-Origin', origin);
    supabaseResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    supabaseResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Next-Action, Next-Router-State-Tree, Next-Router-Prefetch');
    supabaseResponse.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  // 3. Rate Limiting implementation (Vulnerability 1)
  const clientIp = getClientIp(request);
  // Rate limit key is User ID if authenticated, else IP address
  const rateLimitKey = session ? `user:${session.user.id}` : `ip:${clientIp}`;

  // Configure limits based on route sensitivity
  let limiterName = 'default';
  let windowMs = parseInt(process.env.RATE_LIMIT_DEFAULT_WINDOW_MS || '60000', 10);
  let max = parseInt(process.env.RATE_LIMIT_DEFAULT_MAX_REQUESTS || '100', 10);

  if (currentPath.startsWith('/login') || request.headers.get('next-action')?.includes('login') || currentPath.includes('password_actions')) {
    limiterName = 'auth';
    windowMs = parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '60000', 10);
    max = parseInt(process.env.RATE_LIMIT_AUTH_MAX_REQUESTS || '10', 10); // Max 10 login attempts per minute
  } else if (currentPath.startsWith('/events') || currentPath.includes('actions')) {
    limiterName = 'api';
    windowMs = parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10);
    max = parseInt(process.env.RATE_LIMIT_API_MAX_REQUESTS || '30', 10); // Max 30 writes/actions per minute
  }

  const rateLimitResult = await checkRateLimit(limiterName, rateLimitKey, windowMs, max);

  // Set rate limiting metadata headers on all responses
  supabaseResponse.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
  supabaseResponse.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
  supabaseResponse.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString());

  if (!rateLimitResult.success) {
    const errorBody = {
      error: 'Too Many Requests',
      message: 'You have exceeded your request quota. Please try again later.'
    };
    return new NextResponse(JSON.stringify(errorBody), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.reset.toString(),
      }
    });
  }


  // 5. Authentication & Authorization Guards (Vulnerability 2)
  const isProtected = currentPath.startsWith('/admin') || 
                      currentPath.startsWith('/dashboard') || 
                      currentPath.startsWith('/onboarding') || 
                      currentPath.startsWith('/core-dashboard');

  const isApiOrAction = request.headers.get('accept')?.includes('application/json') || 
                        request.headers.get('x-action') !== null ||
                        request.headers.get('next-action') !== null ||
                        currentPath.startsWith('/api/');

  if (isProtected) {
    if (!session) {
      if (isApiOrAction) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized: Missing session' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Fetch user profile from Database for RBAC authorization
    const { data: profile } = await supabase
      .from('member_profiles')
      .select('role, is_onboarded')
      .eq('id', session.user.id)
      .single();

    if (!profile) {
      if (isApiOrAction) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden: Profile not found' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return NextResponse.redirect(new URL('/login?message=Unauthorized', request.url));
    }

    const { role, is_onboarded } = profile;

    // Handle Onboarding Routing Flow
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

    // Role-Based Access Control (RBAC)
    if (currentPath.startsWith('/admin') && role !== 'admin' && role !== 'core_member') {
      if (isApiOrAction) {
        return new NextResponse(JSON.stringify({ error: 'Forbidden: Insufficient privileges' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return NextResponse.redirect(new URL('/login?message=Unauthorized', request.url));
    }
  }

  // Security Headers (Check 03: Secure Deployment)
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
  supabaseResponse.headers.set('X-Frame-Options', 'DENY');
  supabaseResponse.headers.set('X-XSS-Protection', '1; mode=block');
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
