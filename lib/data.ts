import {createServiceClient, hasSupabaseConfig} from './supabase';
import {cacheLife, cacheTag} from 'next/cache';
import type {DashboardData} from './data-model';

type MetricRecord = {
  metric_date: string;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  spend: number | string | null;
  messages: number | string | null;
  leads: number | string | null;
  qualified_leads: number | string | null;
};

type CampaignRecord = {
  id: string;
  ad_account_id: string | null;
  name: string;
  status: string | null;
};

type LeadQualityRecord = {
  id?: string | null;
  created_at?: string | null;
  customer_id?: string | null;
  source: string | null;
  quality?: string | null;
  status?: string | null;
  segment?: string | null;
  scene_code?: string | null;
  quote_value?: number | string | null;
};

type CustomerSourceRecord = {customer_id: string | null; campaign_id: string | null; adset_id: string | null; ad_id: string | null};
type ActualLeadAttribution = {campaigns: Map<string, number>; adSets: Map<string, number>; ads: Map<string, number>};

type ChannelMetricRecord = {metric_date: string; source: string; messages: number | string | null};
type ManualDailyMetricRecord = {report_date: string; amount: number | string | null; messages: number | string | null};

const money = (value: unknown) => Number(value || 0);

export async function getDashboardData(): Promise<DashboardData> {
  'use cache';
  cacheLife({stale: 60, revalidate: 60, expire: 300});
  cacheTag('dashboard-data');

  if (!hasSupabaseConfig()) {
    return emptyData(false, 'Chưa cấu hình Supabase env');
  }

  try {
    const supabase = createServiceClient();
    const since = new Date();
    since.setDate(since.getDate() - 29);
    const sinceDate = formatDateInTimeZone(since, 'Asia/Ho_Chi_Minh');

    const [accountResult, campaignResult, adSetResult, adResult, metricResult, leadResult, channelResult, manualMetricResult] = await Promise.all([
      supabase.from('meta_ad_accounts').select('id,name').eq('active', true).order('name'),
      supabase.from('meta_campaigns').select('id,ad_account_id,name,status').order('synced_at', {ascending: false}),
      supabase.from('meta_adsets').select('id,campaign_id,name,status').order('name'),
      supabase.from('meta_ads').select('id,adset_id,name,status').order('name'),
      supabase
        .from('ad_daily_metrics')
        .select('metric_date,campaign_id,adset_id,ad_id,spend,messages,leads,qualified_leads')
        .gte('metric_date', sinceDate)
        .order('metric_date', {ascending: true}),
      loadLeadQuality(supabase, sinceDate),
      loadChannelMessages(supabase, sinceDate),
      supabase.from('daily_manual_reports').select('report_date,amount,messages').gte('report_date', sinceDate).not('amount', 'is', null).order('report_date', {ascending: true}),
    ]);

    if (accountResult.error) throw accountResult.error;
    if (campaignResult.error) throw campaignResult.error;
    if (adSetResult.error) throw adSetResult.error;
    if (adResult.error) throw adResult.error;
    if (metricResult.error) throw metricResult.error;
    if (manualMetricResult.error) throw manualMetricResult.error;

    const adAccounts = accountResult.data || [];
    const leadQuality = summarizeLeadQuality(leadResult.data || []);
    const leadDaily = normalizeLeadDaily(leadResult.data || []);
    const leadAttributes = (leadResult.data || []).map((lead) => ({
      date: lead.created_at?.slice(0, 10) || '', segment: lead.segment || '', sceneCode: lead.scene_code || '',
    })).filter((row) => row.date);
    const actualLeadAttribution = await loadActualLeadAttribution(supabase, leadResult.data || []);
    const channelMessages = (channelResult.data || []).map((row) => ({date: row.metric_date, source: row.source, messages: money(row.messages)}));
    const campaigns = normalizeCampaigns(campaignResult.data || [], metricResult.data || [], actualLeadAttribution.campaigns);
    const adSetMetrics = aggregateMetrics(metricResult.data || [], 'adset_id');
    const adMetrics = aggregateMetrics(metricResult.data || [], 'ad_id');
    const adSets = (adSetResult.data || []).map((row) => ({
      id: row.id,
      campaignId: row.campaign_id,
      name: row.name,
      status: row.status || 'unknown',
      ...metricValues(adSetMetrics.get(row.id), actualLeadAttribution.adSets.get(row.id)),
    }));
    const ads = (adResult.data || []).map((row) => ({
      id: row.id,
      adSetId: row.adset_id,
      name: row.name,
      status: row.status || 'unknown',
      ...metricValues(adMetrics.get(row.id), actualLeadAttribution.ads.get(row.id)),
    }));
    const daily = normalizeDaily(metricResult.data || [], (manualMetricResult.data || []) as ManualDailyMetricRecord[]);
    const campaignDaily = normalizeCampaignDaily(metricResult.data || []);
    const totals = campaigns.reduce(
      (acc, item) => ({
        spend: acc.spend + item.spend,
        messages: acc.messages + item.messages,
        leads: acc.leads + item.leads,
        qualified: acc.qualified + item.qualified,
        cpl: 0,
      }),
      {spend: 0, messages: 0, leads: 0, qualified: 0, cpl: 0},
    );
    totals.leads = leadQuality.total;
    totals.qualified = leadQuality.qualified;
    totals.spend = daily.reduce((sum, row) => sum + row.spend, 0);
    totals.messages = daily.reduce((sum, row) => sum + row.messages, 0);
    totals.cpl = leadQuality.fanpage > 0 ? totals.spend / leadQuality.fanpage : 0;

    return {adAccounts, campaigns, adSets, ads, daily, campaignDaily, leadQuality, leadDaily, channelMessages, leadAttributes, totals, connected: true};
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không đọc được dữ liệu Supabase';
    return emptyData(true, message);
  }
}

