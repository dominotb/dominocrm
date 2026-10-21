import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto';

export const metaScopes = ['public_profile', 'ads_read', 'read_insights', 'business_management'];
export function getMetaConfig() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error('Chưa cấu hình META_APP_ID / META_APP_SECRET.');
  return {appId, appSecret, graphVersion: process.env.META_GRAPH_VERSION || 'v21.0', redirectUri: process.env.META_REDIRECT_URI || 'https://work.dominotb.vn/api/integrations/meta/callback'};
}
export function encryptMetaToken(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', tokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}
export function decryptMetaToken(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split('.');
  if (!ivValue || !tagValue || !encryptedValue) throw new Error('Token Meta đã lưu không hợp lệ.');
  const decipher = createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8');
}
function tokenKey() {
  const encoded = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY || process.env.TIKTOK_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error('Chưa cấu hình INTEGRATION_TOKEN_ENCRYPTION_KEY.');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('INTEGRATION_TOKEN_ENCRYPTION_KEY phải là khóa base64 32 byte.');
  return key;
}
