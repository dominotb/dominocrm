'use server';
import {revalidatePath} from 'next/cache';
import {requireCurrentProfile} from '@/lib/auth';
import {mediaCoreStageOrder, mediaStageOrder, type MediaStageKey, type MediaStageStatus, type MediaWorkflowStatus} from '@/lib/media';
import {createServiceClient} from '@/lib/supabase';
type Result = {ok: true} | {ok: false; error: string};
const statuses: MediaStageStatus[] = ['pending', 'scheduled', 'completed', 'cancelled'];
const workflowStatuses: MediaWorkflowStatus[] = ['waiting', 'filmed', 'editing', 'ready', 'published'];

export async function updateVideoWorkflowAction(stageId: string, workflowStatus: MediaWorkflowStatus, publishedUrl = ''): Promise<Result> {
  await requireCurrentProfile();
  if (!stageId || !workflowStatuses.includes(workflowStatus)) return {ok: false, error: 'Trạng thái xử lý video không hợp lệ.'};
  if (publishedUrl) { try { new URL(publishedUrl); } catch { return {ok: false, error: 'Link bài đăng không hợp lệ.'}; } }
  const service = createServiceClient();
  const {data: current, error: readError} = await service.from('media_project_stages').select('id,project_id,stage,status').eq('id', stageId).maybeSingle();
  if (readError || !current) return {ok: false, error: readError?.message || 'Không tìm thấy video.'};
  if (current.status === 'cancelled') return {ok: false, error: 'Không thể cập nhật video đã hủy.'};
  const {data: projectStages, error: stagesError} = await service.from('media_project_stages').select('id,stage,workflow_status').eq('project_id', current.project_id).neq('status', 'cancelled');
  if (stagesError) return {ok: false, error: stagesError.message};
  const ordered = (projectStages || []).sort((a, b) => mediaStageOrder.indexOf(a.stage as MediaStageKey) - mediaStageOrder.indexOf(b.stage as MediaStageKey));
  const currentIndex = ordered.findIndex((stage) => stage.id === stageId);
  if (workflowStatus === 'published') {
    const blocking = ordered.slice(0, currentIndex).find((stage) => stage.workflow_status !== 'published');
    if (blocking) return {ok: false, error: `Phải đăng video ${stageName(blocking.stage as MediaStageKey)} trước.`};
  }
  const now = new Date().toISOString();
  const {error} = await service.from('media_project_stages').update({workflow_status: workflowStatus, published_url: publishedUrl || null, published_at: workflowStatus === 'published' ? now : null, status: workflowStatus === 'waiting' ? current.status : 'completed', completed_at: workflowStatus === 'waiting' ? null : now, updated_at: now}).eq('id', stageId);
  if (error) return {ok: false, error: error.message};
  revalidatePath('/video-control'); revalidatePath('/media'); return {ok: true};
}

function stageName(stage: MediaStageKey) { return ({survey: 'khảo sát', installation: 'lắp đặt', handover: 'hoàn thiện', homeowner_interview: 'phỏng vấn chủ nhà'})[stage]; }

export async function createMediaProjectAction(formData: FormData): Promise<Result> {
  const user = await requireCurrentProfile(); const projectName = String(formData.get('projectName') || '').trim(); const mapUrl = String(formData.get('mapUrl') || '').trim(); const scheduledAtValue = String(formData.get('scheduledAt') || ''); const currentStage = String(formData.get('currentStage') || '') as typeof mediaCoreStageOrder[number]; const includeInterview = formData.get('includeInterview') === 'on';
  if (!projectName || !scheduledAtValue || !mediaCoreStageOrder.includes(currentStage)) return {ok: false, error: 'Vui lòng nhập đầy đủ tên công trình, giai đoạn, ngày và giờ.'};
  if (mapUrl && !isGoogleMapsUrl(mapUrl)) return {ok: false, error: 'Link vị trí phải là đường dẫn Google Maps hợp lệ.'};
  const scheduledAt = new Date(scheduledAtValue); if (Number.isNaN(scheduledAt.getTime())) return {ok: false, error: 'Ngày hoặc giờ không hợp lệ.'};
  const service = createServiceClient();
  const {data: project, error} = await service.from('media_projects').insert({project_name: projectName, map_url: mapUrl || null, scheduled_at: scheduledAt.toISOString(), notes: String(formData.get('notes') || '').trim() || null, created_by: user.id}).select('id').single();
  if (error || !project) return {ok: false, error: error?.message || 'Không thể tạo công trình.'};
  const currentIndex = mediaCoreStageOrder.indexOf(currentStage);
  const selectedStages: MediaStageKey[] = [...mediaCoreStageOrder.slice(currentIndex)];
  if (includeInterview) selectedStages.push('homeowner_interview');
  const {error: stageError} = await service.from('media_project_stages').insert(selectedStages.map((stage) => ({project_id: project.id, stage, status: stage === currentStage ? 'scheduled' : 'pending', scheduled_at: stage === currentStage ? scheduledAt.toISOString() : null})));
  if (stageError) { await service.from('media_projects').delete().eq('id', project.id); return {ok: false, error: stageError.message}; }
  revalidatePath('/media'); return {ok: true};
}

export async function cancelMediaProjectAction(formData: FormData): Promise<Result> {
  await requireCurrentProfile(); const id = String(formData.get('id') || ''); const reason = String(formData.get('reason') || '').trim();
  if (!id || !reason) return {ok: false, error: 'Vui lòng nhập lý do hủy công trình.'};
  const service = createServiceClient(); const now = new Date().toISOString();
  const {data: project, error} = await service.from('media_projects').update({status: 'cancelled', cancellation_reason: reason, cancelled_at: now, updated_at: now}).eq('id', id).eq('status', 'active').select('id').maybeSingle();
  if (error || !project) return {ok: false, error: error?.message || 'Công trình không tồn tại hoặc đã được hủy.'};
  const {error: stageError} = await service.from('media_project_stages').update({status: 'cancelled', updated_at: now}).eq('project_id', id).in('status', ['pending', 'scheduled']);
  if (stageError) return {ok: false, error: stageError.message};
  revalidatePath('/media'); return {ok: true};
}

