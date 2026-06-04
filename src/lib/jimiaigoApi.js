import {
  ADMIN_TOKEN_COOKIE_KEY,
  DEFAULT_CHAT_API_URL,
  JIMIAIGO_TOKEN_STORAGE_KEY,
} from './constants';

export const API_SUCCESS_CODE = 20000;
export const LOGIN_AGAIN_CODE = 20001;

/** 连接失败后暂停请求，避免后端未启动时疯狂重试 */
const BACKEND_COOLDOWN_MS = 30000;
let backendUnavailableUntil = 0;

export function isNetworkOrBackendError(error) {
  if (!error) return false;
  if (error.isBackendUnavailable) return true;
  const message = String(error.message || '');
  return (
    error instanceof TypeError ||
    /无法连接|无法连接到|Failed to fetch|NetworkError|Load failed|fetch failed/i.test(message)
  );
}

export function isBackendInCooldown() {
  return Date.now() < backendUnavailableUntil;
}

function markBackendSuccess() {
  backendUnavailableUntil = 0;
}

function markBackendFailure(error) {
  if (!isNetworkOrBackendError(error)) return;
  backendUnavailableUntil = Date.now() + BACKEND_COOLDOWN_MS;
}

function throwIfBackendInCooldown(networkErrorMessage) {
  if (!isBackendInCooldown()) return;
  const err = new Error(networkErrorMessage || '服务暂不可用，请稍后再试');
  err.isBackendUnavailable = true;
  throw err;
}

export function getChatApiBaseUrl() {
  if (typeof import.meta !== 'undefined') {
    return import.meta.env.VITE_API_URL || import.meta.env.VITE_JIMIAIGO_API_URL || DEFAULT_CHAT_API_URL;
  }
  return DEFAULT_CHAT_API_URL;
}

function readCookieToken() {
  if (typeof document === 'undefined') return '';
  const pattern = new RegExp(`(?:^|;\\s*)${ADMIN_TOKEN_COOKIE_KEY}=([^;]*)`);
  const match = document.cookie.match(pattern);
  return match ? decodeURIComponent(match[1]).trim() : '';
}

export function syncStoredChatToken(token) {
  if (typeof window === 'undefined' || !token) return;
  const value = String(token).trim();
  if (!value) return;
  window.localStorage.setItem(JIMIAIGO_TOKEN_STORAGE_KEY, value);
  window.localStorage.setItem('token', value);
}

export function getStoredChatToken() {
  if (typeof window === 'undefined') return '';

  const envToken = import.meta.env.VITE_API_TOKEN || import.meta.env.VITE_JIMIAIGO_TOKEN;
  if (envToken) return String(envToken).trim();

  const fromStorage = (
    window.localStorage.getItem(JIMIAIGO_TOKEN_STORAGE_KEY) ||
    window.localStorage.getItem('token') ||
    window.localStorage.getItem('access_token') ||
    ''
  ).trim();
  if (fromStorage) return fromStorage;

  const fromCookie = readCookieToken();
  if (fromCookie) {
    syncStoredChatToken(fromCookie);
    return fromCookie;
  }

  return '';
}

export function clearStoredChatToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(JIMIAIGO_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem('token');
  window.localStorage.removeItem('access_token');
}

export function createApiError(parsed, fallback, rawText = '') {
  const code = parsed?.code;
  const err = new Error(parsed?.msg || parsed?.message || rawText || fallback);
  if (code != null) err.code = code;
  if (Number(code) === LOGIN_AGAIN_CODE) {
    err.isTokenExpired = true;
    clearStoredChatToken();
  }
  return err;
}

function buildQueryString(query) {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      params.set(key, String(value));
    }
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export function getApiUrl(path, query) {
  const baseUrl = getChatApiBaseUrl().replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}${buildQueryString(query)}`;
}

export function parseResponseBody(rawText) {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

export function assertJimiaigoSuccess(response, parsed, { fallback = '请求失败', rawText = '' } = {}) {
  const hasCode = parsed?.code != null;
  const ok = response.ok && (!hasCode || Number(parsed.code) === API_SUCCESS_CODE);
  if (!ok) {
    throw createApiError(parsed, fallback, rawText);
  }
}

export async function fetchJimiaigo(path, options = {}) {
  const {
    token,
    method = 'GET',
    body,
    query,
    headers = {},
    requireToken = false,
    json = true,
    networkErrorMessage = '请求失败，无法连接到服务',
  } = options;

  const authToken = token ?? getStoredChatToken();
  if (requireToken && !authToken) {
    throw new Error('缺少 token，请先登录');
  }

  const requestHeaders = { ...headers };
  if (authToken) requestHeaders.Authorization = authToken;

  let requestBody;
  if (body instanceof FormData) {
    requestBody = body;
  } else if (body != null) {
    if (json && !requestHeaders['Content-Type']) {
      requestHeaders['Content-Type'] = 'application/json';
    }
    requestBody = json ? JSON.stringify(body) : body;
  }

  throwIfBackendInCooldown(networkErrorMessage);

  let response;
  try {
    response = await fetch(getApiUrl(path, query), {
      method,
      headers: requestHeaders,
      body: requestBody,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      const networkErr = new Error(networkErrorMessage);
      networkErr.isBackendUnavailable = true;
      markBackendFailure(networkErr);
      throw networkErr;
    }
    throw error;
  }

  const rawText = await response.text();
  const parsed = parseResponseBody(rawText);
  return { response, rawText, parsed };
}

/**
 * 统一 Jimiaigo JSON 接口入口：解析响应、校验 code（含 20001 过期）、返回 data。
 */
export async function requestJimiaigo(path, options = {}) {
  const {
    fallback = '请求失败',
    dataOnly = true,
    enrichError,
    ...fetchOptions
  } = options;

  const { response, rawText, parsed } = await fetchJimiaigo(path, fetchOptions);

  try {
    assertJimiaigoSuccess(response, parsed, { fallback, rawText });
  } catch (error) {
    enrichError?.(error, parsed);
    if (!response.ok && response.status >= 500) {
      markBackendFailure(error);
    }
    throw error;
  }

  markBackendSuccess();
  if (dataOnly) return parsed?.data ?? parsed;
  return parsed;
}

/** multipart / FormData 上传 */
export async function requestJimiaigoForm(path, options = {}) {
  return requestJimiaigo(path, {
    method: 'POST',
    json: false,
    ...options,
  });
}
