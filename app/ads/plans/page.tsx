import AppShell from '@/components/AppShell';
import {PlansClient} from '@/components/PlansClient';
import {requireCurrentProfile} from '@/lib/auth';
import {getDashboardData} from '@/lib/data';
import {getMarketingPlans} from '@/lib/plans';

export default async function Page() {
  const [user, data, plans] = await Promise.all([
    requireCurrentProfile(),
    getDashboardData(),
    getMarketingPlans(),
  ]);

  return <AppShell title="Kế hoạch quảng cáo" user={user}><div className="card page-card"><PlansClient data={data} plans={plans}/></div></AppShell>;
}
