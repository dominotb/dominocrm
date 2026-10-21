import AppShell from '@/components/AppShell';
import {requireCurrentProfile} from '@/lib/auth';
import {getChecklistItems, getIntegrationConnections, settingGroups} from '@/lib/settings';
import {createChecklistItem, deleteChecklistItem, updateChecklistItem} from './actions';

export default async function Page() {
  const [user, {items, error}, connections] = await Promise.all([
    requireCurrentProfile(),
    getChecklistItems(),
    getIntegrationConnections(),
  ]);
  const metaConnection = connections.find((connection) => connection.provider === 'meta' && connection.status === 'active');

  return <AppShell title="Thiết lập" user={user}>
    <div className="card page-card connection-panel">
      <div className="page-head"><div><h2>Kết nối dữ liệu</h2><p>Cấp quyền để CRM đọc tài khoản và dữ liệu quảng cáo của doanh nghiệp.</p></div></div>
      <div className="connection-item"><div><h3>Facebook Business Manager</h3><p>{metaConnection ? `${metaConnection.businessCount} BM · ${metaConnection.accountCount} tài khoản quảng cáo` : 'Chưa có Business Manager được kết nối.'}</p></div><div className="connection-actions"><span className={'connection-status ' + (metaConnection ? 'connected' : '')}>{metaConnection ? 'Đã kết nối' : 'Chưa kết nối'}</span><a className="primary facebook-button" href="/api/integrations/meta/connect">{metaConnection ? 'Kết nối lại' : 'Kết nối Facebook'}</a></div></div>
    </div>
    <div className="card page-card">
      <div className="page-head">
        <div>
          <h2>Thiết lập checklist</h2>
          <p>Thêm, sửa, xoá các danh sách dùng cho lead, khách hàng, phân khúc và mã bó cảnh.</p>
        </div>
      </div>

      {error ? <div className="notice">Chưa đọc được bảng thiết lập: {error}</div> : null}

      <div className="settings-grid">
        {settingGroups.map((group) => {
          const groupItems = items.filter((item) => item.groupKey === group.key);
          return <section className="settings-panel" key={group.key}>
            <h3>{group.title}</h3>
            <form action={createChecklistItem} className="settings-add">
              <input type="hidden" name="groupKey" value={group.key}/>
              <input name="label" placeholder={group.placeholder} required/>
              <input name="value" placeholder="Giá trị lưu (có thể bỏ trống)"/>
              <input name="sortOrder" type="number" placeholder="STT" defaultValue={groupItems.length + 1}/>
              <button className="primary" type="submit">Thêm</button>
            </form>

            <div className="settings-list">
              {groupItems.map((item) => <form action={updateChecklistItem} className="settings-row" key={item.id}>
                <input type="hidden" name="id" value={item.id}/>
                <input name="label" defaultValue={item.label} required/>
                <input name="value" defaultValue={item.value}/>
                <input name="sortOrder" type="number" defaultValue={item.sortOrder}/>
                <label className="check"><input name="isActive" type="checkbox" defaultChecked={item.isActive}/> Bật</label>
                <button className="table-action" type="submit">Lưu</button>
                <button className="table-action danger" formAction={deleteChecklistItem} type="submit">Xoá</button>
              </form>)}
              {!groupItems.length ? <div className="empty small">Chưa có mục nào.</div> : null}
            </div>
          </section>;
        })}
      </div>
    </div>
  </AppShell>;
}
