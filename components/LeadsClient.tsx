'use client';

import {useMemo, useOptimistic, useRef, useState, useTransition} from 'react';
import type {LeadRow} from '@/lib/leads';
import type {ChecklistItem} from '@/lib/settings';
import {leadQualities, leadSources, leadStatuses} from '@/lib/leads';
import {createLeadAction, deleteLeadAction, endProjectAction, updateLeadAction} from '@/app/leads/actions';

type OptimisticLead = LeadRow & {saving?: boolean};
const initialStatus = 'Đang tiếp nhận';

export default function LeadsClient({initialLeads, segments, sceneCodes, initialError}: {initialLeads: LeadRow[]; segments: ChecklistItem[]; sceneCodes: ChecklistItem[]; initialError?: string}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [leads, setLeads] = useState<OptimisticLead[]>(initialLeads);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(initialError || '');
  const [isPending, startTransition] = useTransition();
  const [editingLead, setEditingLead] = useState<LeadRow | null>(null);
  const [endingLead, setEndingLead] = useState<LeadRow | null>(null);
  const [deletingLead, setDeletingLead] = useState<LeadRow | null>(null);
  const [endReason, setEndReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [sceneCodeFilter, setSceneCodeFilter] = useState('');
  const [optimisticLeads, addOptimisticLead] = useOptimistic(leads, (current, lead: OptimisticLead) => [lead, ...current]);
  const filteredLeads = useMemo(() => {
    const query = normalizeSearch(searchQuery);

    return optimisticLeads.filter((lead) => {
      const searchableText = normalizeSearch([
        lead.id,
        lead.accountName,
        lead.realName,
        lead.phone,
        lead.address,
        lead.accountLink,
        lead.description,
        lead.segment,
        lead.sceneCode,
        lead.source,
        displayStatus(lead),
        lead.quality,
      ].join(' '));

      return (!query || searchableText.includes(query))
        && (!sourceFilter || lead.source === sourceFilter)
        && (!statusFilter || displayStatus(lead) === statusFilter)
        && (!qualityFilter || lead.quality === qualityFilter)
        && (!segmentFilter || lead.segment === segmentFilter)
        && (!sceneCodeFilter || lead.sceneCode === sceneCodeFilter);
    });
  }, [optimisticLeads, qualityFilter, sceneCodeFilter, searchQuery, segmentFilter, sourceFilter, statusFilter]);
  const hasActiveFilters = Boolean(searchQuery || sourceFilter || statusFilter || qualityFilter || segmentFilter || sceneCodeFilter);

  function clearFilters() {
    setSearchQuery('');
    setSourceFilter('');
    setStatusFilter('');
    setQualityFilter('');
    setSegmentFilter('');
    setSceneCodeFilter('');
  }

  function submit(formData: FormData) {
    const accountName = text(formData.get('accountName'));
    const source = text(formData.get('source')) as LeadRow['source'];
    const realName = text(formData.get('realName'));
    const phone = text(formData.get('phone'));
    const hasZalo = formData.get('hasZalo') === 'on';
    const address = text(formData.get('address'));
    const accountLink = text(formData.get('accountLink'));
    const description = text(formData.get('description'));

    if (!accountName || !source || (!phone && !hasZalo)) {
      setError('Vui lòng nhập Tên tài khoản, Nguồn và SĐT; nếu khách kết bạn qua Zalo, hãy tích chọn Zalo thay cho SĐT.');
      return;
    }

    const optimisticLead: OptimisticLead = {
      id: `optimistic-${Date.now()}`,
      createdAt: new Date().toISOString(),
      accountName,
      source,
      realName,
      phone,
      hasZalo,
      address,
      accountLink,
      status: initialStatus,
      quality: 'Đang đánh giá',
      description,
      segment: '', sceneCode: '', quoteValue: null, endedAt: '', endReason: '',
      saving: true,
    };

    startTransition(async () => {
      setError('');
      setNotice('Đã thêm lead, đang lưu nền...');
      formRef.current?.reset();
      addOptimisticLead(optimisticLead);

      const result = await createLeadAction(formData);
      if (!result.ok) {
        setError(errorMessage(result.error));
        setNotice('');
        return;
      }
      setLeads((current) => [result.lead, ...current]);
      setNotice('Đã tạo khách hàng mới.');
    });
  }

  function confirmEndProject() {
    if (!endingLead || !endReason.trim()) {
      setError('Vui lòng nhập lý do kết thúc dự án.');
      return;
    }
    startTransition(async () => {
      const result = await endProjectAction(endingLead.id, endReason);
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      setLeads((current) => current.map((lead) => lead.id === result.lead.id ? result.lead : lead));
      setEndingLead(null);
      setEditingLead(null);
      setEndReason('');
      setNotice('Đã kết thúc dự án.');
    });
  }

  function saveLead(formData: FormData) {
    if (!editingLead) return;
    startTransition(async () => {
      setError('');
      const result = await updateLeadAction(editingLead.id, formData);
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      setLeads((current) => current.map((lead) => lead.id === result.lead.id ? result.lead : lead));
      setEditingLead(null);
      setNotice('Đã cập nhật thông tin khách hàng.');
    });
  }

  function confirmDeleteLead() {
    if (!deletingLead) return;
    startTransition(async () => {
      setError('');
      setNotice('');
      const result = await deleteLeadAction(deletingLead.id);
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      setLeads((current) => current.filter((lead) => lead.id !== result.leadId));
      setDeletingLead(null);
      setEditingLead(null);
      setNotice('Đã xóa lead.');
    });
  }

  return <>
    {notice ? <div className="notice success">{notice}</div> : null}
    {error ? <div className="notice">{error}</div> : null}
    {editingLead ? <div className="edit-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingLead(null); }}>
      <section className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-lead-title">
        <div className="edit-dialog-head"><div><h3 id="edit-lead-title">Sửa thông tin khách hàng</h3><p>Cập nhật các thông tin còn thiếu rồi nhấn Lưu thay đổi.</p></div><button type="button" className="dialog-close" aria-label="Đóng" onClick={() => setEditingLead(null)}>×</button></div>
        <form action={saveLead} className="lead-form edit-lead-form">
          <div className="field"><label>Tên tài khoản *</label><input name="accountName" required defaultValue={editingLead.accountName}/></div>
          <div className="field"><label>Nguồn *</label><select name="source" required defaultValue={editingLead.source}>{leadSources.map((source) => <option value={source} key={source}>{source}</option>)}</select></div>
          <div className="field"><label>Tên thật</label><input name="realName" defaultValue={editingLead.realName}/></div>
          <div className="field"><label>SĐT *</label><input name="phone" inputMode="tel" defaultValue={editingLead.phone} placeholder="Nhập SĐT hoặc chọn Zalo"/><label className="zalo-option"><input name="hasZalo" type="checkbox" defaultChecked={editingLead.hasZalo}/> Khách kết bạn qua Zalo</label></div>
          <div className="field"><label>Địa chỉ</label><input name="address" defaultValue={editingLead.address}/></div>
          <div className="field"><label>Link tài khoản</label><input name="accountLink" type="url" defaultValue={editingLead.accountLink}/></div>
          <div className="field"><label>Tình trạng</label><select name="status" defaultValue={editingLead.status}>{leadStatuses.map((status) => <option value={status} key={status}>{status}</option>)}</select></div>
          <div className="field"><label>Chất lượng</label><select name="quality" defaultValue={editingLead.quality}>{leadQualities.map((quality) => <option value={quality} key={quality}>{quality}</option>)}</select></div>
          <div className="field"><label>Phân khúc</label><select name="segment" defaultValue={editingLead.segment}><option value="">Chưa lựa chọn</option>{segments.map((item) => <option value={item.value} key={item.id}>{item.label}</option>)}</select></div>
          <div className="field"><label>Mã bo cánh</label><select name="sceneCode" defaultValue={editingLead.sceneCode}><option value="">Chưa lựa chọn</option>{sceneCodes.map((item) => <option value={item.value} key={item.id}>{item.label}</option>)}</select></div>
          <div className="field"><label>Báo giá (₫)</label><input name="quoteValue" type="number" min="0" step="1000" defaultValue={editingLead.quoteValue ?? ''} placeholder="Nhập giá trị báo giá"/></div>
          <div className="field lead-description"><label>Mô tả</label><textarea name="description" rows={3} defaultValue={editingLead.description}/></div>
          {editingLead.endedAt ? <div className="project-ended"><b>Dự án đã kết thúc</b><span>{editingLead.endReason}</span></div> : null}
          <div className="edit-actions">{!editingLead.endedAt ? <button className="danger-button" type="button" onClick={() => { setEndingLead(editingLead); setEndReason(''); }}>Kết thúc dự án</button> : null}<span className="edit-actions-spacer"/><button className="table-action" type="button" onClick={() => setEditingLead(null)}>Hủy</button><button className="primary" type="submit" disabled={isPending}>{isPending ? 'Đang lưu...' : 'Lưu thay đổi'}</button></div>
        </form>
      </section>
    </div> : null}
    {endingLead ? <div className="edit-backdrop project-end-backdrop" role="presentation"><section className="end-project-dialog" role="dialog" aria-modal="true" aria-labelledby="end-project-title"><h3 id="end-project-title">Kết thúc dự án</h3><p>Thao tác này sẽ ghi nhận dự án của <b>{endingLead.realName || endingLead.accountName}</b> đã kết thúc.</p><label>Lý do kết thúc *</label><textarea value={endReason} onChange={(event) => setEndReason(event.target.value)} rows={4} autoFocus placeholder="Nhập mô tả lý do kết thúc..."/><div className="end-project-actions"><button className="table-action" type="button" onClick={() => setEndingLead(null)}>Hủy</button><button className="danger-button" type="button" disabled={isPending || !endReason.trim()} onClick={confirmEndProject}>{isPending ? 'Đang xác nhận...' : 'Xác nhận kết thúc'}</button></div></section></div> : null}
    {deletingLead ? <div className="edit-backdrop delete-lead-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPending) setDeletingLead(null); }}><section className="end-project-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-lead-title" aria-describedby="delete-lead-description"><h3 id="delete-lead-title">Xóa lead?</h3><p id="delete-lead-description">Lead <b>{deletingLead.realName || deletingLead.accountName}</b> sẽ bị xóa vĩnh viễn. Thao tác này không thể hoàn tác.</p><div className="end-project-actions"><button className="table-action" type="button" disabled={isPending} onClick={() => setDeletingLead(null)}>Hủy</button><button className="danger-button" type="button" disabled={isPending} onClick={confirmDeleteLead}>{isPending ? 'Đang xóa...' : 'Xóa lead'}</button></div></section></div> : null}
    <details className="lead-create" open={!leads.length}>
      <summary>Tạo khách hàng</summary>
      <form ref={formRef} action={submit} className="lead-form">
        <div className="field"><label>Tên tài khoản *</label><input name="accountName" required placeholder="VD: Nguyễn Văn A Facebook"/></div>
        <div className="field"><label>Nguồn *</label><select name="source" required defaultValue="Fanpage">{leadSources.map((source) => <option value={source} key={source}>{source}</option>)}</select></div>
        <div className="field"><label>Tên thật</label><input name="realName" placeholder="Bổ sung sau nếu chưa có"/></div>
        <div className="field"><label>SĐT *</label><input name="phone" inputMode="tel" placeholder="Nhập SĐT hoặc chọn Zalo bên dưới"/><label className="zalo-option"><input name="hasZalo" type="checkbox"/> Khách kết bạn qua Zalo (bổ sung SĐT sau)</label></div>
        <div className="field"><label>Địa chỉ</label><input name="address" placeholder="Địa chỉ khách hàng"/></div>
        <div className="field"><label>Link tài khoản</label><input name="accountLink" type="url" placeholder="https://..."/></div>
        <div className="field"><label>Tình trạng</label><input value={initialStatus} disabled/></div>
        <div className="field lead-description"><label>Mô tả</label><textarea name="description" rows={3} placeholder="Nhu cầu, ghi chú tư vấn..."/></div>
        <button className="primary" type="submit" disabled={isPending}>{isPending ? 'Đang lưu...' : 'Tạo khách hàng'}</button>
      </form>
    </details>
    <section className="lead-filters" aria-label="Bộ lọc lead">
      <div className="lead-search">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <label className="sr-only" htmlFor="lead-search">Tìm kiếm lead</label>
        <input id="lead-search" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm theo tên, SĐT, địa chỉ, mã, phân khúc..."/>
      </div>
      <label className="lead-filter-field"><span>Nguồn</span><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="">Tất cả nguồn</option>{leadSources.map((source) => <option value={source} key={source}>{source}</option>)}</select></label>
      <label className="lead-filter-field"><span>Tình trạng</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Tất cả tình trạng</option>{leadStatuses.map((status) => <option value={status} key={status}>{status}</option>)}<option value="Kết thúc">Kết thúc</option></select></label>
      <label className="lead-filter-field"><span>Chất lượng</span><select value={qualityFilter} onChange={(event) => setQualityFilter(event.target.value)}><option value="">Tất cả chất lượng</option>{leadQualities.map((quality) => <option value={quality} key={quality}>{quality}</option>)}</select></label>
      <label className="lead-filter-field"><span>Phân khúc</span><select value={segmentFilter} onChange={(event) => setSegmentFilter(event.target.value)}><option value="">Tất cả phân khúc</option>{segments.map((item) => <option value={item.value} key={item.id}>{item.label}</option>)}</select></label>
      <label className="lead-filter-field"><span>Mã bo cánh</span><select value={sceneCodeFilter} onChange={(event) => setSceneCodeFilter(event.target.value)}><option value="">Tất cả mã</option>{sceneCodes.map((item) => <option value={item.value} key={item.id}>{item.label}</option>)}</select></label>
      <div className="lead-filter-summary"><span>Hiển thị <b>{filteredLeads.length}</b>/{optimisticLeads.length} lead</span>{hasActiveFilters ? <button type="button" onClick={clearFilters}>Xóa bộ lọc</button> : null}</div>
    </section>
    <div className="desktop-table lead-table">
      <table>
          <thead><tr><th>Ngày tạo</th><th>Tên tài khoản</th><th>Nguồn</th><th>Tên thật</th><th>SĐT</th><th>Địa chỉ</th><th>Link tài khoản</th><th>Tình trạng</th><th>Chất lượng</th><th>Mô tả</th><th>Thao tác</th></tr></thead>
        <tbody>{filteredLeads.map((lead) => <tr key={lead.id} className={lead.saving ? 'saving-row' : ''}>
          <td>{new Intl.DateTimeFormat('vi-VN', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(lead.createdAt))}</td>
          <td><b>{lead.accountName || '-'}</b></td>
          <td><span className="pill">{lead.source}</span></td>
          <td>{lead.realName || '-'}</td>
          <td>{lead.phone || (lead.hasZalo ? 'Zalo' : '-')}</td>
          <td>{lead.address || '-'}</td>
          <td>{lead.accountLink ? <a href={lead.accountLink} target="_blank" rel="noreferrer">Mở link</a> : '-'}</td>
          <td><span className={`status ${lead.endedAt ? 'ended' : 'on'}`}>{displayStatus(lead)}</span></td>
          <td><span className={`quality-badge ${qualityClass(lead.quality)}`}>{lead.quality}</span></td>
          <td>{lead.description || '-'}</td>
          <td><div className="lead-row-actions"><button className="table-action" type="button" disabled={lead.saving} onClick={() => setEditingLead(lead)}>Sửa</button><button className="table-action delete-action" type="button" disabled={lead.saving} onClick={() => setDeletingLead(lead)}>Xóa</button></div></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="mobile-campaigns">
      {filteredLeads.map((lead) => <div className="campaign-card" key={lead.id}>
        <div><b>{lead.realName || lead.accountName || lead.phone || 'Lead mới'}</b><span className={`quality-badge ${qualityClass(lead.quality)}`}>{lead.quality}</span></div>
        <div className="campaign-stats"><span>Nguồn<b>{lead.source}</b></span><span>SĐT<b>{lead.phone || (lead.hasZalo ? 'Zalo' : '-')}</b></span><span>Tình trạng<b className={lead.endedAt ? 'ended-text' : ''}>{displayStatus(lead)}</b></span><span>Ngày tạo<b>{new Intl.DateTimeFormat('vi-VN').format(new Date(lead.createdAt))}</b></span></div>
        <div className="lead-row-actions mobile-lead-actions"><button className="table-action" type="button" disabled={lead.saving} onClick={() => setEditingLead(lead)}>Sửa thông tin</button><button className="table-action delete-action" type="button" disabled={lead.saving} onClick={() => setDeletingLead(lead)}>Xóa</button></div>
      </div>)}
    </div>
    {!optimisticLeads.length ? <div className="empty">Chưa có lead nào.</div> : null}
    {optimisticLeads.length > 0 && !filteredLeads.length ? <div className="empty lead-filter-empty"><b>Không tìm thấy lead phù hợp.</b><span>Hãy thử đổi từ khóa hoặc xóa bớt điều kiện lọc.</span><button className="table-action" type="button" onClick={clearFilters}>Xóa bộ lọc</button></div> : null}
  </>;
}

function text(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi-VN').trim();
}

function errorMessage(error?: string) {
  if (error === 'missing') return 'Vui lòng nhập Tên tài khoản, Nguồn và SĐT; nếu khách kết bạn qua Zalo, hãy tích chọn Zalo thay cho SĐT.';
  if (error === 'customer') return 'Không tạo được khách hàng.';
  if (error === 'source') return 'Không lưu được nguồn khách hàng.';
  if (error === 'lead') return 'Không lưu được lead.';
  if (error === 'delete') return 'Không xóa được lead. Vui lòng thử lại.';
  return 'Không tạo được lead.';
}

function qualityClass(quality: LeadRow['quality']) {
  if (quality === 'Đạt chất lượng') return 'quality-good';
  if (quality === 'Không phù hợp') return 'quality-bad';
  return 'quality-reviewing';
}

function displayStatus(lead: LeadRow) {
  return lead.endedAt ? 'Kết thúc' : lead.status;
}
