import AppShell from '@/components/AppShell';
import VideoControlClient from '@/components/VideoControlClient';
import {requireCurrentProfile} from '@/lib/auth';
import {getMediaProjects} from '@/lib/media';

export default async function Page() {
  const [user, projects] = await Promise.all([requireCurrentProfile(), getMediaProjects()]);
  return <AppShell title="Kiểm soát video" user={user}><VideoControlClient projects={projects}/></AppShell>;
}
