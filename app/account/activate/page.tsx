import {redirect} from 'next/navigation';
import {requireCurrentProfile} from '@/lib/auth';
import ActivationForm from './ActivationForm';

export default async function ActivatePage({searchParams}: {searchParams: Promise<{error?: string}>}) {
  const profile = await requireCurrentProfile({allowIncomplete: true});
  if (!profile.mustChangePassword && profile.profileCompleted) redirect('/');
  const {error} = await searchParams;
  const message = error === 'invalid' ? 'Vui lòng kiểm tra thông tin và các điều kiện mật khẩu.' : error === 'employee-code' ? 'Mã nhân viên đã được sử dụng. Vui lòng chọn mã khác.' : error === 'email-exists' ? 'Email đã được sử dụng cho tài khoản khác.' : error === 'weak-password' ? 'Mật khẩu chưa đáp ứng chính sách bảo mật của hệ thống.' : error ? 'Không thể kích hoạt tài khoản. Vui lòng thử lại.' : '';
  return <main className="login-page"><section className="login-card activation-card"><div className="brand login-brand"><b>DOMINO</b><span>Kích hoạt tài khoản nhân viên</span></div><h1>Hoàn thành hồ sơ</h1><p>Đổi mật khẩu tạm và bổ sung thông tin trước khi sử dụng hệ thống.</p>{message ? <div className="notice">{message}</div> : null}<ActivationForm fullName={profile.fullName} employeeCode={profile.employeeCode} phone={profile.phone} email={profile.email}/></section></main>;
}
