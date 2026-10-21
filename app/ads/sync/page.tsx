import {Placeholder} from '@/components/ModulePage';
import {requireCurrentProfile} from '@/lib/auth';

export default async function Page() {
  const user = await requireCurrentProfile();

  return <Placeholder title="Đồng bộ Meta" desc="Theo dõi trạng thái đồng bộ Campaign, Ad Set, Ad, Insight và log lỗi." user={user}/>;
}