type MetricKey = 'campaign_id' | 'adset_id' | 'ad_id';
type MetricTotal = {spend: number; messages: number; leads: number; qualified: number};

function aggregateMetrics(metrics: MetricRecord[], key: MetricKey) {
  const totals = new Map<string, MetricTotal>();

  for (const metric of metrics) {
    const entityId = metric[key];
    if (!entityId) continue;
    const total = totals.get(entityId) || {spend: 0, messages: 0, leads: 0, qualified: 0};
    total.spend += money(metric.spend);
    total.messages += money(metric.messages);
    total.leads += money(metric.leads);
    total.qualified += money(metric.qualified_leads);
    totals.set(entityId, total);
  }

  return totals;
}

function metricValues(total?: MetricTotal, actualLeads = 0) {
  const value = total || {spend: 0, messages: 0, leads: 0, qualified: 0};
  return {...value, leads: actualLeads, cpl: actualLeads > 0 ? value.spend / actualLeads : 0};
}

function normalizeCampaigns(campaigns: CampaignRecord[], metrics: MetricRecord[], actualLeads: Map<string, number>) {
  const byCampaign = new Map<string, {spend: number; messages: number; leads: number; qualified: number}>();

  for (const metric of metrics) {
    if (!metric.campaign_id) continue;
    const current = byCampaign.get(metric.campaign_id) || {spend: 0, messages: 0, leads: 0, qualified: 0};
    current.spend += money(metric.spend);
    current.messages += money(metric.messages);
    current.leads += money(metric.leads);
    current.qualified += money(metric.qualified_leads);
    byCampaign.set(metric.campaign_id, current);
  }

  return campaigns.map((campaign) => {
    const total = byCampaign.get(campaign.id) || {spend: 0, messages: 0, leads: 0, qualified: 0};
    const crmLeads = actualLeads.get(campaign.id) || 0;
    return {
      id: campaign.id,
      adAccountId: campaign.ad_account_id,
      name: campaign.name,
      status: campaign.status || 'unknown',
      spend: total.spend,
      messages: total.messages,
      leads: crmLeads,
      qualified: total.qualified,
      cpl: crmLeads > 0 ? total.spend / crmLeads : 0,
    };
  });
}

