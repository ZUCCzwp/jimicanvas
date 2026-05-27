import { getChatApiBaseUrl } from './chatApi';

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
  const baseUrl = getChatApiBaseUrl().replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/api/user/info`, {
    method: 'GET',
    headers: {
      Authorization: token,
    },
  });

  const rawText = await response.text();
  let parsed = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok || (parsed?.code && parsed.code !== 20000)) {
    throw new Error(parsed?.msg || parsed?.message || rawText || '获取用户信息失败');
  }

  if (!parsed?.data) {
    throw new Error('用户信息为空');
  }

  const payment = parseUserPayment(parsed.data.payment);
  return {
    nickname: parsed.data.nickname || parsed.data.email || '',
    ...payment,
    profile: parsed.data,
  };
}
