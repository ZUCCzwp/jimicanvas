import { getChatApiBaseUrl } from './chatApi';
import { normalizeImageUrl } from './imageApi';

export async function fetchSiteKefuQrUrl() {
  try {
    const baseUrl = getChatApiBaseUrl().replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/site-config`);
    if (!response.ok) return '';

    const parsed = await response.json();
    if (parsed?.code !== 20000 || !parsed?.data) return '';

    const url = parsed.data.kefu_qr_url || parsed.data.kefuQrUrl || '';
    return url ? normalizeImageUrl(url) : '';
  } catch {
    return '';
  }
}
