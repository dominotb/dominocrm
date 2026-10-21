import {randomBytes} from 'node:crypto';
import {NextRequest, NextResponse} from 'next/server';
import {getCurrentProfile} from '@/lib/auth';
import {getTikTokConfig, tiktokScopes} from '@/lib/tiktok';

export async function GET(req: NextRequest) {
  const user = await getCurrentProfile();
  if (!user) return NextResponse.redirect(new URL('/login', req.url), {status: 303});

  try {
    const {clientKey, redirectUri} = getTikTokConfig();
    const state = randomBytes(32).toString('base64url');
    const authorizeUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
    authorizeUrl.searchParams.set('client_key', clientKey);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', tiktokScopes.join(','));
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('state', state);

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set('tiktok_oauth_state', state, {httpOnly: true, secure: true, sameSite: 'lax', path: '/api/integrations/tiktok', maxAge: 600});
    return response;
  } catch (error) {
    return NextResponse.json({ok: false, error: messageOf(error)}, {status: 500});
  }
}

function messageOf(error: unknown) { return error instanceof Error ? error.message : 'Không thể bắt đầu kết nối TikTok.'; }
