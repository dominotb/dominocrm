import {randomBytes} from 'node:crypto';
import {NextRequest, NextResponse} from 'next/server';
import {getCurrentProfile} from '@/lib/auth';
import {getMetaConfig, metaScopes} from '@/lib/meta';
export async function GET(req: NextRequest) {
  if (!await getCurrentProfile()) return NextResponse.redirect(new URL('/login', req.url), {status: 303});
  try {
    const config = getMetaConfig(); const state = randomBytes(32).toString('base64url');
    const url = new URL(`https://www.facebook.com/${config.graphVersion}/dialog/oauth`);
    url.searchParams.set('client_id', config.appId); url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('state', state); url.searchParams.set('scope', metaScopes.join(',')); url.searchParams.set('response_type', 'code');
    const response = NextResponse.redirect(url);
    response.cookies.set('meta_oauth_state', state, {httpOnly: true, secure: true, sameSite: 'lax', path: '/api/integrations/meta', maxAge: 600});
    return response;
  } catch (error) { return NextResponse.redirect(new URL(`/settings?meta=error&message=${encodeURIComponent(error instanceof Error ? error.message : 'Không thể kết nối Facebook.')}`, req.url), {status: 303}); }
}
