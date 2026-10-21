'use server';
import {revalidatePath} from 'next/cache';
import {requireCurrentProfile} from '@/lib/auth';
import {contentPlatforms, type ContentPlatform} from '@/lib/content-kpi';
import {createServiceClient} from '@/lib/supabase';

type Result = {ok: true} | {ok: false; error: string};
const types = ['post', 'video', 'article', 'short', 'reel'];
const number = (data: FormData, key: string) => Math.max(0, Number(data.get(key) || 0));

export async function createContentAction(data: FormData): Promise<Result> {
  const user = await requireCurrentProfile();
  const platform = String(data.get('platform')) as ContentPlatform;
  const contentType = String(data.get('contentType'));
  const title = String(data.get('title') || '').trim();
  const publishedAt = String(data.get('publishedAt') || '');
  const contentUrl = String(data.get('contentUrl') || '').trim();
  if (!contentPlatforms.includes(platform) || !types.includes(contentType) || !title || !publishedAt) return {ok: false, error: 'Vui lòng nhập đủ kênh, loại nội dung, tiêu đề và ngày đăng.'};
  if (contentUrl) { try { new URL(contentUrl); } catch { return {ok: false, error: 'Link bài đăng không hợp lệ.'}; } }
  const {error} = await createServiceClient().from('content_items').insert({platform, content_type: contentType, title, content_url: contentUrl || null, external_id: String(data.get('externalId') || '').trim() || null, published_at: new Date(publishedAt).toISOString(), created_by: user.id});
  if (error) return {ok: false, error: error.message};
  revalidatePath('/content'); return {ok: true};
}

export async function saveContentMetricsAction(data: FormData): Promise<Result> {
  await requireCurrentProfile();
  const contentId = String(data.get('contentId') || '');
  const metricDate = String(data.get('metricDate') || '');
  if (!contentId || !/^\d{4}-\d{2}-\d{2}$/.test(metricDate)) return {ok: false, error: 'Ngày chốt số liệu không hợp lệ.'};
  const values = ['views','reach','impressions','likes','comments','shares','saves','clicks','leads','watchTimeSeconds'].map((key) => number(data, key));
  if (values.some((value) => !Number.isFinite(value) || !Number.isInteger(value))) return {ok: false, error: 'Các chỉ số phải là số nguyên không âm.'};
  const [views, reach, impressions, likes, comments, shares, saves, clicks, leads, watchTimeSeconds] = values;
  const {error} = await createServiceClient().from('content_metric_snapshots').upsert({content_id: contentId, metric_date: metricDate, views, reach, impressions, likes, comments, shares, saves, clicks, leads, watch_time_seconds: watchTimeSeconds, source: 'manual', synced_at: new Date().toISOString()}, {onConflict: 'content_id,metric_date'});
  if (error) return {ok: false, error: error.message};
  revalidatePath('/content'); return {ok: true};
}

export async function saveContentTargetAction(data: FormData): Promise<Result> {
  const user = await requireCurrentProfile();
  const platform = String(data.get('platform')) as ContentPlatform;
  const monthValue = String(data.get('month') || '');
  if (!contentPlatforms.includes(platform) || !/^\d{4}-\d{2}$/.test(monthValue)) return {ok: false, error: 'Kênh hoặc tháng không hợp lệ.'};
  const month = `${monthValue}-01`;
  const {error} = await createServiceClient().from('content_kpi_targets').upsert({platform, month, posts_target: number(data, 'postsTarget'), views_target: number(data, 'viewsTarget'), engagement_rate_target: number(data, 'engagementRateTarget'), leads_target: number(data, 'leadsTarget'), created_by: user.id, updated_at: new Date().toISOString()}, {onConflict: 'month,platform'});
  if (error) return {ok: false, error: error.message};
  revalidatePath('/content'); return {ok: true};
}
