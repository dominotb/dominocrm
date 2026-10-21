import AppShell from '@/components/AppShell';
import {getEmployees, requireCurrentProfile} from '@/lib/auth';
import {getChecklistItems} from '@/lib/settings';
import {getTeamTasks} from '@/lib/team';
import TeamClient from '@/components/TeamClient';

export default async function Page() {
  const user = await requireCurrentProfile();
  const [employees, tasks, {items}] = await Promise.all([getEmployees(), getTeamTasks(), getChecklistItems()]);
  const positions = items.filter((item)=>item.groupKey==='job_positions'&&item.isActive);
  const branches = items.filter((item)=>item.groupKey==='work_branches'&&item.isActive);

  return <AppShell title="Nhân sự & phân quyền" user={user}><TeamClient employees={employees} tasks={tasks} positions={positions} branches={branches}/></AppShell>;
}
