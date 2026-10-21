import {cache} from 'react';
import {createServiceClient, hasSupabaseConfig} from './supabase';
export type DailyManualReport = {id: string; reportDate: string; amount: number; messages: number; updatedAt: string};
export const getDailyManualReports = cache(async () => {
  if (!hasSupabaseConfig()) return [] as DailyManualReport[];
  const {data, error} = await createServiceClient().from('daily_manual_reports').select('id,report_date,amount,messages,updated_at').not('amount', 'is', null).order('report_date', {ascending: false}).limit(60);
  if (error) return [] as DailyManualReport[];
  return (data || []).map((row) => ({id: row.id, reportDate: row.report_date, amount: Number(row.amount), messages: Number(row.messages || 0), updatedAt: row.updated_at}));
});
