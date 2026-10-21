'use client';

import {useMemo, useState} from 'react';
import AppShell from './AppShell';
import type {CurrentProfile} from '@/lib/auth';
import type {DashboardData} from '@/lib/data-model';
import {fmt} from '@/lib/data-model';
import type {DailyManualReport} from '@/lib/daily-reports';

export function Campaigns({data, user}: {data: DashboardData; user: CurrentProfile}) {
  const [accountId, setAccountId] = useState(data.adAccounts.length === 1 ? data.adAccounts[0].id : '');
  const [campaignId, setCampaignId] = useState('');
  const [adSetId, setAdSetId] = useState('');
  const [adId, setAdId] = useState('');
  const campaigns = useMemo(
    () => data.campaigns.filter((campaign) => !accountId || campaign.adAccountId === accountId),
    [accountId, data.campaigns],
  );
  const adSets = useMemo(
    () => campaignId ? data.adSets.filter((adSet) => adSet.campaignId === campaignId) : [],
    [campaignId, data.adSets],
  );
  const ads = useMemo(
    () => adSetId ? data.ads.filter((ad) => ad.adSetId === adSetId) : [],
    [adSetId, data.ads],
  );
  const visibleCampaigns = campaignId ? campaigns.filter((campaign) => campaign.id === campaignId) : campaigns;
  const visibleRows = adSetId
    ? (adId ? ads.filter((ad) => ad.id === adId) : ads)
    : campaignId
      ? adSets
      : visibleCampaigns;
  const entityLabel = adSetId ? 'Quảng cáo' : campaignId ? 'Nhóm quảng cáo' : 'Campaign';

  function selectAccount(value: string) {
    setAccountId(value);
    setCampaignId('');
    setAdSetId('');
    setAdId('');
  }

  function selectCampaign(value: string) {
    setCampaignId(value);
    setAdSetId('');
    setAdId('');
  }

  function selectAdSet(value: string) {
    setAdSetId(value);
    setAdId('');
  }

  return <AppShell title="Quản lý quảng cáo" user={user}>
    <div className="card page-card">
      <div className="page-head">
        <div><h2>Campaign → Ad Set → Ad</h2><p>Dữ liệu đọc từ Supabase sau khi đồng bộ Meta.</p></div>
        <form action="/api/meta/sync" method="post"><button className="primary">Đồng bộ Meta</button></form>
      </div>
      {data.error ? <div className="notice">{data.error}</div> : null}
      <div className="hierarchy">
        <div className="field"><label>Tài khoản quảng cáo</label><select value={accountId} onChange={(event) => selectAccount(event.target.value)}><option value="">Tất cả tài khoản</option>{data.adAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></div>
        <div className="field"><label>Campaign</label><select value={campaignId} onChange={(event) => selectCampaign(event.target.value)}><option value="">Tất cả Campaign ({campaigns.length})</option>{campaigns.map((campaign) => <option value={campaign.id} key={campaign.id}>{campaign.name}</option>)}</select></div>
        <div className="field"><label>Ad Set</label><select value={adSetId} disabled={!campaignId} onChange={(event) => selectAdSet(event.target.value)}><option value="">{campaignId ? `Tất cả nhóm quảng cáo (${adSets.length})` : 'Chọn Campaign trước'}</option>{adSets.map((adSet) => <option value={adSet.id} key={adSet.id}>{adSet.name}</option>)}</select></div>
        <div className="field"><label>Quảng cáo</label><select value={adId} disabled={!adSetId} onChange={(event) => setAdId(event.target.value)}><option value="">{adSetId ? `Tất cả quảng cáo (${ads.length})` : 'Chọn Ad Set trước'}</option>{ads.map((ad) => <option value={ad.id} key={ad.id}>{ad.name}</option>)}</select></div>
      </div>
      <div className="desktop-table hierarchy-table"><table><thead><tr><th>{entityLabel}</th><th>Trạng thái</th><th>Chi tiêu</th><th>Mess</th><th title="Lead thực tế đã ghi nhận trong CRM và liên kết đúng nguồn quảng cáo">Lead CRM</th><th>CPL thực tế</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.id}><td><b>{row.name}</b></td><td><span className={'status ' + (row.status === 'ACTIVE' ? 'on' : 'off')}>{row.status}</span></td><td>{fmt(row.spend)}</td><td>{row.messages}</td><td>{row.leads}</td><td>{row.leads ? fmt(row.cpl) : '—'}</td></tr>)}</tbody></table></div>
      {!visibleRows.length ? <div className="empty hierarchy-empty">Không có {entityLabel.toLocaleLowerCase('vi-VN')} phù hợp với bộ lọc.</div> : null}
    </div>
  </AppShell>;
}

export function Reports({data, user, manualReports, saveAction}: {data: DashboardData; user: CurrentProfile; manualReports: DailyManualReport[]; saveAction: (formData: FormData) => Promise<void>}) {
  const today = new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Bangkok'});
  return <AppShell title="Báo cáo hàng ngày" user={user}>
    <div className="card page-card manual-report-card">
      <div className="page-head"><div><h2>Số liệu nhập tay</h2><p>Nhập tổng chi phí quảng cáo và số lượng Mess trong một ngày.</p></div></div>
      <form action={saveAction} className="manual-report-form">
        <div className="field"><label>Ngày báo cáo</label><input name="reportDate" type="date" defaultValue={today} required /></div>
        <div className="field manual-report-content"><label>Số tiền trong ngày (VNĐ)</label><input name="amount" type="number" min="0" step="1" inputMode="numeric" placeholder="Ví dụ: 1500000" required /></div>
        <div className="field"><label>Số lượng Mess</label><input name="messages" type="number" min="0" step="1" inputMode="numeric" placeholder="Ví dụ: 25" required /></div>
        <button className="primary" type="submit">Lưu số liệu</button>
      </form>
      {manualReports.length ? <div className="manual-report-history">{manualReports.map((report) => <article key={report.id}><b>{new Intl.DateTimeFormat('vi-VN').format(new Date(`${report.reportDate}T00:00:00+07:00`))}</b><p><strong>{fmt(report.amount)}</strong><span>{report.messages.toLocaleString('vi-VN')} Mess</span></p></article>)}</div> : null}
    </div>
    <div className="card page-card">
      <div className="page-head"><div><h2>Daily Ads Snapshot</h2><p>Dữ liệu ngày được lưu trong Supabase.</p></div><button className="primary">Xuất báo cáo</button></div>
      {data.error ? <div className="notice">{data.error}</div> : null}
      <div className="report-list">{data.daily.map((d) => <div className="report-row" key={d.date}><b>{d.day}</b><span><span className="pill">{d.source}</span></span><span>{fmt(d.spend)}</span><span>{d.messages} mess</span><span>{d.leads} lead</span><span>CPL {fmt(d.leads ? d.spend / d.leads : 0)}</span></div>)}</div>
    </div>
  </AppShell>;
}

export function Placeholder({title, desc, user}: {title: string; desc: string; user: CurrentProfile}) {
  return <AppShell title={title} user={user}><div className="card page-card"><div className="empty"><h2>{title}</h2><p>{desc}</p><p>Khung module đã sẵn sàng để nối dữ liệu Supabase.</p></div></div></AppShell>;
}
