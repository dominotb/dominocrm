import AppShell from '@/components/AppShell';
import MediaClient from '@/components/MediaClient';
import {getEmployees, requireCurrentProfile} from '@/lib/auth';
import {getMediaProjects} from '@/lib/media';

export default async function Page() {
  const [user, projects, employees] = await Promise.all([requireCurrentProfile(), getMediaProjects(), getEmployees()]);
  return <AppShell title="Quản lý video công trình" user={user}><MediaClient projects={projects} employees={employees.map(({id, fullName, position}) => ({id, fullName, position}))} currentTimestamp={Date.now()}/></AppShell>;
}
