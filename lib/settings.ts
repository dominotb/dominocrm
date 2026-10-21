import {cache} from 'react';
import {createServiceClient, hasSupabaseConfig} from './supabase';

export const settingGroups = [
  {key: 'segments', title: 'Tên phân khúc', placeholder: 'VD: BASIC - TIÊU CHUẨN'},
  {key: 'scene_codes', title: 'Mã bo cánh', placeholder: 'VD: TVT-02'},
  {key: 'lead_statuses', title: 'Tình trạng lead', placeholder: 'VD: Chưa nghe máy'},
  {key: 'lead_quality', title: 'Đánh giá chất lượng', placeholder: 'VD: Đạt chất lượng'},
  {key: 'job_positions', title: 'Chức vụ nhân viên', placeholder: 'VD: Nhân viên Content'},
  {key: 'work_branches', title: 'Nhánh công việc', placeholder: 'VD: Content'},
] as const;

export type SettingGroupKey = typeof settingGroups[number]['key'];
export type ChecklistItem = {
  id: string;
  groupKey: SettingGroupKey;
  label: string;
  value: string;
  isActive: boolean;
  sortOrder: number;
};
export type IntegrationConnection = {provider: string; displayName: string; status: string; connectedAt: string; accountCount: number; businessCount: number};
export const getIntegrationConnections = cache(async () => {
  if (!hasSupabaseConfig()) return [] as IntegrationConnection[];
  const {data, error} = await createServiceClient().from('integration_connections').select('provider,display_name,status,connected_at,metadata').order('connected_at', {ascending: false});
  if (error) return [] as IntegrationConnection[];
  return (data || []).map((row) => ({provider: row.provider, displayName: row.display_name || '', status: row.status, connectedAt: row.connected_at, accountCount: Array.isArray(row.metadata?.ad_accounts) ? row.metadata.ad_accounts.length : 0, businessCount: Array.isArray(row.metadata?.businesses) ? row.metadata.businesses.length : 0}));
});

type ChecklistRecord = {
  id: string;
  group_key: SettingGroupKey;
  label: string;
  value: string | null;
  is_active: boolean | null;
  sort_order: number | null;
};

export const getChecklistItems = cache(async () => {
  if (!hasSupabaseConfig()) {
    return {items: [] as ChecklistItem[], error: 'Chưa cấu hình Supabase env'};
  }

  const supabase = createServiceClient();
  const {data, error} = await supabase
    .from('crm_checklist_items')
    .select('id,group_key,label,value,is_active,sort_order')
    .order('group_key')
    .order('sort_order')
    .order('label');

  if (error) {
    return {items: [] as ChecklistItem[], error: error.message};
  }

  return {items: (data || []).map(normalizeItem), error: ''};
});

function normalizeItem(row: ChecklistRecord): ChecklistItem {
  return {
    id: row.id,
    groupKey: row.group_key,
    label: row.label,
    value: row.value || row.label,
    isActive: row.is_active !== false,
    sortOrder: Number(row.sort_order || 0),
  };
}
