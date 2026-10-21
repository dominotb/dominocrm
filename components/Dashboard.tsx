'use client';

import {useMemo, useState} from 'react';
import {ArrowUpRight, ChevronRight, FileCheck2, Filter, MessageSquare, Phone, Target, Users, WalletCards} from 'lucide-react';
import {Area, Bar, CartesianGrid, ComposedChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import type {DashboardData} from '@/lib/data-model';
import {fmt} from '@/lib/data-model';

export default function Dashboard({data}: {data: DashboardData}) {
  const [range, setRange] = useState('30 ngày');
  const filteredData = useMemo(() => filterDashboardData(data, range), [data, range]);
  const cards = [
    ['Đã chi', fmt(filteredData.totals.spend), data.connected ? 'Chỉ tính quảng cáo Fanpage' : 'Chưa kết nối DB', WalletCards],
    ['Tin nhắn', String(filteredData.totals.messages), 'Tin nhắn từ quảng cáo Fanpage', MessageSquare],
    ['Lead', String(filteredData.leadQuality.fanpage), `${filteredData.leadQuality.fanpageQualified} lead Fanpage đạt chất lượng`, Users],
    ['CPL', filteredData.totals.cpl ? fmt(filteredData.totals.cpl) : '0 ₫', 'Chi phí Fanpage / lead Fanpage', Target],
  ] as const;
  const avgMessageCost = filteredData.totals.messages ? filteredData.totals.spend / filteredData.totals.messages : 0;
  const messageToPhoneRate = filteredData.totals.messages ? (filteredData.leadQuality.fanpage / filteredData.totals.messages) * 100 : 0;
  const avgPhoneCost = filteredData.leadQuality.fanpage ? filteredData.totals.spend / filteredData.leadQuality.fanpage : 0;
  const avgContractCost = filteredData.leadQuality.fanpageContracts ? filteredData.totals.spend / filteredData.leadQuality.fanpageContracts : 0;
  const funnelCards = [
    ['Chi phí / mess', avgMessageCost ? fmt(avgMessageCost) : '0 ₫', `${filteredData.totals.messages} mess Fanpage`, MessageSquare],
    ['Mess → SĐT', `${formatPercent(messageToPhoneRate)}%`, `${filteredData.leadQuality.fanpage} SĐT Fanpage / ${filteredData.totals.messages} mess`, Phone],
    ['Chi phí / SĐT', avgPhoneCost ? fmt(avgPhoneCost) : '0 ₫', 'Chi phí Fanpage / SĐT Fanpage', Target],
    ['Hợp đồng', String(filteredData.leadQuality.fanpageContracts), avgContractCost ? `${fmt(avgContractCost)} / hợp đồng Fanpage` : 'Chưa có hợp đồng Fanpage', FileCheck2],
  ] as const;
  const qualifiedRate = filteredData.leadQuality.total > 0 ? Math.round((filteredData.leadQuality.qualified / filteredData.leadQuality.total) * 1000) / 10 : 0;

  return <>
    <section className="toolbar">
      <div className="range">
        {['Hôm nay', '7 ngày', '30 ngày'].map((x) => <button type="button" aria-pressed={range === x} onClick={() => setRange(x)} className={range === x ? 'selected' : ''} key={x}>{x}</button>)}
      </div>
      <button className="filter"><Filter size={16}/> Bộ lọc</button>
    </section>

    {data.error ? <div className="notice">{data.error}</div> : null}

    <section className="kpis">
      {cards.map(([label, value, sub, Icon]) => <article className="card kpi" key={label}>
        <div className="kpi-top"><span>{label}</span><i><Icon size={18}/></i></div>
        <strong>{value}</strong>
        <small>{sub}</small>
      </article>)}
    </section>

    <section className="funnel-section">
      <div className="section-title"><div><h2>Hiệu quả chuyển đổi</h2><p>Từ tin nhắn đến số điện thoại và hợp đồng</p></div></div>
      <div className="kpis funnel-kpis">
        {funnelCards.map(([label, value, sub, Icon]) => <article className="card kpi" key={label}><div className="kpi-top"><span>{label}</span><i><Icon size={18}/></i></div><strong>{value}</strong><small>{sub}</small></article>)}
      </div>
      <div className="channel-messages">
        {(['Fanpage', 'Tiktok', 'Youtube', 'Website'] as const).map((source) => <div key={source}><span>Mess từ {source}</span><b>{filteredData.messagesBySource[source] || 0}</b></div>)}
      </div>
    </section>

    <section className="attribute-insights">
      <DistributionCard title="Tỷ lệ phân khúc" subtitle="Phân khúc khách hàng được lựa chọn" rows={filteredData.segmentDistribution}/>
      <DistributionCard title="Mã bo cánh phổ biến" subtitle="Các mã bo cánh được lựa chọn nhiều nhất" rows={filteredData.sceneCodeDistribution}/>
    </section>

    <section className="grid">
      <article className="card chart-card">
        <div className="section-title">
          <div><h2>Hiệu suất quảng cáo</h2><p>Chi tiêu và số mess Fanpage theo ngày</p></div>
          <span className="live">● {data.connected ? 'Supabase' : 'Chưa cấu hình'}</span>
        </div>
        <div className="chart">
          {filteredData.daily.length ? <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filteredData.daily}>
              <CartesianGrid strokeDasharray="3 3" vertical={false}/>
              <XAxis dataKey="day" axisLine={false} tickLine={false}/>
              <YAxis yAxisId="spend" hide/>
              <YAxis yAxisId="messages" orientation="right" hide/>
              <Tooltip formatter={(value, name) => name === 'Chi tiêu' ? fmt(Number(value)) : `${value} mess`}/>
              <Legend/>
              <Area yAxisId="spend" type="monotone" name="Chi tiêu" dataKey="spend" stroke="#202327" fill="#202327" fillOpacity={.08} strokeWidth={2.5}/>
              <Bar yAxisId="messages" name="Số mess" dataKey="messages" fill="#8b949e" radius={[4,4,0,0]} maxBarSize={28}/>
            </ComposedChart>
          </ResponsiveContainer> : <div className="empty-chart">Chưa có dữ liệu metrics trong Supabase</div>}
        </div>
      </article>

      <article className="card quality">
        <div className="section-title"><div><h2>Chất lượng Lead</h2><p>{filteredData.leadQuality.total} lead được ghi nhận</p></div></div>
        <div className="quality-ring"><div style={{background: `conic-gradient(#202327 0 ${qualifiedRate}%,#eceef0 ${qualifiedRate}%)`}}><strong>{qualifiedRate}%</strong><span>Đạt chất lượng</span></div></div>
        <div className="quality-row"><span><i className="dot good"/>Đạt chất lượng</span><b>{filteredData.leadQuality.qualified}</b></div>
        <div className="quality-row"><span><i className="dot mid"/>Đang đánh giá</span><b>{filteredData.leadQuality.reviewing}</b></div>
        <div className="quality-row"><span><i className="dot bad"/>Không phù hợp</span><b>{filteredData.leadQuality.unqualified}</b></div>
      </article>
    </section>

    <section className="card table-card">
      <div className="section-title"><div><h2>Campaign</h2><p>Hiệu quả theo chiến dịch</p></div><a>Xem tất cả <ArrowUpRight size={15}/></a></div>
      <div className="desktop-table">
        <table>
          <thead><tr><th>Chiến dịch</th><th>Trạng thái</th><th>Chi tiêu</th><th>Mess</th><th>Lead</th><th>Lead đạt</th><th>CPL</th><th/></tr></thead>
          <tbody>{filteredData.campaigns.map((c) => <tr key={c.id}><td><b>{c.name}</b></td><td><span className={'status ' + (c.status === 'ACTIVE' ? 'on' : 'off')}>{c.status}</span></td><td>{fmt(c.spend)}</td><td>{c.messages}</td><td>{c.leads}</td><td>{c.qualified}</td><td>{fmt(c.cpl)}</td><td><ChevronRight size={17}/></td></tr>)}</tbody>
        </table>
      </div>
      <div className="mobile-campaigns">
        {filteredData.campaigns.map((c) => <div className="campaign-card" key={c.id}><div><b>{c.name}</b><span className={'status ' + (c.status === 'ACTIVE' ? 'on' : 'off')}>{c.status}</span></div><div className="campaign-stats"><span>Chi tiêu<b>{fmt(c.spend)}</b></span><span>Mess<b>{c.messages}</b></span><span>Lead<b>{c.leads}</b></span><span>CPL<b>{fmt(c.cpl)}</b></span></div></div>)}
      </div>
    </section>
  </>;
}

