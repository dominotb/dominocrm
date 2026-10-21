import AppShell from '@/components/AppShell';
import Dashboard from '@/components/Dashboard';
import {requireCurrentProfile} from '@/lib/auth';
import {getDashboardData} from '@/lib/data';

export default async function Page() {
  const [user, data] = await Promise.all([
    requireCurrentProfile(),
    getDashboardData(),
  ]);

  return (
    <AppShell title="Tổng quan quảng cáo" user={user}>
      <Dashboard data={data} />
    </AppShell>
  );
}
