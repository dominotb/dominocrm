import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {cache} from 'react';
import {cacheLife, cacheTag} from 'next/cache';
import {createServerClient} from '@supabase/ssr';
import {createServiceClient} from './supabase';

export type CurrentProfile = {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  phone: string;
  employeeCode: string;
  position: string;
  mustChangePassword: boolean;
  profileCompleted: boolean;
};

export async function createAuthClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({name, value, options}) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies. Route handlers and actions can.
        }
      },
    },
  });
}

export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const auth = await createAuthClient();
  const {data, error} = await auth.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub || typeof claims.email !== 'string') return null;

  const metadata = claims.user_metadata as {full_name?: string} | undefined;
  const fullName = metadata?.full_name || claims.email.split('@')[0];
  return getCachedProfile(claims.sub, claims.email, fullName);
});

async function getCachedProfile(userId: string, email: string, fallbackName: string): Promise<CurrentProfile> {
  'use cache';
  cacheLife({stale: 60, revalidate: 60, expire: 300});
  cacheTag(`profile-${userId}`);

  const service = createServiceClient();
  const [{data: profile}, {data: userRoles}] = await Promise.all([
    service.from('profiles').select('id,email,full_name,phone,employee_code,position,must_change_password,profile_completed').eq('id', userId).single(),
    service.from('user_roles').select('roles(name)').eq('user_id', userId),
  ]);

  return {
    id: userId,
    email: profile?.email || email,
    fullName: profile?.full_name || fallbackName,
    roles: (userRoles || []).map((row) => {
      const role = row.roles as {name?: string} | {name?: string}[] | null;
      return Array.isArray(role) ? role[0]?.name : role?.name;
    }).filter(Boolean) as string[],
    phone: profile?.phone || '',
    employeeCode: profile?.employee_code || '',
    position: profile?.position || '',
    mustChangePassword: Boolean(profile?.must_change_password),
    profileCompleted: profile?.profile_completed !== false,
  };
}

export async function upsertCurrentProfile(user: {id: string; email?: string; user_metadata?: {full_name?: string}}) {
  if (!user.email) return;

  const service = createServiceClient();
  const fullName = user.user_metadata?.full_name || user.email.split('@')[0];

  await service.from('profiles').upsert({
    id: user.id,
    email: user.email,
    full_name: fullName,
  });
}

export async function requireCurrentProfile(options?: {allowIncomplete?: boolean}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!options?.allowIncomplete && (profile.mustChangePassword || !profile.profileCompleted)) redirect('/account/activate');
  return profile;
}

export async function getEmployees() {
  'use cache';
  cacheLife({stale: 60, revalidate: 60, expire: 300});
  cacheTag('employees');

  const service = createServiceClient();
  const {data: profiles} = await service.from('profiles').select('id,email,full_name,phone,employee_code,position,must_change_password,profile_completed,created_at').order('created_at', {ascending: false});
  const {data: userRoles} = await service.from('user_roles').select('user_id,roles(name)');

  const rolesByUser = new Map<string, string[]>();
  for (const row of userRoles || []) {
    const role = row.roles as {name?: string} | {name?: string}[] | null;
    const roleName = Array.isArray(role) ? role[0]?.name : role?.name;
    if (!roleName) continue;
    rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) || []), roleName]);
  }

  return (profiles || []).map((profile) => ({
    id: profile.id,
    email: profile.email || '',
    fullName: profile.full_name || profile.email || 'Chưa đặt tên',
    createdAt: profile.created_at,
    roles: rolesByUser.get(profile.id) || [],
    phone: profile.phone || '',
    employeeCode: profile.employee_code || '',
    position: profile.position || '',
    mustChangePassword: Boolean(profile.must_change_password),
    profileCompleted: profile.profile_completed !== false,
  }));
}
