'use client';

import {useActionState, useEffect, useMemo, useRef, useState} from 'react';
import type {DashboardData} from '@/lib/data-model';
import {fmt} from '@/lib/data-model';
import type {MarketingPlan} from '@/lib/plans';
import {createPlanAction, type CreatePlanState} from '@/app/ads/plans/actions';
import styles from './PlansClient.module.css';

const initialState: CreatePlanState = {};

export function PlansClient({data, plans}: {data: DashboardData; plans: MarketingPlan[]}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(createPlanAction, initialState);
  const [entityType, setEntityType] = useState<'none' | 'campaign' | 'adset' | 'ad'>('none');
  const [campaignId, setCampaignId] = useState('');
  const [adSetId, setAdSetId] = useState('');
  const adSets = useMemo(() => data.adSets.filter((item) => item.campaignId === campaignId), [campaignId, data.adSets]);
  const ads = useMemo(() => data.ads.filter((item) => item.adSetId === adSetId), [adSetId, data.ads]);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
  const currentPlans = plans.filter((plan) => plan.startsOn <= monthEnd && plan.endsOn >= today.slice(0, 7) + '-01');
  const totals = currentPlans.reduce((sum, plan) => ({
    budget: sum.budget + plan.budget,
    messages: sum.messages + plan.targetMessages,
    leads: sum.leads + plan.targetLeads,
    cpl: sum.cpl + plan.targetCpl,
  }), {budget: 0, messages: 0, leads: 0, cpl: 0});
  const entityNames = new Map([
    ...data.campaigns.map((item) => [item.id, item.name] as const),
    ...data.adSets.map((item) => [item.id, item.name] as const),
    ...data.ads.map((item) => [item.id, item.name] as const),
  ]);

  useEffect(() => {
    if (state.success) dialogRef.current?.close();
  }, [state.success]);

  function changeEntityType(value: 'none' | 'campaign' | 'adset' | 'ad') {
    setEntityType(value);
    setCampaignId('');
    setAdSetId('');
  }

  return <>
    <div className="page-head">
      <div><h2>Kế hoạch tháng {now.getMonth() + 1}</h2><p>Liên kết mục tiêu với Campaign / Ad Set / Ad thực tế.</p></div>
      <button className="primary" type="button" onClick={() => dialogRef.current?.showModal()}>+ Tạo kế hoạch</button>
    </div>
    {state.success ? <div className={`${styles.message} ${styles.success}`}>{state.success}</div> : null}
    <div className="kpis">
      <div className="card kpi"><span>Ngân sách</span><strong>{fmt(totals.budget)}</strong><small>{currentPlans.length ? `${currentPlans.length} kế hoạch trong tháng` : 'Chưa có kế hoạch'}</small></div>
      <div className="card kpi"><span>Mục tiêu Mess</span><strong>{totals.messages}</strong><small>{currentPlans.length ? 'Tổng mục tiêu trong tháng' : 'Chưa có dữ liệu'}</small></div>
      <div className="card kpi"><span>Mục tiêu Lead</span><strong>{totals.leads}</strong><small>{currentPlans.length ? 'Tổng mục tiêu trong tháng' : 'Chưa có dữ liệu'}</small></div>
      <div className="card kpi"><span>Target CPL</span><strong>{fmt(currentPlans.length ? totals.cpl / currentPlans.length : 0)}</strong><small>{currentPlans.length ? 'Trung bình các kế hoạch' : 'Chưa có dữ liệu'}</small></div>
    </div>
    <section className={styles.plans}>
      <h3>Danh sách kế hoạch</h3>
      {plans.length ? <div className="desktop-table"><table><thead><tr><th>Kế hoạch</th><th>Thời gian</th><th>Ngân sách</th><th>Mess</th><th>Lead</th><th>Target CPL</th></tr></thead><tbody>{plans.map((plan) => <tr key={plan.id}><td><b>{plan.name}</b><span className={styles.entity}>{plan.entityType ? `${plan.entityType.toUpperCase()}: ${entityNames.get(plan.entityId || '') || plan.entityId}` : 'Chưa liên kết'}</span></td><td>{plan.startsOn} → {plan.endsOn}</td><td>{fmt(plan.budget)}</td><td>{plan.targetMessages}</td><td>{plan.targetLeads}</td><td>{fmt(plan.targetCpl)}</td></tr>)}</tbody></table></div> : <div className={styles.empty}>Chưa có kế hoạch. Nhấn “+ Tạo kế hoạch” để bắt đầu.</div>}
    </section>

    <dialog ref={dialogRef} className={styles.dialog} onCancel={() => dialogRef.current?.close()}>
      <div className={styles.dialogHead}><div><h3>Tạo kế hoạch quảng cáo</h3><p>Thiết lập ngân sách, mục tiêu và đối tượng áp dụng.</p></div><button className={styles.close} type="button" aria-label="Đóng" onClick={() => dialogRef.current?.close()}>×</button></div>
      <form action={formAction} className={styles.form}>
        {state.error ? <div className={`${styles.message} ${styles.error}`}>{state.error}</div> : null}
        <div className={styles.grid}>
          <label className={`${styles.field} ${styles.wide}`}>Tên kế hoạch<input name="name" required placeholder="Ví dụ: Kế hoạch Meta tháng 10"/></label>
          <label className={styles.field}>Ngày bắt đầu<input name="startsOn" type="date" required defaultValue={today}/></label>
          <label className={styles.field}>Ngày kết thúc<input name="endsOn" type="date" required defaultValue={monthEnd}/></label>
          <label className={styles.field}>Ngân sách (₫)<input name="budget" type="number" min="0" step="1000" required defaultValue="0"/></label>
          <label className={styles.field}>Target CPL (₫)<input name="targetCpl" type="number" min="0" step="1000" required defaultValue="0"/></label>
          <label className={styles.field}>Mục tiêu Mess<input name="targetMessages" type="number" min="0" required defaultValue="0"/></label>
          <label className={styles.field}>Mục tiêu Lead<input name="targetLeads" type="number" min="0" required defaultValue="0"/></label>
          <label className={styles.field}>Lead đạt chất lượng<input name="targetQualifiedLeads" type="number" min="0" required defaultValue="0"/></label>
          <label className={styles.field}>Cấp áp dụng<select name="entityType" value={entityType} onChange={(event) => changeEntityType(event.target.value as typeof entityType)}><option value="none">Không áp dụng Campaign nào</option><option value="campaign">Campaign</option><option value="adset">Ad Set</option><option value="ad">Quảng cáo</option></select></label>
          {entityType === 'adset' || entityType === 'ad' ? <label className={styles.field}>Campaign<select value={campaignId} required onChange={(event) => {setCampaignId(event.target.value); setAdSetId('');}}><option value="">Chọn Campaign</option>{data.campaigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
          {entityType === 'ad' ? <label className={styles.field}>Ad Set<select value={adSetId} required onChange={(event) => setAdSetId(event.target.value)}><option value="">Chọn Ad Set</option>{adSets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
          {entityType !== 'none' ? <label className={styles.field}>{entityType === 'campaign' ? 'Campaign' : entityType === 'adset' ? 'Ad Set' : 'Quảng cáo'}<select name="entityId" required disabled={entityType === 'adset' ? !campaignId : entityType === 'ad' ? !adSetId : false}><option value="">Chọn đối tượng</option>{(entityType === 'campaign' ? data.campaigns : entityType === 'adset' ? adSets : ads).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
        </div>
        <div className={styles.actions}><button className={styles.secondary} type="button" onClick={() => dialogRef.current?.close()}>Hủy</button><button className="primary" type="submit" disabled={pending}>{pending ? 'Đang lưu...' : 'Tạo kế hoạch'}</button></div>
      </form>
    </dialog>
  </>;
}
