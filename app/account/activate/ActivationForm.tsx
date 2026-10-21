'use client';

import {useState} from 'react';
import {Eye, EyeOff} from 'lucide-react';
import {activateAccountAction} from './actions';

type Props = {
  fullName: string;
  employeeCode: string;
  phone: string;
  email: string;
};

export default function ActivationForm({fullName, employeeCode, phone, email}: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const checks = {
    length: password.length >= 10,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const passwordValid = Object.values(checks).every(Boolean);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  return <form action={activateAccountAction} className="login-form">
    <label>Họ và tên<input name="fullName" required defaultValue={fullName}/></label>
    <label>Mã nhân viên<input name="employeeCode" required defaultValue={employeeCode} autoComplete="off"/></label>
    <label>Số điện thoại<input name="phone" required defaultValue={phone}/></label>
    <label>Email<input name="email" type="email" required defaultValue={email}/></label>
    <label>
      Mật khẩu mới
      <span className="password-input">
        <input name="password" type={showPassword ? 'text' : 'password'} minLength={10} required autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} aria-describedby="password-rules"/>
        <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
      </span>
    </label>
    <ul className="password-rules" id="password-rules" aria-live="polite">
      <PasswordRule valid={checks.length}>Ít nhất 10 ký tự</PasswordRule>
      <PasswordRule valid={checks.uppercase}>Có ít nhất 1 chữ in hoa</PasswordRule>
      <PasswordRule valid={checks.lowercase}>Có ít nhất 1 chữ thường</PasswordRule>
      <PasswordRule valid={checks.special}>Có ít nhất 1 ký tự đặc biệt</PasswordRule>
    </ul>
    <label>
      Nhập lại mật khẩu
      <span className="password-input">
        <input name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} minLength={10} required autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} aria-invalid={confirmPassword.length > 0 && !passwordsMatch}/>
        <button type="button" onClick={() => setShowConfirmPassword(value => !value)} aria-label={showConfirmPassword ? 'Ẩn mật khẩu nhập lại' : 'Hiện mật khẩu nhập lại'} aria-pressed={showConfirmPassword}>{showConfirmPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
      </span>
      {confirmPassword ? <span className={`password-match ${passwordsMatch ? 'valid' : 'invalid'}`}>{passwordsMatch ? '✓ Mật khẩu đã khớp' : '× Mật khẩu chưa khớp'}</span> : null}
    </label>
    <button className="primary" type="submit" disabled={!passwordValid || !passwordsMatch}>Kích hoạt tài khoản</button>
  </form>;
}

function PasswordRule({valid, children}: {valid: boolean; children: React.ReactNode}) {
  return <li className={valid ? 'valid' : ''}><span aria-hidden="true">{valid ? '✓' : '○'}</span>{children}</li>;
}
