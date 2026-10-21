import {Reports} from '@/components/ModulePage';
import {requireCurrentProfile} from '@/lib/auth';
import {getDashboardData} from '@/lib/data';
import {getDailyManualReports} from '@/lib/daily-reports';
import {saveDailyManualReport} from './actions';

export default async function Page() {
  const [user, data, manualReports] = await Promise.all([
    requireCurrentProfile(),
    getDashboardData(),
    getDailyManualReports(),
  ]);

  return <Reports data={data} user={user} manualReports={manualReports} saveAction={saveDailyManualReport} />;
}
