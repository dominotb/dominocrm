import {cache} from 'react';
import {createServiceClient, hasSupabaseConfig} from './supabase';

export const leadSources = ['Tiktok', 'Website', 'Fanpage', 'Youtube', 'Khách tự đến showroom'] as const;
export const leadStatuses = ['Đang tiếp nhận', 'Gửi báo giá', 'Lên showroom', 'Tư vấn tại nhà', 'Chốt hợp đồng', 'Giới thiệu khách mới', 'Sổ quét', 'Đi khảo sát', 'Chưa nghe máy'] as const;
export const leadQualities = ['Đang đánh giá', 'Đạt chất lượng', 'Không phù hợp'] as const;

export type LeadSource = typeof leadSources[number];
export type LeadStatus = typeof leadStatuses[number];
export type LeadQuality = typeof leadQualities[number];

export type LeadRow = {
  id: string;
  createdAt: string;
  accountName: string;
  source: LeadSource;
  realName: string;
  phone: string;
  hasZalo: boolean;
  address: string;
  accountLink: string;
  status: LeadStatus;
  quality: LeadQuality;
  description: string;
  segment: string;
  sceneCode: string;
  quoteValue: number | null;
  endedAt: string;
  endReason: string;
};

type LeadRecord = {
  id: string;
  created_at: string;
  account_name: string | null;
  source: LeadSource;
  real_name: string | null;
  phone: string | null;
  has_zalo?: boolean | null;
  address: string | null;
  account_link: string | null;
  status: LeadStatus;
  quality?: LeadQuality | null;
  description: string | null;
  segment?: string | null;
  scene_code?: string | null;
  quote_value?: number | string | null;
  ended_at?: string | null;
  end_reason?: string | null;
};

export const getLeads = cache(async () => {
  if (!hasSupabaseConfig()) {
    return {leads: [] as LeadRow[], error: 'Chưa cấu hình Supabase env'};
  }

  const supabase = createServiceClient();
  let result: {data: LeadRecord[] | null; error: {message: string} | null} = await supabase
    .from('crm_leads')
    .select('id,created_at,account_name,source,real_name,phone,has_zalo,address,account_link,status,quality,description,segment,scene_code,quote_value,ended_at,end_reason')
    .order('created_at', {ascending: false})
    .limit(300) as {data: LeadRecord[] | null; error: {message: string} | null};

  if (result.error && ['quality', 'segment', 'scene_code', 'quote_value', 'ended_at', 'end_reason'].some((column) => result.error?.message.includes(column))) {
    result = await supabase
      .from('crm_leads')
      .select('id,created_at,account_name,source,real_name,phone,address,account_link,status,description')
      .order('created_at', {ascending: false})
      .limit(300) as {data: LeadRecord[] | null; error: {message: string} | null};
  }

  if (result.error) {
    return {leads: [] as LeadRow[], error: result.error.message};
  }

  return {
    leads: (result.data || []).map(normalizeLead),
    error: '',
  };
});

function normalizeLead(row: LeadRecord): LeadRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    accountName: row.account_name || '',
    source: row.source,
    realName: row.real_name || '',
    phone: row.phone || '',
    hasZalo: Boolean(row.has_zalo),
    address: row.address || '',
    accountLink: row.account_link || '',
    status: row.status,
    quality: row.quality || 'Đang đánh giá',
    description: row.description || '',
    segment: row.segment || '',
    sceneCode: row.scene_code || '',
    quoteValue: row.quote_value == null ? null : Number(row.quote_value),
    endedAt: row.ended_at || '',
    endReason: row.end_reason || '',
  };
}
