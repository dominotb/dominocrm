'use server';

import {revalidatePath} from 'next/cache';
import {requireCurrentProfile} from '@/lib/auth';
import type {LeadRow} from '@/lib/leads';
import {leadQualities, leadSources, leadStatuses} from '@/lib/leads';
import {createServiceClient} from '@/lib/supabase';

type CreateLeadResult = {ok: true; lead: LeadRow} | {ok: false; error: string; detail?: string};
type UpdateLeadResult = CreateLeadResult;
type DeleteLeadResult = {ok: true; leadId: string} | {ok: false; error: string; detail?: string};

const leadSelect = 'id,created_at,account_name,source,real_name,phone,has_zalo,address,account_link,status,quality,description,segment,scene_code,quote_value,ended_at,end_reason';

export async function createLeadAction(formData: FormData): Promise<CreateLeadResult> {
  const user = await requireCurrentProfile();
  const accountName = text(formData.get('accountName'));
  const source = text(formData.get('source'));
  const realName = text(formData.get('realName'));
  const phone = text(formData.get('phone'));
  const hasZalo = formData.get('hasZalo') === 'on';
  const address = text(formData.get('address'));
  const accountLink = text(formData.get('accountLink'));
  const status = 'Đang tiếp nhận';
  const description = text(formData.get('description'));

  const displayName = realName || accountName;

  if (!accountName || (!phone && !hasZalo) || !leadSources.includes(source as never) || !leadStatuses.includes(status as never)) {
    return {ok: false, error: 'missing'};
  }

  const supabase = createServiceClient();
  const customerPayload = {full_name: displayName, phone: phone || null};
  const customer = phone
    ? await supabase.from('customers').upsert(customerPayload, {onConflict: 'phone'}).select('id').single()
    : await supabase.from('customers').insert(customerPayload).select('id').single();

  if (customer.error) {
    return {ok: false, error: 'customer'};
  }

  const sourceRow = await supabase.from('customer_sources').insert({
    customer_id: customer.data.id,
    platform: source.toLowerCase(),
    first_touch_at: new Date().toISOString(),
  });

  if (sourceRow.error) {
    return {ok: false, error: 'source'};
  }

  const lead = await supabase.from('crm_leads').insert({
    customer_id: customer.data.id,
    account_name: accountName,
    source,
    real_name: realName || null,
    phone: phone || null,
    has_zalo: hasZalo,
    address,
    account_link: accountLink,
    status,
    description,
    created_by: user.id,
  }).select(leadSelect).single();

  if (lead.error) {
    return {ok: false, error: 'lead', detail: lead.error.message};
  }

  revalidatePath('/leads');
  return {
    ok: true,
    lead: {
      id: lead.data.id,
      createdAt: lead.data.created_at,
      accountName: lead.data.account_name || '',
      source: lead.data.source,
      realName: lead.data.real_name || '',
      phone: lead.data.phone || '',
      hasZalo: Boolean(lead.data.has_zalo),
      address: lead.data.address || '',
      accountLink: lead.data.account_link || '',
      status: lead.data.status,
      quality: lead.data.quality || 'Đang đánh giá',
      description: lead.data.description || '',
      segment: lead.data.segment || '',
      sceneCode: lead.data.scene_code || '',
      quoteValue: lead.data.quote_value == null ? null : Number(lead.data.quote_value),
      endedAt: lead.data.ended_at || '',
      endReason: lead.data.end_reason || '',
    },
  };
}

export async function updateLeadQualityAction(leadId: string, quality: LeadRow['quality']): Promise<{ok: boolean; error?: string}> {
  await requireCurrentProfile();
  if (!leadId || !leadQualities.includes(quality)) return {ok: false, error: 'invalid'};

  const {error} = await createServiceClient().from('crm_leads').update({quality}).eq('id', leadId);
  if (error) return {ok: false, error: error.message};

  revalidatePath('/leads');
  return {ok: true};
}