function filterDashboardData(data: DashboardData, range: string) {
  const days = range === 'Hôm nay' ? 1 : range === '7 ngày' ? 7 : 30;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const startDate = localDateKey(start);
  const daily = data.daily.filter((row) => row.date >= startDate);
  const selectedMetrics = data.campaignDaily.filter((row) => row.date >= startDate);
  const byCampaign = new Map<string, {spend: number; messages: number; leads: number; qualified: number}>();

  for (const metric of selectedMetrics) {
    const current = byCampaign.get(metric.campaignId) || {spend: 0, messages: 0, leads: 0, qualified: 0};
    current.spend += metric.spend;
    current.messages += metric.messages;
    current.leads += metric.leads;
    current.qualified += metric.qualified;
    byCampaign.set(metric.campaignId, current);
  }

  const campaigns = data.campaigns.map((campaign) => {
    const totals = byCampaign.get(campaign.id) || {spend: 0, messages: 0, leads: 0, qualified: 0};
    return {...campaign, ...totals, cpl: totals.leads > 0 ? totals.spend / totals.leads : 0};
  });
  const totals = daily.reduce(
    (sum, row) => ({...sum, spend: sum.spend + row.spend, messages: sum.messages + row.messages}),
    {spend: 0, messages: 0, leads: 0, qualified: 0, cpl: 0},
  );

  const leadQuality = data.leadDaily.filter((row) => row.date >= startDate).reduce((sum, row) => ({
    total: sum.total + row.total, qualified: sum.qualified + row.qualified, reviewing: sum.reviewing + row.reviewing,
    unqualified: sum.unqualified + row.unqualified, fanpage: sum.fanpage + row.fanpage, fanpageQualified: sum.fanpageQualified + row.fanpageQualified, contracts: sum.contracts + row.contracts,
    fanpageContracts: sum.fanpageContracts + row.fanpageContracts, tiktok: sum.tiktok + row.tiktok,
    youtube: sum.youtube + row.youtube, website: sum.website + row.website,
  }), {total: 0, qualified: 0, reviewing: 0, unqualified: 0, fanpage: 0, fanpageQualified: 0, contracts: 0, fanpageContracts: 0, tiktok: 0, youtube: 0, website: 0});
  totals.leads = leadQuality.total;
  totals.qualified = leadQuality.qualified;
  totals.cpl = leadQuality.fanpage ? totals.spend / leadQuality.fanpage : 0;
  const messagesBySource: Record<string, number> = {
    Fanpage: totals.messages, Tiktok: leadQuality.tiktok, Youtube: leadQuality.youtube, Website: leadQuality.website,
  };
  const importedMessages: Record<string, number> = {};
  for (const row of data.channelMessages) if (row.date >= startDate) importedMessages[row.source] = (importedMessages[row.source] || 0) + row.messages;
  for (const [source, messages] of Object.entries(importedMessages)) messagesBySource[source] = messages;
  const totalMessages = Object.values(messagesBySource).reduce((sum, value) => sum + value, 0);
  const visibleAttributes = data.leadAttributes.filter((row) => row.date >= startDate);
  const segmentDistribution = distribution(visibleAttributes.map((row) => row.segment).filter(Boolean));
  const sceneCodeDistribution = distribution(visibleAttributes.map((row) => row.sceneCode).filter(Boolean));
  return {daily, campaigns, totals, leadQuality, messagesBySource, totalMessages, segmentDistribution, sceneCodeDistribution};
}

function DistributionCard({title, subtitle, rows}: {title: string; subtitle: string; rows: {label: string; count: number; percent: number}[]}) {
  return <article className="card distribution-card"><div className="section-title"><div><h2>{title}</h2><p>{subtitle}</p></div>{rows[0] ? <span className="distribution-top">Top: {rows[0].label}</span> : null}</div>{rows.length ? <div className="distribution-list">{rows.slice(0, 6).map((row) => <div className="distribution-row" key={row.label}><div><span>{row.label}</span><b>{row.count} · {formatPercent(row.percent)}%</b></div><i><span style={{width: `${row.percent}%`}}/></i></div>)}</div> : <div className="distribution-empty">Chưa có khách hàng lựa chọn</div>}</article>;
}

function distribution(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return Array.from(counts, ([label, count]) => ({label, count, percent: values.length ? count / values.length * 100 : 0})).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'vi'));
}

function formatPercent(value: number) {
  return new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 1}).format(value);
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
