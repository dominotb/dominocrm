'use server';

import {randomBytes} from 'node:crypto';
import {revalidatePath, revalidateTag} from 'next/cache';
import {createAuthClient, requireCurrentProfile} from '@/lib/auth';
import {createServiceClient} from '@/lib/supabase';

export async function createEmployeeAction(formData: FormData) {
  await requireCurrentProfile();
  const fullName = text(formData.get('fullName'));
  const phone = text(formData.get('phone'));
  const position = text(formData.get('position'));
  if (!fullName || !phone || !position) return {ok: false as const, error: 'Vui lòng nhập đủ họ tên, SĐT và chức vụ.'};
  const service = createServiceClient();
  const employeeCode = `DN${new Date().getFullYear().toString().slice(-2)}${Date.now().toString().slice(-6)}`;
  const email = `${slug(fullName)}.${phone.replace(/\D/g, '').slice(-4) || 'user'}.${employeeCode.toLowerCase()}@domino-account.vn`;
  const temporaryPassword = `Dn!${randomBytes(9).toString('base64url')}`;
  const {data: authData, error: authError} = await service.auth.admin.createUser({email, password: temporaryPassword, email_confirm: true, user_metadata: {full_name: fullName}, app_metadata: {employee_code: employeeCode}});
  if (authError || !authData.user) return {ok: false as const, error: authError?.message || 'Không tạo được tài khoản.'};
  const {error: profileError} = await service.from('profiles').upsert({id: authData.user.id, full_name: fullName, email, phone, employee_code: employeeCode, position, must_change_password: true, profile_completed: false, updated_at: new Date().toISOString()});
  if (profileError) { await service.auth.admin.deleteUser(authData.user.id); return {ok: false as const, error: profileError.message}; }
  const {data: role} = await service.from('roles').upsert({name: position}, {onConflict: 'name'}).select('id').single();
  if (role) await service.from('user_roles').upsert({user_id: authData.user.id, role_id: role.id});
  revalidateTag('employees', 'max'); revalidatePath('/team');
  return {ok: true as const, credentials: {id: authData.user.id, fullName, employeeCode, email, temporaryPassword}};
}

export async function updateEmployeeAction(formData: FormData) {
  await requireCurrentProfile();
  const id = text(formData.get('id')); const fullName = text(formData.get('fullName')); const phone = text(formData.get('phone')); const email = text(formData.get('email')).toLowerCase(); const position = text(formData.get('position'));
  if (!id || !fullName || !phone || !email || !position) return {ok: false as const, error: 'Thiếu thông tin nhân viên.'};
  const service = createServiceClient();
  const {error} = await service.from('profiles').update({full_name: fullName, phone, email, position, updated_at: new Date().toISOString()}).eq('id', id);
  if (error) return {ok: false as const, error: error.message};
  const {error: authError} = await service.auth.admin.updateUserById(id, {email, email_confirm: true, user_metadata: {full_name: fullName}});
  if (authError) return {ok: false as const, error: authError.message};
  const {data: role} = await service.from('roles').upsert({name: position}, {onConflict: 'name'}).select('id').single();
  if (role) { await service.from('user_roles').delete().eq('user_id', id); await service.from('user_roles').insert({user_id: id, role_id: role.id}); }
  revalidateTag('employees', 'max'); revalidateTag(`profile-${id}`, 'max'); revalidatePath('/team');
  return {ok: true as const};
}

export async function resetEmployeePasswordAction(employeeId: string) {
  const currentUser = await requireCurrentProfile();
  if (!employeeId || employeeId === currentUser.id) return {ok: false as const, error: 'Không thể cấp lại mật khẩu cho tài khoản đang đăng nhập.'};

  const service = createServiceClient();
  const {data: profile, error: profileError} = await service
    .from('profiles')
    .select('id,full_name,email,employee_code')
    .eq('id', employeeId)
    .single();
  if (profileError || !profile?.email) return {ok: false as const, error: profileError?.message || 'Không tìm thấy tài khoản nhân viên.'};

  const temporaryPassword = `Dn!${randomBytes(9).toString('base64url')}`;
  const {error: authError} = await service.auth.admin.updateUserById(employeeId, {
    password: temporaryPassword,
    email_confirm: true,
  });
  if (authError) return {ok: false as const, error: authError.message};

  const {error: updateError} = await service.from('profiles').update({
    must_change_password: true,
    profile_completed: false,
    updated_at: new Date().toISOString(),
  }).eq('id', employeeId);
  if (updateError) return {ok: false as const, error: updateError.message};

  revalidateTag('employees', 'max');
  revalidateTag(`profile-${employeeId}`, 'max');
  revalidatePath('/team');
  return {ok: true as const, credentials: {
    id: profile.id,
    fullName: profile.full_name || profile.email,
    employeeCode: profile.employee_code || '',
    email: profile.email,
    temporaryPassword,
  }};
}

export async function deleteEmployeeAction(employeeId: string) {
  const currentUser = await requireCurrentProfile();
  if (!employeeId) return {ok: false as const, error: 'Thiếu mã tài khoản nhân viên.'};
  const deletedCurrentUser = employeeId === currentUser.id;

  const service = createServiceClient();
  // These records must remain for reporting, so detach their creator before the
  // profile is removed. Other employee references use ON DELETE SET NULL/CASCADE.
  for (const table of ['marketing_plans', 'crm_leads'] as const) {
    const {error} = await service.from(table).update({created_by: null}).eq('created_by', employeeId);
    if (error) return {ok: false as const, error: `Không thể gỡ liên kết dữ liệu ở ${table}: ${error.message}`};
  }

  const {error} = await service.auth.admin.deleteUser(employeeId);
  if (error) return {ok: false as const, error: error.message};
  if (deletedCurrentUser) {
    const auth = await createAuthClient();
    await auth.auth.signOut({scope: 'local'});
  }

  revalidateTag('employees', 'max');
  revalidateTag(`profile-${employeeId}`, 'max');
  revalidatePath('/team');
  return {ok: true as const, deletedCurrentUser};
}

export async function saveTaskAction(formData: FormData) {
  const user = await requireCurrentProfile(); const id = text(formData.get('id'));
  const payload = {branch: text(formData.get('branch')), title: text(formData.get('title')), description: text(formData.get('description')), assigned_to: text(formData.get('assignedTo')) || null, status: text(formData.get('status')), starts_on: text(formData.get('startsOn')) || null, due_on: text(formData.get('dueOn')) || null, updated_at: new Date().toISOString()};
  if (!payload.branch || !payload.title || !payload.status) return {ok: false as const, error: 'Thiếu thông tin công việc.'};
  const service = createServiceClient();
  const result = id ? await service.from('marketing_team_tasks').update(payload).eq('id', id) : await service.from('marketing_team_tasks').insert({...payload, created_by: user.id});
  if (result.error) return {ok: false as const, error: result.error.message}; revalidatePath('/team'); return {ok: true as const};
}

export async function deleteTaskAction(taskId: string) { await requireCurrentProfile(); const {error} = await createServiceClient().from('marketing_team_tasks').delete().eq('id', taskId); if (error) return {ok: false as const, error: error.message}; revalidatePath('/team'); return {ok: true as const}; }
function text(value: FormDataEntryValue | null) { return String(value || '').trim(); }
function slug(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'nhanvien'; }
