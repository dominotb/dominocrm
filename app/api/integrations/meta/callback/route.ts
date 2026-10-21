import {NextRequest, NextResponse} from 'next/server';
import {getCurrentProfile} from '@/lib/auth';
import {createServiceClient, hasSupabaseConfig} from '@/lib/supabase';
import {encryptMetaToken, getMetaConfig, metaScopes} from '@/lib/meta';
type TokenResult = {access_token?: string; expires_in?: number; error?: {message?: string}};
type MetaUser = {id?: string; name?: string; error?: {message?: string}};
type MetaBusiness = {id: string; name: string};
type MetaAdAccount = {id: string; name: string; account_id?: string};
export async function GET(req: NextRequest) {
  const respond = (status: 'connected' | 'error', message: string) => { const response = NextResponse.redirect(new URL(`/settings?meta=${status}&message=${encodeURIComponent(message)}`, req.url), {status: 303}); response.cookies.delete('meta_oauth_state'); response.headers.set('Cache-Control', 'no-store'); return response; };
  if (req.nextUrl.searchParams.get('error')) return respond('error', req.nextUrl.searchParams.get('error_description') || 'Bạn đã huỷ cấp quyền Facebook.');
  const code = req.nextUrl.searchParams.get('code'); const state = req.nextUrl.searchParams.get('state');
  if (!code) return respond('error', 'Facebook không trả về authorization code.');
  if (!state || state !== req.cookies.get('meta_oauth_state')?.value) return respond('error', 'OAuth state không hợp lệ hoặc đã hết hạn.');
  if (!hasSupabaseConfig()) return respond('error', 'Chưa cấu hình Supabase.');
  const user = await getCurrentProfile(); if (!user) return respond('error', 'Phiên đăng nhập CRM đã hết hạn.');
  try {
    const config = getMetaConfig();
    const shortToken = await graph<TokenResult>(`${config.graphVersion}/oauth/access_token`, {client_id: config.appId, client_secret: config.appSecret, redirect_uri: config.redirectUri, code});
    if (!shortToken.access_token) throw new Error('Không nhận được access token từ Facebook.');
    const longToken = await graph<TokenResult>(`${config.graphVersion}/oauth/access_token`, {grant_type: 'fb_exchange_token', client_id: config.appId, client_secret: config.appSecret, fb_exchange_token: shortToken.access_token});
    const accessToken = longToken.access_token || shortToken.access_token;
    const [account, businesses] = await Promise.all([
      graph<MetaUser>(`${config.graphVersion}/me`, {fields: 'id,name', access_token: accessToken}),
      graphAll<MetaBusiness>(`${config.graphVersion}/me/businesses`, {fields: 'id,name', limit: '200', access_token: accessToken}),
    ]);
    if (!account.id) throw new Error('Không đọc được tài khoản Facebook.');
    const businessAccounts = await Promise.all(businesses.flatMap((business) => [
      graphAll<MetaAdAccount>(`${config.graphVersion}/${business.id}/owned_ad_accounts`, {fields: 'id,account_id,name', limit: '200', access_token: accessToken}),
      graphAll<MetaAdAccount>(`${config.graphVersion}/${business.id}/client_ad_accounts`, {fields: 'id,account_id,name', limit: '200', access_token: accessToken}),
    ]));
    const fallbackAccounts = businesses.length ? [] : await graphAll<MetaAdAccount>(`${config.graphVersion}/me/adaccounts`, {fields: 'id,account_id,name', limit: '200', access_token: accessToken});
    const adAccounts = [...new Map([...businessAccounts.flat(), ...fallbackAccounts].map((item) => [item.id, item])).values()];
    const now = Date.now(); const expiresIn = longToken.expires_in || shortToken.expires_in || 5184000;
    const {error} = await createServiceClient().from('integration_connections').upsert({provider: 'meta', external_account_id: account.id, display_name: account.name || account.id, access_token_encrypted: encryptMetaToken(accessToken), refresh_token_encrypted: null, access_token_expires_at: new Date(now + expiresIn * 1000).toISOString(), refresh_token_expires_at: null, scopes: metaScopes, status: 'active', connected_by: user.id, connected_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString(), metadata: {businesses, ad_accounts: adAccounts}}, {onConflict: 'provider,external_account_id'});
    if (error) throw error;
    return respond('connected', `Đã kết nối ${businesses.length} BM và đọc được ${adAccounts.length} tài khoản quảng cáo.`);
  } catch (error) { console.error('Meta OAuth callback failed', error instanceof Error ? {name: error.name, message: error.message} : {message: 'Unknown error'}); return respond('error', error instanceof Error ? error.message : 'Không thể hoàn tất kết nối Facebook.'); }
}
async function graph<T>(path: string, params: Record<string, string>) { const url = new URL(`https://graph.facebook.com/${path}`); Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value)); const response = await fetch(url, {cache: 'no-store'}); const result = await response.json() as T & {error?: {message?: string}}; if (!response.ok || result.error) throw new Error(result.error?.message || `Meta API trả về HTTP ${response.status}.`); return result; }
async function graphAll<T>(path: string, params: Record<string, string>) {
  const first = new URL(`https://graph.facebook.com/${path}`); Object.entries(params).forEach(([key, value]) => first.searchParams.set(key, value));
  let url = first.toString(); const rows: T[] = [];
  while (url) { const response = await fetch(url, {cache: 'no-store'}); const result = await response.json() as {data?: T[]; paging?: {next?: string}; error?: {message?: string}}; if (!response.ok || result.error) throw new Error(result.error?.message || `Meta API trả về HTTP ${response.status}.`); rows.push(...(result.data || [])); url = result.paging?.next || ''; }
  return rows;
}
