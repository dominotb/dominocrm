'use server';

import {revalidatePath} from 'next/cache';
import {requireCurrentProfile} from '@/lib/auth';
import {createServiceClient} from '@/lib/supabase';

export type CreatePlanState = {error?: string; success?: string};

const entityTables = {
  campaign: 'meta_campaigns',
  adset: 'meta_adsets',
  ad: 'meta_ads',
} as const;

function numberField(formData: FormData, name: string) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) && value >= 0 ? value : NaN;
}

export async function createPlanAction(_state: CreatePlanState, formData: FormData): Promise<CreatePlanState> {
  const user = await requireCurrentProfile();
  const name = String(formData.get('name') || '').trim();
  const startsOn = String(formData.get('startsOn') || '');
  const endsOn = String(formData.get('endsOn') || '');
  const entityType = String(formData.get('entityType') || 'none');
  const entityId = String(formData.get('entityId') || '');
  const budget = numberField(formData, 'budget');
  const targetMessages = numberField(formData, 'targetMessages');
  const targetLeads = numberField(formData, 'targetLeads');
  const targetQualifiedLeads = numberField(formData, 'targetQualifiedLeads');
  const targetCpl = numberField(formData, 'targetCpl');

  if (!name || !startsOn || !endsOn) return {error: 'Vui lòng nhập tên và thời gian kế hoạch.'};
  if (endsOn < startsOn) return {error: 'Ngày kết thúc phải từ ngày bắt đầu trở đi.'};
  if ([budget, targetMessages, targetLeads, targetQualifiedLeads, targetCpl].some(Number.isNaN)) {
    return {error: 'Các mục tiêu phải là số không âm.'};
  }
  if (entityType !== 'none' && (!(entityType in entityTables) || !entityId)) {
    return {error: 'Vui lòng chọn đối tượng quảng cáo cần liên kết.'};
  }

  const service = createServiceClient();
  if (entityType !== 'none') {
    const table = entityTables[entityType as keyof typeof entityTables];
    const {data: entity, error: entityError} = await service.from(table).select('id').eq('id', entityId).maybeSingle();
    if (entityError || !entity) return {error: 'Đối tượng quảng cáo đã chọn không còn tồn tại.'};
  }

  const {data: plan, error: planError} = await service.from('marketing_plans').insert({
    name,
    starts_on: startsOn,
    ends_on: endsOn,
    budget,
    target_messages: targetMessages,
    target_leads: targetLeads,
    target_qualified_leads: targetQualifiedLeads,
    target_cpl: targetCpl,
    created_by: user.id,
  }).select('id').single();

  if (planError || !plan) return {error: planError?.message || 'Không thể tạo kế hoạch.'};

  if (entityType !== 'none') {
    const {error: linkError} = await service.from('marketing_plan_entities').insert({
      plan_id: plan.id,
      entity_type: entityType,
      entity_id: entityId,
    });
    if (linkError) {
      await service.from('marketing_plans').delete().eq('id', plan.id);
      return {error: linkError.message};
    }
  }

  revalidatePath('/ads/plans');
  return {success: 'Đã tạo kế hoạch thành công.'};
}
