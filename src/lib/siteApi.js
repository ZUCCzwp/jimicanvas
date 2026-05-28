import { DEFAULT_SITE_SLOGAN, DEFAULT_SITE_TITLE } from './constants';
import { API_SUCCESS_CODE, getApiUrl, parseResponseBody } from './jimiaigoApi';
import { normalizeImageUrl } from './imageApi';

export function getDefaultSiteSettings() {
  return {
    title: DEFAULT_SITE_TITLE,
    slogan: DEFAULT_SITE_SLOGAN,
    kefuQrUrl: '',
    logoUrl: '',
  };
}

export async function fetchSiteConfig() {
  const defaults = getDefaultSiteSettings();

  try {
    const response = await fetch(getApiUrl('/api/site-config'));
    if (!response.ok) return defaults;

    const parsed = parseResponseBody(await response.text());
    if (parsed?.code !== API_SUCCESS_CODE || !parsed?.data) return defaults;

    const data = parsed.data;
    const kefuUrl = data.kefu_qr_url || data.kefuQrUrl || '';
    const logoUrl = data.logo_url || data.logoUrl || '';

    return {
      title: data.zh_title || data.zhTitle || defaults.title,
      slogan: data.slogan || defaults.slogan,
      kefuQrUrl: kefuUrl ? normalizeImageUrl(kefuUrl) : '',
      logoUrl: logoUrl ? normalizeImageUrl(logoUrl) : '',
    };
  } catch {
    return defaults;
  }
}

/** @deprecated Use fetchSiteConfig instead */
export async function fetchSiteKefuQrUrl() {
  const settings = await fetchSiteConfig();
  return settings.kefuQrUrl;
}
