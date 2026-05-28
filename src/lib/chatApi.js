import {
  DEFAULT_TEXT_MODEL,
  JIMIAIGO_TOKEN_STORAGE_KEY,
} from './constants';
import { assertJimiaigoSuccess, fetchJimiaigo, getStoredChatToken } from './jimiaigoApi';

export {
  API_SUCCESS_CODE,
  LOGIN_AGAIN_CODE,
  clearStoredChatToken,
  createApiError,
  getChatApiBaseUrl,
  getStoredChatToken,
} from './jimiaigoApi';

let tokenPromptOpen = false;

export function promptForChatToken(message = '请输入 Jimiaigo 的 Token (AT)', { onSaved } = {}) {
  if (typeof window === 'undefined') return '';
  if (tokenPromptOpen) return '';
  tokenPromptOpen = true;
  try {
    const input = window.prompt(message);
    if (!input) return '';
    const token = String(input).trim();
    if (!token) return '';
    window.localStorage.setItem(JIMIAIGO_TOKEN_STORAGE_KEY, token);
    onSaved?.();
    return token;
  } finally {
    tokenPromptOpen = false;
  }
}

export function getOrRequestToken({ expired = false, onSaved } = {}) {
  const existing = getStoredChatToken();
  if (existing) return existing;
  const message = expired
    ? 'Token 已过期，请重新输入 Jimiaigo 的 Token (AT)'
    : '请输入 Jimiaigo 的 Token (AT)';
  return promptForChatToken(message, { onSaved });
}

export async function runChatCompletion({ token, content, model = DEFAULT_TEXT_MODEL }) {
  const { response, rawText, parsed } = await fetchJimiaigo('/api/chat/completions', {
    token,
    method: 'POST',
    body: {
      model,
      stream: false,
      messages: [{ role: 'user', content }],
    },
    networkErrorMessage: '生成失败，无法连接到服务',
  });

  assertJimiaigoSuccess(response, parsed, { fallback: '生成失败', rawText });

  const generated = parsed?.choices?.[0]?.message?.content;
  if (typeof generated !== 'string' || !generated.trim()) {
    throw new Error('返回内容为空');
  }

  return generated.trim();
}
