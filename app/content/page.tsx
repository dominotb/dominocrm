import AppShell from '@/components/AppShell';
import ContentKpiClient from '@/components/ContentKpiClient';
import {requireCurrentProfile} from '@/lib/auth';
import {getContentKpiData} from '@/lib/content-kpi';

export default async function Page() {
  const [user, data] = await Promise.all([requireCurrentProfile(), getContentKpiData()]);
  return <AppShell title="KPI nội dung" user={user}><ContentKpiClient data={data}/></AppShell>;
}
