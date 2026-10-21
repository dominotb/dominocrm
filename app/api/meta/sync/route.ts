import {NextRequest, NextResponse} from 'next/server';
import {revalidateTag} from 'next/cache';
import {createServiceClient, hasSupabaseConfig} from '@/lib/supabase';
import {decryptMetaToken, getMetaConfig} from '@/lib/meta';

type MetaList<T> = {data?: T[]; paging?: {next?: string}; error?: {message?: string}};
type MetaAdAccount = {id: string; name: string; currency?: string; timezone_name?: string};
type MetaCampaign = {id: string; name: string; status?: string; objective?: string};
type MetaAdSet = {id: string; name: string; status?: string; campaign_id?: string};
type MetaAd = {id: string; name: string; status?: string; adset_id?: string};
type MetaAction = {action_type: string; value: string};
type MetaInsight = {date_start: string; campaign_id?: string; adset_id?: string; ad_id?: string; spend?: string; impressions?: string; reach?: string; frequency?: string; clicks?: string; ctr?: string; cpc?: string; cpm?: string; actions?: MetaAction[]};
type SyncTarget = {accountId: string; token: string};
type SyncCounts = {accounts: number; campaigns: number; adsets: number; ads: number; insights: number};
const numberValue = (value: string | undefined) => Number(value || 0);

export async function POST(req: NextRequest) {
  if (!hasSupabaseConfig()) return NextResponse.json({ok: false, message: 'Chưa cấu hình Supabase env'}, {status: 400});
  const supabase = createServiceClient(); const startedAt = new Date().toISOString(); let logId: number | null = null;
  try {
    const targets = await getSyncTargets();
    if (!targets.length) return NextResponse.json({ok: false, message: 'Chưa kết nối Business Manager hoặc BM chưa có tài khoản quảng cáo.'}, {status: 400});
    const log = await supabase.from('ad_sync_logs').insert({sync_type: 'meta', status: 'running', started_at: startedAt}).select('id').single(); logId = log.data?.id || null;
    const total: SyncCounts = {accounts: 0, campaigns: 0, adsets: 0, ads: 0, insights: 0};
    for (const target of targets) {
      const count = await syncAccount(target, startedAt); total.accounts += 1;
      total.campaigns += count.campaigns; total.adsets += count.adsets; total.ads += count.ads; total.insights += count.insights;
    }
    if (logId) await supabase.from('ad_sync_logs').update({status: 'success', detail: total, finished_at: new Date().toISOString()}).eq('id', logId);
    revalidateTag('dashboard-data', 'max');
    if (req.headers.get('accept')?.includes('text/html')) return NextResponse.redirect(new URL('/ads/campaigns', req.url), {status: 303});
    return NextResponse.json({ok: true, ...total});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Đồng bộ Meta thất bại';
    if (logId) await supabase.from('ad_sync_logs').update({status: 'error', detail: {message}, finished_at: new Date().toISOString()}).eq('id', logId);
    return NextResponse.json({ok: false, message}, {status: 500});
  }
}

async function getSyncTargets(): Promise<SyncTarget[]> {
  const {data, error} = await createServiceClient().from('integration_connections').select('access_token_encrypted,metadata,access_token_expires_at').eq('provider', 'meta').eq('status', 'active').order('connected_at', {ascending: false});
  if (error) throw error;
  const targets: SyncTarget[] = [];
  for (const connection of data || []) {
    if (new Date(connection.access_token_expires_at).getTime() <= Date.now()) continue;
    const token = decryptMetaToken(connection.access_token_encrypted);
    const accounts = Array.isArray(connection.metadata?.ad_accounts) ? connection.metadata.ad_accounts as {id?: string}[] : [];
    for (const account of accounts) if (account.id) targets.push({accountId: normalizeAdAccountId(account.id), token});
  }
  if (!targets.length && process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID) targets.push({accountId: normalizeAdAccountId(process.env.META_AD_ACCOUNT_ID), token: process.env.META_ACCESS_TOKEN});
  return [...new Map(targets.map((target) => [target.accountId, target])).values()];
}

