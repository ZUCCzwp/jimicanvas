import { JIMIAIGO_TOKEN_STORAGE_KEY } from './constants';
import { getChatApiBaseUrl, requestJimiaigo } from './jimiaigoApi';

export function saveAuthToken(token) {
  if (typeof window === 'undefined' || !token) return;
  const value = String(token).trim();
  if (!value) return;
  window.localStorage.setItem(JIMIAIGO_TOKEN_STORAGE_KEY, value);
  window.localStorage.setItem('token', value);
  window.dispatchEvent(new CustomEvent('auth:token-saved'));
}

export function clearAuthToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(JIMIAIGO_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem('token');
  window.localStorage.removeItem('access_token');
  window.dispatchEvent(new CustomEvent('auth:token-cleared'));
}

export async function login({ username, password }) {
  const data = await requestJimiaigo('/api/login', {
    method: 'POST',
    body: { username, password },
    fallback: '登录失败',
  });
  const token = data?.JimiAiToken || data?.token;
  if (!token) throw new Error('未获取到登录凭证');
  saveAuthToken(token);
  return token;
}

export async function register({
  email,
  nickname,
  password,
  verify_code,
  role_id,
  invite_code = '',
}) {
  const data = await requestJimiaigo('/api/register', {
    method: 'POST',
    body: {
      email,
      nickname,
      password,
      verify_code,
      role_id,
      invite_code,
    },
    fallback: '注册失败',
  });
  const token = data?.JimiAiToken || data?.token;
  if (!token) throw new Error('未获取到登录凭证');
  saveAuthToken(token);
  return token;
}

export async function sendEmailCode(email) {
  return requestJimiaigo('/api/sendEmailCode', {
    method: 'POST',
    body: { email },
    fallback: '发送验证码失败',
  });
}

export async function fetchPublicRoles() {
  const data = await requestJimiaigo('/api/roles', {
    method: 'GET',
    fallback: '获取角色列表失败',
  });
  return Array.isArray(data) ? data : [];
}

export function parseUserPayment(payment) {
  const jimicoin = parseFloat(payment?.jimicoin ?? 0) || 0;
  const usedCoin = parseFloat(payment?.used_coin ?? payment?.usedCoin ?? 0) || 0;
  const remaining = Math.max(jimicoin - usedCoin, 0);
  const percentage =
    jimicoin > 0 ? Math.min(100, Math.max(0, (remaining / jimicoin) * 100)) : 0;

  return {
    jimicoin,
    usedCoin,
    remaining,
    percentage: Math.round(percentage),
  };
}

export function formatBalanceAmount(amount) {
  return `$${Math.max(parseFloat(amount) || 0, 0).toFixed(4)}`;
}

/** 将接口返回的头像路径转为可访问 URL */
export function resolveUserAvatarUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }
  const base = getChatApiBaseUrl().replace(/\/$/, '');
  return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`;
}

export function getUserDisplayInitial(nickname) {
  const text = String(nickname || '').trim();
  if (!text) return 'U';
  const first = [...text][0];
  return first ? first.toUpperCase() : 'U';
}

export function parseVipInfo(vipInfo) {
  const isVip = Boolean(vipInfo?.is_vip);
  return {
    isVip,
    vipLevel: Number(vipInfo?.vip_level) || 0,
  };
}

export function getRechargeUrl() {
  const explicit = import.meta.env.VITE_RECHARGE_URL;
  if (explicit) return String(explicit).trim();

  const webApp = import.meta.env.VITE_WEB_APP_URL || import.meta.env.VITE_JIMIAIAPP_URL;
  if (webApp) return `${String(webApp).replace(/\/$/, '')}/recharge`;

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/recharge`;
  }

  return '/recharge';
}

export async function fetchUserInfo(token) {
  const data = await requestJimiaigo('/api/user/info', {
    token,
    method: 'GET',
    fallback: '获取用户信息失败',
  });

  if (!data) {
    throw new Error('用户信息为空');
  }

  const payment = parseUserPayment(data.payment);
  const nickname = data.nickname || data.email || '';
  return {
    nickname,
    avatarUrl: resolveUserAvatarUrl(data.avatar_url || data.avatar || ''),
    ...parseVipInfo(data.vip_info),
    ...payment,
    profile: data,
  };
}
