'use server';

import {redirect} from 'next/navigation';
import {revalidateTag} from 'next/cache';
import {requireCurrentProfile} from '@/lib/auth';
import {createServiceClient} from '@/lib/supabase';

export async function activateAccountAction(formData: FormData) {
  const profile = await requireCurrentProfile({allowIncomplete: true});
  const fullName = String(formData.get('fullName') || '').trim();
  const employeeCode = String(formData.get('employeeCode') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const phone = String(formData.get('phone') || '').trim();
  const password = String(formData.get('password') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');
  const validPassword = password.length >= 10 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[^A-Za-z0-9]/.test(password);
  if (!fullName || !employeeCode || !email || !phone || !validPassword || password !== confirmPassword) redirect('/account/activate?error=invalid');

  const service = createServiceClient();
  const {data: duplicateCode} = await service.from('profiles').select('id').eq('employee_code', employeeCode).neq('id', profile.id).maybeSingle();
  if (duplicateCode) redirect('/account/activate?error=employee-code');

  const authUpdates: {password: string; email?: string; email_confirm?: boolean; user_metadata: {full_name: string}} = {
    password,
    user_metadata: {full_name: fullName},
  };
  if (email !== profile.email.toLowerCase()) {
    authUpdates.email = email;
    authUpdates.email_confirm = true;
  }
  const {error: authError} = await service.auth.admin.updateUserById(profile.id, authUpdates);
  if (authError?.code === 'email_exists' || authError?.code === 'user_already_exists') redirect('/account/activate?error=email-exists');
  if (authError?.code === 'weak_password') redirect('/account/activate?error=weak-password');
  if (authError) redirect('/account/activate?error=auth');

  const {error} = await service.from('profiles').update({
    full_name: fullName, employee_code: employeeCode, email, phone, must_change_password: false, profile_completed: true, updated_at: new Date().toISOString(),
  }).eq('id', profile.id);
  if (error?.code === '23505') redirect('/account/activate?error=employee-code');
  if (error) redirect('/account/activate?error=profile');
  revalidateTag(`profile-${profile.id}`, 'max');
  redirect('/');
}
