import { getChatApiBaseUrl, getStoredChatToken } from './chatApi';

async function chargeRequest(path, { method = 'GET', body, query } = {}) {
  const token = getStoredChatToken();
  if (!token) {
    throw new Error('缺少 token，请先登录');
  }

  const baseUrl = getChatApiBaseUrl().replace(/\/$/, '');
  const queryString = query
    ? `?${new URLSearchParams(
        Object.entries(query).reduce((acc, [key, value]) => {
          if (value !== undefined && value !== null && String(value) !== '') {
            acc[key] = String(value);
          }
          return acc;
        }, {})
      ).toString()}`
    : '';

  const response = await fetch(`${baseUrl}${path}${queryString}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const rawText = await response.text();
  let parsed = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok || (parsed?.code && parsed.code !== 20000)) {
    throw new Error(parsed?.msg || parsed?.message || rawText || '请求失败');
  }

  return parsed;
}

export function getChargeList() {
  return chargeRequest('/api/charge/list', { method: 'GET' });
}

export function createOrder(data) {
  return chargeRequest('/api/charge/order/create', {
    method: 'POST',
    body: data,
  });
}

export function redeemCode(data) {
  return chargeRequest('/api/charge/redeem', {
    method: 'POST',
    body: data,
  });
}

export function checkOrderStatus(orderNo) {
  return chargeRequest('/api/charge/order/status', {
    method: 'GET',
    query: { order_no: orderNo },
  });
}