export async function updateLeadAction(leadId: string, formData: FormData): Promise<UpdateLeadResult> {
  await requireCurrentProfile();
  const accountName = text(formData.get('accountName'));
  const source = text(formData.get('source'));
  const realName = text(formData.get('realName'));
  const phone = text(formData.get('phone'));
  const hasZalo = formData.get('hasZalo') === 'on';
  const address = text(formData.get('address'));
  const accountLink = text(formData.get('accountLink'));
  const status = text(formData.get('status'));
  const quality = text(formData.get('quality')) as LeadRow['quality'];
  const description = text(formData.get('description'));
  const segment = text(formData.get('segment'));
  const sceneCode = text(formData.get('sceneCode'));
  const quoteValueText = text(formData.get('quoteValue'));
  const quoteValue = quoteValueText ? Number(quoteValueText) : null;

  if (!leadId || !accountName || (!phone && !hasZalo) || !leadSources.includes(source as never) || !leadStatuses.includes(status as never) || !leadQualities.includes(quality) || (quoteValue !== null && (!Number.isFinite(quoteValue) || quoteValue < 0))) {
    return {ok: false, error: 'missing'};
  }

  const {data, error} = await createServiceClient().from('crm_leads').update({
    account_name: accountName,
    source,
    real_name: realName || null,
    phone: phone || null,
    has_zalo: hasZalo,
    address,
    account_link: accountLink,
    status,
    quality,
    description,
    segment: segment || null,
    scene_code: sceneCode || null,
    quote_value: quoteValue,
  }).eq('id', leadId).select(leadSelect).single();

  if (error) return {ok: false, error: 'lead', detail: error.message};

  revalidatePath('/leads');
  return {ok: true, lead: {
    id: data.id,
    createdAt: data.created_at,
    accountName: data.account_name || '',
    source: data.source,
    realName: data.real_name || '',
    phone: data.phone || '',
    hasZalo: Boolean(data.has_zalo),
    address: data.address || '',
    accountLink: data.account_link || '',
    status: data.status,
    quality: data.quality || 'Đang đánh giá',
    description: data.description || '',
    segment: data.segment || '',
    sceneCode: data.scene_code || '',
    quoteValue: data.quote_value == null ? null : Number(data.quote_value),
    endedAt: data.ended_at || '',
    endReason: data.end_reason || '',
  }};
}

export async function endProjectAction(leadId: string, reason: string): Promise<UpdateLeadResult> {
  await requireCurrentProfile();
  const endReason = reason.trim();
  if (!leadId || !endReason) return {ok: false, error: 'missing'};

  const {data, error} = await createServiceClient().from('crm_leads').update({
    ended_at: new Date().toISOString(),
    end_reason: endReason,
  }).eq('id', leadId).select(leadSelect).single();

  if (error) return {ok: false, error: 'lead', detail: error.message};
  revalidatePath('/leads');
  revalidatePath('/');
  return {ok: true, lead: {
    id: data.id, createdAt: data.created_at, accountName: data.account_name || '', source: data.source,
    realName: data.real_name || '', phone: data.phone || '', hasZalo: Boolean(data.has_zalo), address: data.address || '',
    accountLink: data.account_link || '', status: data.status, quality: data.quality || 'Đang đánh giá', description: data.description || '',
    segment: data.segment || '', sceneCode: data.scene_code || '', quoteValue: data.quote_value == null ? null : Number(data.quote_value),
    endedAt: data.ended_at || '', endReason: data.end_reason || '',
  }};
}

export async function deleteLeadAction(leadId: string): Promise<DeleteLeadResult> {
  await requireCurrentProfile();
  if (!leadId) return {ok: false, error: 'missing'};

  const {data, error} = await createServiceClient()
    .from('crm_leads')
    .delete()
    .eq('id', leadId)
    .select('id')
    .single();

  if (error) return {ok: false, error: 'delete', detail: error.message};

  revalidatePath('/leads');
  revalidatePath('/');
  return {ok: true, leadId: data.id};
}

function text(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}