function normalizeDaily(metrics: MetricRecord[], manualMetrics: ManualDailyMetricRecord[]) {
  const byDate = new Map<string, {spend: number; messages: number; leads: number; source: 'Supabase' | 'Nhập tay'}>();

  for (const metric of metrics) {
    const current = byDate.get(metric.metric_date) || {spend: 0, messages: 0, leads: 0, source: 'Supabase'};
    current.spend += money(metric.spend);
    current.messages += money(metric.messages);
    current.leads += money(metric.leads);
    byDate.set(metric.metric_date, current);
  }

  // Số liệu nhập tay là số chốt cuối ngày, nên được ưu tiên hơn dữ liệu Meta
  // của cùng ngày để tránh cộng trùng chi phí và tin nhắn.
  for (const metric of manualMetrics) {
    const current = byDate.get(metric.report_date) || {spend: 0, messages: 0, leads: 0, source: 'Nhập tay'};
    byDate.set(metric.report_date, {...current, spend: money(metric.amount), messages: money(metric.messages), source: 'Nhập tay'});
  }

  return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({
    date,
    day: new Intl.DateTimeFormat('vi-VN', {day: '2-digit', month: '2-digit'}).format(new Date(date)),
    ...value,
  }));
}

function normalizeCampaignDaily(metrics: MetricRecord[]) {
  const totals = new Map<string, MetricTotal>();

  for (const metric of metrics) {
    if (!metric.campaign_id) continue;
    const key = `${metric.metric_date}:${metric.campaign_id}`;
    const total = totals.get(key) || {spend: 0, messages: 0, leads: 0, qualified: 0};
    total.spend += money(metric.spend);
    total.messages += money(metric.messages);
    total.leads += money(metric.leads);
    total.qualified += money(metric.qualified_leads);
    totals.set(key, total);
  }

  return Array.from(totals.entries()).map(([key, value]) => {
    const separator = key.indexOf(':');
    return {date: key.slice(0, separator), campaignId: key.slice(separator + 1), ...value};
  });
}

async function loadLeadQuality(supabase: ReturnType<typeof createServiceClient>, sinceDate: string) {
  let result: {data: LeadQualityRecord[] | null; error: {message: string} | null} = await supabase
    .from('crm_leads')
    .select('id,created_at,customer_id,source,quality,status,segment,scene_code,quote_value')
    .gte('created_at', `${sinceDate}T00:00:00`) as {data: LeadQualityRecord[] | null; error: {message: string} | null};

  if (result.error && ['quality', 'segment', 'scene_code', 'quote_value'].some((column) => result.error?.message.includes(column))) {
    result = await supabase
      .from('crm_leads')
      .select('id,created_at,customer_id,source,status')
      .gte('created_at', `${sinceDate}T00:00:00`) as {data: LeadQualityRecord[] | null; error: {message: string} | null};
  }

  if (result.error) {
    return {data: [] as LeadQualityRecord[]};
  }

  return {data: (result.data || []) as LeadQualityRecord[]};
}

async function loadActualLeadAttribution(supabase: ReturnType<typeof createServiceClient>, leads: LeadQualityRecord[]): Promise<ActualLeadAttribution> {
  const customerIds = [...new Set(leads.map((lead) => lead.customer_id).filter((id): id is string => Boolean(id)))];
  const empty = {campaigns: new Map<string, number>(), adSets: new Map<string, number>(), ads: new Map<string, number>()};
  if (!customerIds.length) return empty;

  const {data, error} = await supabase.from('customer_sources').select('customer_id,campaign_id,adset_id,ad_id').in('customer_id', customerIds);
  if (error) return empty;
  const sources = (data || []) as CustomerSourceRecord[];
  const byCustomer = new Map<string, CustomerSourceRecord[]>();
  for (const source of sources) {
    if (!source.customer_id) continue;
    byCustomer.set(source.customer_id, [...(byCustomer.get(source.customer_id) || []), source]);
  }

  const campaignSets = new Map<string, Set<string>>();
  const adSetSets = new Map<string, Set<string>>();
  const adSets = new Map<string, Set<string>>();
  for (const lead of leads) {
    if (!lead.id || !lead.customer_id) continue;
    for (const source of byCustomer.get(lead.customer_id) || []) {
      addAttributedLead(campaignSets, source.campaign_id, lead.id);
      addAttributedLead(adSetSets, source.adset_id, lead.id);
      addAttributedLead(adSets, source.ad_id, lead.id);
    }
  }

  return {campaigns: countAttributedLeads(campaignSets), adSets: countAttributedLeads(adSetSets), ads: countAttributedLeads(adSets)};
}

