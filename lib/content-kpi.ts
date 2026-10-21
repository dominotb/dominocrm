import {createServiceClient} from './supabase';
import {connection} from 'next/server';

export const contentPlatforms = ['tiktok', 'fanpage', 'youtube', 'website'] as const;
export type ContentPlatform = typeof contentPlatforms[number];
export type ContentMetric = {date: string; views: number; reach: number; impressions: number; likes: number; comments: number; shares: number; saves: number; clicks: number; leads: number; watchTimeSeconds: number; source: 'manual' | 'api'};
export type ContentItem = {id: string; platform: ContentPlatform; contentType: string; title: string; contentUrl: string; externalId: string; publishedAt: string; metrics: ContentMetric[]};
export type ContentTarget = {platform: ContentPlatform; month: string; postsTarget: number; viewsTarget: number; engagementRateTarget: number; leadsTarget: number};
export type ContentKpiData = {items: ContentItem[]; targets: ContentTarget[]; month: string};

export async function getContentKpiData(): Promise<ContentKpiData> {
  await connection();
  const service = createServiceClient();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const [{data: items, error}, {data: metrics}, {data: targets}] = await Promise.all([
    service.from('content_items').select('id,platform,content_type,title,content_url,external_id,published_at').eq('status', 'published').order('published_at', {ascending: false}),
    service.from('content_metric_snapshots').select('content_id,metric_date,views,reach,impressions,likes,comments,shares,saves,clicks,leads,watch_time_seconds,source').order('metric_date', {ascending: false}),
    service.from('content_kpi_targets').select('platform,month,posts_target,views_target,engagement_rate_target,leads_target').eq('month', month),
  ]);
  if (error) return {items: [], targets: [], month};
  const byContent = new Map<string, ContentMetric[]>();
  for (const row of metrics || []) {
    const list = byContent.get(row.content_id) || [];
    list.push({date: row.metric_date, views: Number(row.views), reach: Number(row.reach), impressions: Number(row.impressions), likes: Number(row.likes), comments: Number(row.comments), shares: Number(row.shares), saves: Number(row.saves), clicks: Number(row.clicks), leads: Number(row.leads), watchTimeSeconds: Number(row.watch_time_seconds), source: row.source as 'manual' | 'api'});
    byContent.set(row.content_id, list);
  }
  return {
    month,
    items: (items || []).map((row) => ({id: row.id, platform: row.platform as ContentPlatform, contentType: row.content_type, title: row.title, contentUrl: row.content_url || '', externalId: row.external_id || '', publishedAt: row.published_at, metrics: byContent.get(row.id) || []})),
    targets: (targets || []).map((row) => ({platform: row.platform as ContentPlatform, month: row.month, postsTarget: row.posts_target, viewsTarget: Number(row.views_target), engagementRateTarget: Number(row.engagement_rate_target), leadsTarget: row.leads_target})),
  };
}
