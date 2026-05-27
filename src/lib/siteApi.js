import { DEFAULT_SITE_SLOGAN, DEFAULT_SITE_TITLE } from './constants';
import { getChatApiBaseUrl } from './chatApi';
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
    const baseUrl = getChatApiBaseUrl().replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/site-config`);
    if (!response.ok) return defaults;

    const parsed = await response.json();
    if (parsed?.code !== 20000 || !parsed?.data) return defaults;

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
