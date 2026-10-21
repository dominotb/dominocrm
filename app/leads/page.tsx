import AppShell from '@/components/AppShell';
import LeadsClient from '@/components/LeadsClient';
import {requireCurrentProfile} from '@/lib/auth';
import {getLeads} from '@/lib/leads';
import {getChecklistItems} from '@/lib/settings';

export default async function Page() {
  const user = await requireCurrentProfile();
  const [{leads, error}, {items}] = await Promise.all([getLeads(), getChecklistItems()]);
  const segments = items.filter((item) => item.groupKey === 'segments' && item.isActive);
  const sceneCodes = items.filter((item) => item.groupKey === 'scene_codes' && item.isActive);

  return <AppShell title="Lead & chất lượng" user={user}>
    <div className="card page-card">
      <div className="page-head">
        <div><h2>Theo dõi lead</h2><p>Quản lý lead từ Tiktok, Website, Fanpage, Youtube và tạo khách hàng trực tiếp.</p></div>
      </div>
      <LeadsClient initialLeads={leads} segments={segments} sceneCodes={sceneCodes} initialError={error ? `Chưa đọc được bảng lead: ${error}` : ''}/>
    </div>
  </AppShell>;
}
