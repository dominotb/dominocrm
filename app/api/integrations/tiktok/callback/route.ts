import {NextRequest, NextResponse} from 'next/server';
import {getCurrentProfile} from '@/lib/auth';
import {createServiceClient, hasSupabaseConfig} from '@/lib/supabase';
import {encryptTikTokToken, getTikTokConfig, type TikTokTokenResponse} from '@/lib/tiktok';

type TikTokUserResponse = {data?: {user?: {open_id?: string; display_name?: string}}; error?: {code?: string; message?: string; log_id?: string}};

export async function GET(req: NextRequest) {
  const wantsJson = req.nextUrl.searchParams.get('format') === 'json' || req.headers.get('accept')?.includes('application/json');
  const respond = (status: 'connected' | 'error', message: string, httpStatus = 200) => {
    const response = wantsJson
      ? NextResponse.json({ok: status === 'connected', status, message}, {status: httpStatus})
      : NextResponse.redirect(new URL(`/content?tiktok=${status}&message=${encodeURIComponent(message)}`, req.url), {status: 303});
    response.cookies.delete('tiktok_oauth_state');
    response.headers.set('Cache-Control', 'no-store');
    return response;
  };

  const error = req.nextUrl.searchParams.get('error');
  if (error) return respond('error', req.nextUrl.searchParams.get('error_description') || error, 400);

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const expectedState = req.cookies.get('tiktok_oauth_state')?.value;
  if (!code) return respond('error', 'TikTok không trả về authorization code.', 400);
  if (!state || !expectedState || state !== expectedState) return respond('error', 'OAuth state không hợp lệ hoặc đã hết hạn.', 400);
  if (!hasSupabaseConfig()) return respond('error', 'Chưa cấu hình Supabase.', 500);

  const user = await getCurrentProfile();
  if (!user) return respond('error', 'Phiên đăng nhập CRM đã hết hạn. Vui lòng đăng nhập và kết nối lại.', 401);

  try {
    const config = getTikTokConfig();
    const token = await exchangeCode(code, config);
    const account = await getTikTokUser(token.access_token);
    const now = Date.now();
    const {error: databaseError} = await createServiceClient().from('integration_connections').upsert({
      provider: 'tiktok',
      external_account_id: token.open_id,
      display_name: account.display_name || token.open_id,
      access_token_encrypted: encryptTikTokToken(token.access_token),
      refresh_token_encrypted: encryptTikTokToken(token.refresh_token),
      access_token_expires_at: new Date(now + token.expires_in * 1000).toISOString(),
      refresh_token_expires_at: new Date(now + token.refresh_expires_in * 1000).toISOString(),
      scopes: token.scope.split(',').map((scope) => scope.trim()).filter(Boolean),
      status: 'active', connected_by: user.id, connected_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString(),
    }, {onConflict: 'provider,external_account_id'});
    if (databaseError) throw databaseError;
    return respond('connected', `Đã kết nối tài khoản TikTok ${account.display_name || token.open_id}.`);
  } catch (callbackError) {
    console.error('TikTok OAuth callback failed', safeError(callbackError));
    return respond('error', messageOf(callbackError), 502);
  }
}

async function exchangeCode(code: string, config: ReturnType<typeof getTikTokConfig>) {
  const body = new URLSearchParams({client_key: config.clientKey, client_secret: config.clientSecret, code, grant_type: 'authorization_code', redirect_uri: config.redirectUri});
  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache'}, body, cache: 'no-store'});
  const result = await response.json() as TikTokTokenResponse;
  if (!response.ok || result.error || !result.access_token || !result.refresh_token || !result.open_id) throw new Error(result.error_description || result.error || `TikTok token API trả về HTTP ${response.status}.`);
  return result;
}

async function getTikTokUser(accessToken: string) {
  const url = new URL('https://open.tiktokapis.com/v2/user/info/');
  url.searchParams.set('fields', 'open_id,display_name');
  const response = await fetch(url, {headers: {Authorization: `Bearer ${accessToken}`}, cache: 'no-store'});
  const result = await response.json() as TikTokUserResponse;
  if (!response.ok || (result.error?.code && result.error.code !== 'ok') || !result.data?.user) throw new Error(result.error?.message || `TikTok user API trả về HTTP ${response.status}.`);
  return result.data.user;
}

function messageOf(error: unknown) { return error instanceof Error ? error.message : 'Không thể hoàn tất kết nối TikTok.'; }
function safeError(error: unknown) { return error instanceof Error ? {name: error.name, message: error.message} : {message: 'Unknown error'}; }
