import {createServiceClient} from './supabase';

export const mediaCoreStageOrder = ['survey', 'installation', 'handover'] as const;
export const mediaStageOrder = [...mediaCoreStageOrder, 'homeowner_interview'] as const;
export type MediaStageKey = typeof mediaStageOrder[number];
export type MediaStageStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled';
export type MediaWorkflowStatus = 'waiting' | 'filmed' | 'editing' | 'ready' | 'published';
export type MediaStage = {id: string; stage: MediaStageKey; status: MediaStageStatus; workflowStatus: MediaWorkflowStatus; scheduledAt: string; assignedTo: string; assigneeName: string; shotList: string; notes: string; completedAt: string; publishedUrl: string; publishedAt: string};
export type MediaProject = {id: string; projectName: string; mapUrl: string; scheduledAt: string; notes: string; status: 'active' | 'cancelled'; cancellationReason: string; cancelledAt: string; createdAt: string; stages: MediaStage[]};

export async function getMediaProjects(): Promise<MediaProject[]> {
  const {data, error} = await createServiceClient().from('media_projects').select('id,project_name,map_url,scheduled_at,notes,status,cancellation_reason,cancelled_at,created_at,media_project_stages(id,stage,status,workflow_status,scheduled_at,assigned_to,shot_list,notes,completed_at,published_url,published_at,profiles!media_project_stages_assigned_to_fkey(full_name))').order('created_at', {ascending: false});
  if (error) return [];
  return (data || []).map((project) => ({id: project.id, projectName: project.project_name, mapUrl: project.map_url || '', scheduledAt: project.scheduled_at || '', notes: project.notes || '', status: project.status === 'cancelled' ? 'cancelled' : 'active', cancellationReason: project.cancellation_reason || '', cancelledAt: project.cancelled_at || '', createdAt: project.created_at, stages: (project.media_project_stages || []).map((item) => {
    const profile = item.profiles as {full_name?: string} | {full_name?: string}[] | null;
    return {id: item.id, stage: item.stage as MediaStageKey, status: item.status as MediaStageStatus, workflowStatus: (item.workflow_status || 'waiting') as MediaWorkflowStatus, scheduledAt: item.scheduled_at || '', assignedTo: item.assigned_to || '', assigneeName: (Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name) || 'Chưa giao', shotList: item.shot_list || '', notes: item.notes || '', completedAt: item.completed_at || '', publishedUrl: item.published_url || '', publishedAt: item.published_at || ''};
  }).sort((a, b) => mediaStageOrder.indexOf(a.stage) - mediaStageOrder.indexOf(b.stage))}));
}