async function syncAccount(target: SyncTarget, startedAt: string) {
  const supabase = createServiceClient(); const version = getMetaConfig().graphVersion; const {accountId: account, token} = target;
  const accountInfo = await metaFetch<MetaAdAccount>(`${account}?fields=id,name,currency,timezone_name`, token, version);
  await throwOnError(supabase.from('meta_ad_accounts').upsert({id: accountInfo.id, name: accountInfo.name, currency: accountInfo.currency || 'VND', timezone_name: accountInfo.timezone_name, active: true, synced_at: startedAt}));
  const [campaigns, adsets, ads, insights] = await Promise.all([
    metaFetchAll<MetaCampaign>(`${account}/campaigns?fields=id,name,status,objective&limit=250`, token, version),
    metaFetchAll<MetaAdSet>(`${account}/adsets?fields=id,name,status,campaign_id&limit=250`, token, version),
    metaFetchAll<MetaAd>(`${account}/ads?fields=id,name,status,adset_id&limit=250`, token, version),
    metaFetchAll<MetaInsight>(`${account}/insights?level=ad&time_increment=1&date_preset=last_30d&fields=date_start,campaign_id,adset_id,ad_id,spend,impressions,reach,frequency,clicks,ctr,cpc,cpm,actions&limit=500`, token, version),
  ]);
  if (campaigns.length) await throwOnError(supabase.from('meta_campaigns').upsert(campaigns.map((item) => ({id: item.id, ad_account_id: accountInfo.id, name: item.name, status: item.status, objective: item.objective, synced_at: startedAt}))));
  if (adsets.length) await throwOnError(supabase.from('meta_adsets').upsert(adsets.filter((item) => item.campaign_id).map((item) => ({id: item.id, campaign_id: item.campaign_id, name: item.name, status: item.status, synced_at: startedAt}))));
  if (ads.length) await throwOnError(supabase.from('meta_ads').upsert(ads.filter((item) => item.adset_id).map((item) => ({id: item.id, adset_id: item.adset_id, name: item.name, status: item.status, synced_at: startedAt}))));
  if (insights.length) await throwOnError(supabase.from('ad_daily_metrics').upsert(insights.map((item) => ({metric_date: item.date_start, ad_account_id: accountInfo.id, campaign_id: item.campaign_id || null, adset_id: item.adset_id || null, ad_id: item.ad_id || null, spend: numberValue(item.spend), impressions: numberValue(item.impressions), reach: numberValue(item.reach), frequency: numberValue(item.frequency), clicks: numberValue(item.clicks), ctr: numberValue(item.ctr), cpc: numberValue(item.cpc), cpm: numberValue(item.cpm), messages: actionValue(item.actions, ['onsite_conversion.messaging_conversation_started_7d', 'messaging_conversation_started_7d']), leads: actionValue(item.actions, ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead']), qualified_leads: 0, synced_at: startedAt})), {onConflict: 'metric_date,ad_account_id,campaign_id,adset_id,ad_id'}));
  return {campaigns: campaigns.length, adsets: adsets.length, ads: ads.length, insights: insights.length};
}

function normalizeAdAccountId(value: string) { return value.startsWith('act_') ? value : `act_${value}`; }
async function metaFetch<T>(path: string, token: string, version: string): Promise<T> { const separator = path.includes('?') ? '&' : '?'; const res = await fetch(`https://graph.facebook.com/${version}/${path}${separator}access_token=${encodeURIComponent(token)}`, {cache: 'no-store'}); const json = await res.json(); if (!res.ok || json.error) throw new Error(json.error?.message || `Meta API error ${res.status}`); return json; }
async function metaFetchAll<T>(path: string, token: string, version: string) { let url = `https://graph.facebook.com/${version}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`; const rows: T[] = []; while (url) { const res = await fetch(url, {cache: 'no-store'}); const json: MetaList<T> = await res.json(); if (!res.ok || json.error) throw new Error(json.error?.message || `Meta API error ${res.status}`); rows.push(...(json.data || [])); url = json.paging?.next || ''; } return rows; }
function actionValue(actions: MetaAction[] | undefined, names: string[]) { return (actions || []).reduce((total, action) => names.includes(action.action_type) ? total + Number(action.value || 0) : total, 0); }
async function throwOnError<T>(query: PromiseLike<{error: Error | null; data: T | null}>) { const result = await query; if (result.error) throw result.error; }
