import {
  DEFAULT_CHAT_API_URL,
  DEFAULT_TEXT_MODEL,
  JIMIAIGO_TOKEN_STORAGE_KEY,
} from './constants';

export function getChatApiBaseUrl() {
  if (typeof import.meta !== 'undefined') {
    return import.meta.env.VITE_API_URL || import.meta.env.VITE_JIMIAIGO_API_URL || DEFAULT_CHAT_API_URL;
  }
  return DEFAULT_CHAT_API_URL;
}

export function getStoredChatToken() {
  if (typeof window === 'undefined') return '';

  const envToken = import.meta.env.VITE_API_TOKEN || import.meta.env.VITE_JIMIAIGO_TOKEN;
  if (envToken) return String(envToken).trim();

  return (
    window.localStorage.getItem(JIMIAIGO_TOKEN_STORAGE_KEY) ||
    window.localStorage.getItem('token') ||
    window.localStorage.getItem('access_token') ||
    ''
  ).trim();
}

export async function runChatCompletion({ token, content, model = DEFAULT_TEXT_MODEL }) {
  const baseUrl = getChatApiBaseUrl().replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/api/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: 'user', content }],
    }),
  });

  const rawText = await response.text();
  let parsed = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    throw new Error(parsed?.msg || parsed?.message || rawText || '生成失败');
  }

  const generated = parsed?.choices?.[0]?.message?.content;
  if (typeof generated !== 'string' || !generated.trim()) {
    throw new Error('返回内容为空');
  }

  return generated.trim();
}
