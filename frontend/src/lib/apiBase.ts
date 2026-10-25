/**
 * Where the frontend reaches the REST API and where OAuth providers send the user back.
 *
 * By default API requests are same-origin (`/api/...`): Vite proxies them in development
 * and the frontend's nginx proxies them in the Compose stack. Set `VITE_API_BASE_URL`
 * only to talk to an API on another origin.
 */
/**
 * Allowed origin list or origin validator for transport hardening.
 * Prevents SSRF and malicious redirect injection.
 */
export function isTrustedOrigin(originOrUrl: string): boolean {
  if (!originOrUrl) return true;

  const trimmed = originOrUrl.trim();

  // Relative paths starting with '/' (and not '//') are same-origin and safe
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }

  // Reject backslashes or embedded userinfo (e.g. http://user:pass@domain)
  if (trimmed.includes('\\') || trimmed.includes('@')) {
    return false;
  }

  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(trimmed, base);
    const protocol = url.protocol.toLowerCase();

    // Must use http or https
    if (protocol !== 'http:' && protocol !== 'https:') {
      return false;
    }

    // Check if explicit origin allowlist is provided via VITE_ALLOWED_ORIGINS
    const allowedEnv = import.meta.env.VITE_ALLOWED_ORIGINS;
    if (allowedEnv && allowedEnv.trim() !== '*') {
      const allowedOrigins = allowedEnv.split(',').map((o: string) => o.trim().toLowerCase());

      const isSameOrigin = typeof window !== 'undefined' && url.origin.toLowerCase() === window.location.origin.toLowerCase();
      const hostname = url.hostname.toLowerCase();
      const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';

      const isAllowed = allowedOrigins.some((allowed: string) => {
        if (!allowed) return false;
        if (allowed.startsWith('http://') || allowed.startsWith('https://')) {
          return url.origin.toLowerCase() === allowed.replace(/\/$/, '').toLowerCase();
        }
        return hostname === allowed.toLowerCase();
      });

      return isSameOrigin || isLoopback || isAllowed;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validates and normalizes an API base URL against trusted origins.
 *
 * @param url Raw API base URL
 * @returns Safe, normalized API base URL
 */
export function validateApiBaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return '';

  const trimmed = rawUrl.trim().replace(/\/$/, '');
  if (!trimmed) return '';

  if (isTrustedOrigin(trimmed)) {
    return trimmed;
  }

  console.warn(`[Security] Untrusted API_BASE_URL rejected: "${rawUrl}". Falling back to same-origin.`);
  return '';
}

/**
 * Where the frontend reaches the REST API and where OAuth providers send the user back.
 *
 * By default API requests are same-origin (`/api/...`): Vite proxies them in development
 * and the frontend's nginx proxies them in the Compose stack. Set `VITE_API_BASE_URL`
 * only to talk to an API on another origin.
 */
export const API_BASE_URL = validateApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

/**
 * Absolute OAuth redirect URI for a frontend path. It must match the URI registered with
 * the provider exactly: Spotify only accepts loopback redirects as `127.0.0.1`, so set
 * `VITE_OAUTH_REDIRECT_ORIGIN` (for example `http://127.0.0.1:3006`) when the app is
 * opened under another name. Defaults to the page's own origin.
 */
export function oauthRedirectUri(path: string): string {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const rawOrigin = import.meta.env.VITE_OAUTH_REDIRECT_ORIGIN;
  const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  let origin = fallbackOrigin;
  if (rawOrigin && isTrustedOrigin(rawOrigin)) {
    origin = rawOrigin.trim().replace(/\/$/, '');
  } else if (rawOrigin) {
    console.warn(`[Security] Untrusted VITE_OAUTH_REDIRECT_ORIGIN rejected: "${rawOrigin}". Falling back to current origin.`);
  }

  return `${origin}${safePath}`;
}
