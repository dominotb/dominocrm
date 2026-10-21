import {redirect} from 'next/navigation';
import {getCurrentProfile} from '@/lib/auth';

export default async function LoginPage({searchParams}: {searchParams: Promise<{error?: string}>}) {
  const profile = await getCurrentProfile();
  if (profile) redirect('/');

  const params = await searchParams;
  const message = params.error === 'invalid' ? 'Email hoặc mật khẩu chưa đúng.' : params.error === 'missing' ? 'Vui lòng nhập email và mật khẩu.' : '';

  return <main className="login-page">
    <section className="login-card">
      <div className="brand login-brand"><b>DOMINO</b><span>Marketing CRM</span></div>
      <h1>Đăng nhập</h1>
      <p>Đăng nhập bằng tài khoản nhân viên đã tạo trong Supabase Auth.</p>
      {message ? <div className="notice">{message}</div> : null}
      <form action="/auth/sign-in" method="post" className="login-form">
        <label>Email<input name="email" type="email" autoComplete="email" required/></label>
        <label>Mật khẩu<input name="password" type="password" autoComplete="current-password" required/></label>
        <button className="primary" type="submit">Đăng nhập</button>
      </form>
    </section>
  </main>;
}
