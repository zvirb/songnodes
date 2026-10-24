/**
 * Where the frontend reaches the REST API and where OAuth providers send the user back.
 *
 * By default API requests are same-origin (`/api/...`): Vite proxies them in development
 * and the frontend's nginx proxies them in the Compose stack. Set `VITE_API_BASE_URL`
 * only to talk to an API on another origin.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

/**
 * Absolute OAuth redirect URI for a frontend path. It must match the URI registered with
 * the provider exactly: Spotify only accepts loopback redirects as `127.0.0.1`, so set
 * `VITE_OAUTH_REDIRECT_ORIGIN` (for example `http://127.0.0.1:3006`) when the app is
 * opened under another name. Defaults to the page's own origin.
 */
export function oauthRedirectUri(path: string): string {
  const origin = (import.meta.env.VITE_OAUTH_REDIRECT_ORIGIN || window.location.origin).replace(/\/$/, '');
  return `${origin}${path}`;
}
