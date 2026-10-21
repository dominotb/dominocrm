'use server';
import {revalidatePath, updateTag} from 'next/cache';
import {requireCurrentProfile} from '@/lib/auth';
import {createServiceClient} from '@/lib/supabase';
export async function saveDailyManualReport(formData: FormData) {
  const user = await requireCurrentProfile();
  const reportDate = String(formData.get('reportDate') || '').trim();
  const rawAmount = String(formData.get('amount') || '').trim();
  const rawMessages = String(formData.get('messages') || '').trim();
  const amount = Number(rawAmount);
  const messages = Number(rawMessages);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate) || !rawAmount || !rawMessages || !Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(messages) || messages < 0) {
    throw new Error('Ngày báo cáo, số tiền hoặc số lượng Mess không hợp lệ.');
  }
  const supabase = createServiceClient();
  const existing = await supabase.from('daily_manual_reports').select('id').eq('report_date', reportDate).maybeSingle();
  if (existing.error) throw new Error(`Không thể kiểm tra số liệu ngày: ${existing.error.message}`);
  const payload = {report_date: reportDate, amount, messages, updated_by: user.id, updated_at: new Date().toISOString()};
  const result = existing.data ? await supabase.from('daily_manual_reports').update(payload).eq('id', existing.data.id) : await supabase.from('daily_manual_reports').insert({...payload, created_by: user.id});
  if (result.error) throw new Error(`Không thể lưu số liệu ngày: ${result.error.message}`);
  updateTag('dashboard-data');
  revalidatePath('/ads/reports');
  revalidatePath('/');
}