export async function updateMediaProjectAction(formData: FormData): Promise<Result> {
  await requireCurrentProfile();
  const id = String(formData.get('id') || ''); const stageId = String(formData.get('stageId') || ''); const projectName = String(formData.get('projectName') || '').trim(); const mapUrl = String(formData.get('mapUrl') || '').trim(); const scheduledAtValue = String(formData.get('scheduledAt') || '');
  if (!id || !stageId || !projectName || !scheduledAtValue) return {ok: false, error: 'Vui lòng nhập đầy đủ tên công trình, ngày và giờ.'};
  if (mapUrl && !isGoogleMapsUrl(mapUrl)) return {ok: false, error: 'Link vị trí phải là đường dẫn Google Maps hợp lệ.'};
  const scheduledAt = new Date(scheduledAtValue); if (Number.isNaN(scheduledAt.getTime())) return {ok: false, error: 'Ngày hoặc giờ không hợp lệ.'};
  const service = createServiceClient(); const now = new Date().toISOString();
  const {data: stage} = await service.from('media_project_stages').select('id,status').eq('id', stageId).eq('project_id', id).maybeSingle();
  if (!stage) return {ok: false, error: 'Giai đoạn công trình không còn tồn tại.'};
  const {data: project, error} = await service.from('media_projects').update({project_name: projectName, map_url: mapUrl || null, scheduled_at: scheduledAt.toISOString(), notes: String(formData.get('notes') || '').trim() || null, updated_at: now}).eq('id', id).eq('status', 'active').select('id').maybeSingle();
  if (error || !project) return {ok: false, error: error?.message || 'Công trình không tồn tại hoặc đã bị hủy.'};
  const {error: stageError} = await service.from('media_project_stages').update({scheduled_at: scheduledAt.toISOString(), status: stage.status === 'pending' ? 'scheduled' : stage.status, updated_at: now}).eq('id', stageId).eq('project_id', id);
  if (stageError) return {ok: false, error: stageError.message};
  revalidatePath('/media'); return {ok: true};
}

export async function saveMediaStageAction(formData: FormData): Promise<Result> {
  await requireCurrentProfile(); const id = String(formData.get('id') || ''); const stage = String(formData.get('stage') || '') as MediaStageKey; const status = (String(formData.get('intent') || '') === 'complete' ? 'completed' : String(formData.get('status') || '')) as MediaStageStatus;
  if (!id || !mediaStageOrder.includes(stage) || !statuses.includes(status)) return {ok: false, error: 'Dữ liệu hạng mục không hợp lệ.'};
  const scheduledAt = String(formData.get('scheduledAt') || ''); if (status === 'scheduled' && !scheduledAt) return {ok: false, error: 'Vui lòng chọn lịch quay/chụp.'};
  if (scheduledAt && Number.isNaN(new Date(scheduledAt).getTime())) return {ok: false, error: 'Ngày hoặc giờ không hợp lệ.'};
  const service = createServiceClient();
  const {data: current} = await service.from('media_project_stages').select('project_id,media_projects!inner(status)').eq('id', id).eq('stage', stage).maybeSingle();
  const project = current?.media_projects as {status?: string} | {status?: string}[] | null;
  if (!current || (Array.isArray(project) ? project[0]?.status : project?.status) !== 'active') return {ok: false, error: 'Không thể cập nhật công trình đã hủy.'};
  const {error} = await service.from('media_project_stages').update({status, scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null, assigned_to: String(formData.get('assignedTo') || '') || null, shot_list: String(formData.get('shotList') || '').trim() || null, notes: String(formData.get('notes') || '').trim() || null, completed_at: status === 'completed' ? new Date().toISOString() : null, updated_at: new Date().toISOString()}).eq('id', id).eq('stage', stage);
  if (error) return {ok: false, error: error.message}; revalidatePath('/media'); return {ok: true};
}

export async function toggleMediaStageCompleteAction(id: string, completed: boolean): Promise<Result> {
  await requireCurrentProfile();
  if (!id) return {ok: false, error: 'Hạng mục video không hợp lệ.'};
  const service = createServiceClient();
  const {data: current, error: readError} = await service.from('media_project_stages').select('id,status,scheduled_at,media_projects!inner(status)').eq('id', id).maybeSingle();
  if (readError) return {ok: false, error: readError.message};
  const project = current?.media_projects as {status?: string} | {status?: string}[] | null;
  if (!current || (Array.isArray(project) ? project[0]?.status : project?.status) !== 'active') return {ok: false, error: 'Không thể cập nhật công trình đã hủy.'};
  if (current.status === 'cancelled') return {ok: false, error: 'Không thể hoàn thành video đã hủy.'};
  const now = new Date().toISOString();
  const status: MediaStageStatus = completed ? 'completed' : current.scheduled_at ? 'scheduled' : 'pending';
  const {error} = await service.from('media_project_stages').update({status, completed_at: completed ? now : null, updated_at: now}).eq('id', id);
  if (error) return {ok: false, error: error.message};
  revalidatePath('/media');
  revalidatePath('/video-control');
  return {ok: true};
}

function isGoogleMapsUrl(value: string) {
  try { const host = new URL(value).hostname.toLowerCase(); return host === 'maps.app.goo.gl' || host === 'goo.gl' || host === 'google.com' || host.endsWith('.google.com'); } catch { return false; }
}
