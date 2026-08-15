/**
 * SORC RPG API - Google OAuth Handler
 * Handles OAuth 2.0 callback from Google Sign-In
 */

const GOOGLE_CLIENT_ID = '303646936307-jn1gtlgiabv9tk345m5dvk0f99nk2apf.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = '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';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const url = new URL(request.url);

    // Google OAuth callback handler
    if (url.pathname === '/auth/google/callback') {
      return handleGoogleCallback(request, url);
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};

/**
 * Handle Google OAuth callback
 * Exchange authorization code for tokens and user info
 */
async function handleGoogleCallback(request, url) {
  try {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
      return redirect('https://sorcrpg.com/signin.html?error=no_code', 'error', 'No authorization code received');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: 'https://api.sorcrpg.com/auth/google/callback',
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      return redirect('https://sorcrpg.com/signin.html?error=token_exchange', 'error', 'Failed to exchange token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user info
    const userResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!userResponse.ok) {
      console.error('Failed to fetch user info');
      return redirect('https://sorcrpg.com/signin.html?error=userinfo', 'error', 'Failed to fetch user info');
    }

    const userInfo = await userResponse.json();

    // Create user session object
    const user = {
      id: userInfo.sub,
      email: userInfo.email,
      displayName: userInfo.name,
      avatar: userInfo.picture,
      accountType: 'CIVILIAN',
      createdAt: new Date().toISOString(),
    };

    // Generate auth key (simplified - use a proper JWT in production)
    const authKey = generateAuthKey(user.id);

    // Create response with Set-Cookie headers
    const setCookieHeaders = [
      `kidVerified=true; Path=/; Max-Age=${60 * 60 * 24 * 30}; Secure; SameSite=Lax`, // 30 days
      `sorc_session=${authKey}; Path=/; Max-Age=${60 * 60 * 24 * 30}; Secure; SameSite=Lax; HttpOnly`,
    ];

    // Create redirect response
    const response = new Response(null, {
      status: 302,
      headers: {
        'Location': `https://sorcrpg.com/index.html?auth_success=true`,
        'Set-Cookie': setCookieHeaders,
      },
    });

    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    return redirect('https://sorcrpg.com/signin.html?error=server', 'error', 'Server error during authentication');
  }
}

/**
 * Generate a simple auth key (in production, use JWT)
 */
function generateAuthKey(userId) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${userId}-${timestamp}-${random}`;
}

/**
 * Helper to create redirect response
 */
function redirect(url, type, message) {
  return new Response(`<!DOCTYPE html>
<html>
<head>
  <title>Redirecting...</title>
  <script>
    localStorage.setItem('auth_message', JSON.stringify({
      type: '${type}',
      message: '${message}'
    }));
    window.location.href = '${url}';
  </script>
</head>
<body>Redirecting...</body>
</html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}
