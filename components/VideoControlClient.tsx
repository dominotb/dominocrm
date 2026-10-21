'use client';

import Link from 'next/link';
import {useMemo, useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {CalendarDays, Check, CircleAlert, ExternalLink, ListChecks, LockKeyhole, UserRound} from 'lucide-react';
import {updateVideoWorkflowAction} from '@/app/media/actions';
import {mediaStageOrder, type MediaProject, type MediaStage, type MediaWorkflowStatus} from '@/lib/media';
import styles from './VideoControlClient.module.css';

const stageLabels = {survey: 'Khảo sát', installation: 'Lắp đặt', handover: 'Hoàn thiện', homeowner_interview: 'Phỏng vấn chủ nhà'};
const statusLabels = {pending: 'Chưa lên lịch', scheduled: 'Đã lên lịch', completed: 'Hoàn thành', cancelled: 'Đã hủy'};
const workflowLabels: Record<MediaWorkflowStatus, string> = {waiting: 'Chưa quay', filmed: 'Đã quay về', editing: 'Đang dựng', ready: 'Sẵn sàng đăng', published: 'Đã đăng'};

export default function VideoControlClient({projects}: {projects: MediaProject[]}) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const active = useMemo(() => projects.filter((project) => project.status === 'active'), [projects]);
  const total = active.reduce((sum, project) => sum + project.stages.length, 0);
  const completed = active.reduce((sum, project) => sum + project.stages.filter((stage) => stage.workflowStatus === 'published').length, 0);
  const remaining = total - completed;
  const visible = active.filter((project) => filter === 'all' || (filter === 'done' ? project.stages.length > 0 && project.stages.every((stage) => stage.workflowStatus === 'published') : project.stages.some((stage) => stage.workflowStatus !== 'published' && stage.status !== 'cancelled')));

  function updateWorkflow(stage: MediaStage, workflowStatus: MediaWorkflowStatus, publishedUrl: string) {
    startTransition(async () => {
      const result = await updateVideoWorkflowAction(stage.id, workflowStatus, publishedUrl);
      setMessage(result.ok ? `Đã chuyển video sang “${workflowLabels[workflowStatus]}”.` : result.error);
      if (result.ok) router.refresh();
    });
  }

  return <>
    {message ? <div className="notice success" aria-live="polite">{message}</div> : null}
    <section className={styles.hero}><div><span><ListChecks size={15}/> KIỂM SOÁT TIẾN ĐỘ</span><h2>Checklist video công trình</h2><p>Kiểm tra video cần quay, cần biên tập và đánh dấu khi đã hoàn thành để không bỏ sót nội dung.</p></div><Link className="primary" href="/media">Mở quản lý Media</Link></section>
    <section className={styles.stats}><Stat label="Tổng video" value={total}/><Stat label="Cần hoàn thành" value={remaining} warning/><Stat label="Đã hoàn thành" value={completed} done/></section>
    <div className={styles.toolbar}><div className="team-tabs"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>Tất cả</button><button className={filter === 'todo' ? 'selected' : ''} onClick={() => setFilter('todo')}>Cần làm</button><button className={filter === 'done' ? 'selected' : ''} onClick={() => setFilter('done')}>Đã xong</button></div><span>{visible.length} công trình</span></div>
    <section className={styles.projects}>{visible.map((project) => <ProjectChecklist key={project.id} project={project} pending={pending} onUpdate={updateWorkflow}/>)}</section>
    {!visible.length ? <div className="card empty">Chưa có công trình phù hợp.</div> : null}
  </>;
}

function Stat({label, value, warning, done}: {label: string; value: number; warning?: boolean; done?: boolean}) { return <article className={`${styles.stat} ${warning ? styles.warning : ''} ${done ? styles.done : ''}`}><span>{label}</span><strong>{value}</strong></article>; }

function ProjectChecklist({project, pending, onUpdate}: {project: MediaProject; pending: boolean; onUpdate: (stage: MediaStage, status: MediaWorkflowStatus, url: string) => void}) {
  const completed = project.stages.filter((stage) => stage.workflowStatus === 'published').length;
  const percentage = project.stages.length ? Math.round(completed / project.stages.length * 100) : 0;
  return <article className={`card ${styles.project}`}>
    <header><div><span>CÔNG TRÌNH</span><h3>{project.projectName}</h3></div><div className={styles.result}><strong>{percentage}%</strong><small>{completed}/{project.stages.length} video</small></div></header>
    <div className={styles.progress}><i style={{width: `${percentage}%`}}/></div>
    <div className={styles.flow} style={{gridTemplateColumns: `repeat(${project.stages.length}, minmax(120px, 1fr))`}}>{project.stages.map((stage, index) => <div key={stage.id} className={`${styles.flowStep} ${stage.workflowStatus === 'published' ? styles.flowDone : ''}`}><span>{stage.workflowStatus === 'published' ? <Check/> : index + 1}</span><b>{stageLabels[stage.stage]}</b><small>{workflowLabels[stage.workflowStatus]}</small></div>)}</div>
    <div className={styles.list}>{mediaStageOrder.map((key) => { const stage = project.stages.find((item) => item.stage === key); if (!stage) return null; const index = project.stages.indexOf(stage); const locked = project.stages.slice(0, index).some((item) => item.workflowStatus !== 'published'); return <WorkflowItem key={stage.id} stage={stage} locked={locked} pending={pending} onUpdate={onUpdate}/>; })}</div>
  </article>;
}

function WorkflowItem({stage, locked, pending, onUpdate}: {stage: MediaStage; locked: boolean; pending: boolean; onUpdate: (stage: MediaStage, status: MediaWorkflowStatus, url: string) => void}) {
  const [status, setStatus] = useState<MediaWorkflowStatus>(stage.workflowStatus); const [url, setUrl] = useState(stage.publishedUrl);
  const published = stage.workflowStatus === 'published';
  return <div className={`${styles.item} ${published ? styles.completed : ''}`}><span className={styles.checkbox}>{published ? <Check size={14}/> : locked ? <LockKeyhole size={12}/> : null}</span><span className={styles.info}><b>{stageLabels[stage.stage]}</b><small className={styles.status}>{statusLabels[stage.status]}</small></span><span className={styles.meta}>{stage.scheduledAt ? <small><CalendarDays/> {formatDate(stage.scheduledAt)}</small> : <small><CircleAlert/> Chưa có lịch</small>}<small><UserRound/> {stage.assigneeName}</small></span><span className={styles.shot}>{stage.shotList || 'Chưa nhập nội dung cần quay'}</span><div className={styles.workflowEdit}><select value={status} disabled={pending || stage.status === 'cancelled'} onChange={(event) => setStatus(event.target.value as MediaWorkflowStatus)}>{Object.entries(workflowLabels).map(([value, label]) => <option key={value} value={value} disabled={value === 'published' && locked}>{label}</option>)}</select><input value={url} onChange={(event) => setUrl(event.target.value)} type="url" placeholder="Link bài đăng (nếu có)"/><button className="table-action" disabled={pending || (status === 'published' && locked)} onClick={() => onUpdate(stage, status, url)}>Cập nhật</button>{stage.publishedUrl ? <a href={stage.publishedUrl} target="_blank" rel="noreferrer" aria-label="Mở bài đã đăng"><ExternalLink/></a> : null}</div>{locked ? <small className={styles.lockNote}><LockKeyhole/> Phải đăng video trước đó trước khi đăng bước này</small> : null}</div>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat('vi-VN', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(value)); }
