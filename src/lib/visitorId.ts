/**
 * Persistent Client-Side Visitor & Quota Tracking Manager
 * Guarantees reliable visitor persistence across iframe sandboxes,
 * page reloads, and third-party cookie restrictions.
 */

const VISITOR_ID_KEY = 'planilha_ia_visitor_id';
const FREE_CLAIMED_KEY = 'planilha_ia_free_pdf_claimed';
const FINGERPRINT_KEY = 'planilha_ia_client_fingerprint';

/**
 * Returns or initializes a persistent visitor ID stored in localStorage
 */
export function getOrCreateVisitorId(): string {
  try {
    let visitorId = localStorage.getItem(VISITOR_ID_KEY);
    if (!visitorId || visitorId.length < 12) {
      const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      visitorId = `vis_${randomHex}`;
      localStorage.setItem(VISITOR_ID_KEY, visitorId);
    }

    // Also mirror to cookie for HTTP requests when cookies are allowed
    try {
      const isSecure = window.location.protocol === 'https:';
      const cookieStr = `visitor_token=${visitorId}; path=/; max-age=31536000; ${
        isSecure ? 'SameSite=None; Secure; Partitioned;' : 'SameSite=Lax;'
      }`;
      document.cookie = cookieStr;
    } catch (_) {}

    return visitorId;
  } catch (_) {
    return 'vis_fallback_' + Date.now();
  }
}

/**
 * Computes a lightweight browser fingerprint based on hardware/system characteristics
 */
export function getClientFingerprint(): string {
  try {
    let fp = localStorage.getItem(FINGERPRINT_KEY);
    if (fp) return fp;

    const nav = window.navigator || ({} as any);
    const screen = window.screen || ({} as any);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const raw = `${nav.userAgent || ''}|${screen.width}x${screen.height}|${nav.language || ''}|${tz}`;

    // Simple deterministic string hash
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }

    fp = `fp_${Math.abs(hash).toString(16)}_${screen.colorDepth || 24}`;
    localStorage.setItem(FINGERPRINT_KEY, fp);
    return fp;
  } catch (_) {
    return 'fp_generic';
  }
}

/**
 * Returns whether this browser instance has already consumed the 1st free PDF download
 */
export function isFreePdfClaimedLocally(): boolean {
  try {
    return localStorage.getItem(FREE_CLAIMED_KEY) === 'true';
  } catch (_) {
    return false;
  }
}

/**
 * Marks the 1st free PDF download as permanently consumed locally
 */
export function markFreePdfClaimedLocally(): void {
  try {
    localStorage.setItem(FREE_CLAIMED_KEY, 'true');
  } catch (_) {}
}

/**
 * Enhanced fetch wrapper that automatically passes persistent visitor and fingerprint headers
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const visitorId = getOrCreateVisitorId();
  const fingerprint = getClientFingerprint();

  const headers = new Headers(init?.headers || {});
  headers.set('X-Visitor-Id', visitorId);
  headers.set('X-Client-Fingerprint', fingerprint);

  return fetch(input, {
    ...init,
    headers,
  });
}