function addAttributedLead(target: Map<string, Set<string>>, entityId: string | null, leadId: string) {
  if (!entityId) return;
  const ids = target.get(entityId) || new Set<string>();
  ids.add(leadId);
  target.set(entityId, ids);
}

function countAttributedLeads(source: Map<string, Set<string>>) {
  return new Map(Array.from(source, ([id, leads]) => [id, leads.size]));
}

async function loadChannelMessages(supabase: ReturnType<typeof createServiceClient>, sinceDate: string) {
  const result = await supabase.from('crm_channel_daily_metrics').select('metric_date,source,messages').gte('metric_date', sinceDate).order('metric_date', {ascending: true});
  if (result.error) return {data: [] as ChannelMetricRecord[]};
  return {data: (result.data || []) as ChannelMetricRecord[]};
}

function summarizeLeadQuality(leads: LeadQualityRecord[]) {
  const summary = {
    total: leads.length, qualified: 0, reviewing: 0, unqualified: 0,
    fanpage: 0, fanpageQualified: 0, contracts: 0, fanpageContracts: 0, revenue: 0, tiktok: 0, youtube: 0, website: 0,
  };

  for (const lead of leads) {
    const quality = lead.quality || qualityFromStatus(lead.status || '');
    if (lead.source === 'Fanpage') summary.fanpage += 1;
    if (lead.source === 'Tiktok') summary.tiktok += 1;
    if (lead.source === 'Youtube') summary.youtube += 1;
    if (lead.source === 'Website') summary.website += 1;
    if (lead.status === 'Chốt hợp đồng') {
      summary.contracts += 1;
      summary.revenue += money(lead.quote_value);
      if (lead.source === 'Fanpage') summary.fanpageContracts += 1;
    }
    if (quality === 'Đạt chất lượng') summary.qualified += 1;
    else if (quality === 'Không phù hợp') summary.unqualified += 1;
    else summary.reviewing += 1;
    if (lead.source === 'Fanpage' && quality === 'Đạt chất lượng') summary.fanpageQualified += 1;
  }

  return summary;
}

function normalizeLeadDaily(leads: LeadQualityRecord[]) {
  const byDate = new Map<string, LeadQualityRecord[]>();
  for (const lead of leads) {
    const date = lead.created_at?.slice(0, 10);
    if (!date) continue;
    byDate.set(date, [...(byDate.get(date) || []), lead]);
  }
  return Array.from(byDate, ([date, rows]) => ({date, ...summarizeLeadQuality(rows)}));
}

function qualityFromStatus(status: string) {
  if (['Lên showroom', 'Tư vấn tại nhà', 'Chốt hợp đồng', 'Đi khảo sát', 'Gửi báo giá'].includes(status)) {
    return 'Đạt chất lượng';
  }
  if (status === 'Chưa nghe máy') {
    return 'Đang đánh giá';
  }
  return 'Đang đánh giá';
}

function formatDateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function emptyData(connected: boolean, error?: string): DashboardData {
  return {
    adAccounts: [],
    campaigns: [],
    adSets: [],
    ads: [],
    daily: [],
    campaignDaily: [],
    leadQuality: {total: 0, qualified: 0, reviewing: 0, unqualified: 0, fanpage: 0, fanpageQualified: 0, contracts: 0, fanpageContracts: 0, revenue: 0, tiktok: 0, youtube: 0, website: 0},
    leadDaily: [],
    channelMessages: [],
    leadAttributes: [],
    totals: {spend: 0, messages: 0, leads: 0, qualified: 0, cpl: 0},
    connected,
    error,
  };
}
