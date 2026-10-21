import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto';

export const tiktokRedirectUri = process.env.TIKTOK_REDIRECT_URI || 'https://work.dominotb.vn/api/integrations/tiktok/callback';
export const tiktokScopes = ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'];

export type TikTokTokenResponse = {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
  log_id?: string;
};

export function getTikTokConfig() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) throw new Error('Chưa cấu hình TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET.');
  return {clientKey, clientSecret, redirectUri: tiktokRedirectUri};
}

export function encryptTikTokToken(value: string) {
  const key = tokenKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptTikTokToken(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split('.');
  if (!ivValue || !tagValue || !encryptedValue) throw new Error('Token TikTok đã lưu không hợp lệ.');
  const decipher = createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8');
}

function tokenKey() {
  const encoded = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error('Chưa cấu hình TIKTOK_TOKEN_ENCRYPTION_KEY.');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('TIKTOK_TOKEN_ENCRYPTION_KEY phải là khóa base64 32 byte.');
  return key;
}
