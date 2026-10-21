import {Campaigns} from '@/components/ModulePage';
import {requireCurrentProfile} from '@/lib/auth';
import {getDashboardData} from '@/lib/data';

export default async function Page() {
  const [user, data] = await Promise.all([
    requireCurrentProfile(),
    getDashboardData(),
  ]);

  return <Campaigns data={data} user={user} />;
}
