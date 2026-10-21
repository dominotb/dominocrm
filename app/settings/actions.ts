'use server';

import {revalidatePath} from 'next/cache';
import {requireCurrentProfile} from '@/lib/auth';
import {settingGroups, type SettingGroupKey} from '@/lib/settings';
import {createServiceClient} from '@/lib/supabase';

const validGroups = settingGroups.map((group) => group.key);

export async function createChecklistItem(formData: FormData) {
  await requireCurrentProfile();
  const groupKey = text(formData.get('groupKey')) as SettingGroupKey;
  const label = text(formData.get('label'));
  const value = text(formData.get('value')) || label;
  const sortOrder = Number(formData.get('sortOrder') || 0);

  if (!validGroups.includes(groupKey) || !label) {
    return;
  }

  const supabase = createServiceClient();
  const {error} = await supabase.from('crm_checklist_items').insert({
    group_key: groupKey,
    label,
    value,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    is_active: true,
  });

  if (error) return;
  revalidatePath('/settings');
}

export async function updateChecklistItem(formData: FormData) {
  await requireCurrentProfile();
  const id = text(formData.get('id'));
  const label = text(formData.get('label'));
  const value = text(formData.get('value')) || label;
  const sortOrder = Number(formData.get('sortOrder') || 0);
  const isActive = formData.get('isActive') === 'on';

  if (!id || !label) {
    return;
  }

  const supabase = createServiceClient();
  const {error} = await supabase.from('crm_checklist_items').update({
    label,
    value,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    is_active: isActive,
  }).eq('id', id);

  if (error) return;
  revalidatePath('/settings');
}

export async function deleteChecklistItem(formData: FormData) {
  await requireCurrentProfile();
  const id = text(formData.get('id'));
  if (!id) return;

  const supabase = createServiceClient();
  const {error} = await supabase.from('crm_checklist_items').delete().eq('id', id);

  if (error) return;
  revalidatePath('/settings');
}

function text(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}
