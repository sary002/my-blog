/**
 * Resolve the backend base URL at runtime.
 *
 * Precedence:
 *   1. `VITE_API_BASE_URL` env var — explicit override (e.g. for staging).
 *   2. If the page is being served from a loopback host
 *      (localhost / 127.0.0.1 / 0.0.0.0 / ::1), assume a local backend on the
 *      same host at `LOCAL_BACKEND_PORT`. This way opening the dev server
 *      works out-of-the-box without a `.env.local` file.
 *   3. Fall back to the production Render deployment.
 *
 * Must run in the browser, not at build time, so that the same bundle works
 * for both local dev and production visits.
 */

const PROD_BACKEND = 'https://tangsanyi-blog.onrender.com'
const LOCAL_BACKEND_PORT = 3001

const LOCAL_HOSTS: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
])

export function resolveApiBase(): string {
  const explicit = import.meta.env.VITE_API_BASE_URL
  if (explicit) return explicit

  if (typeof window !== 'undefined' && window.location) {
    const { hostname, protocol } = window.location
    if (LOCAL_HOSTS.has(hostname)) {
      return `${protocol}//${hostname}:${LOCAL_BACKEND_PORT}`
    }
  }

  return PROD_BACKEND
}

export const API_BASE = resolveApiBase()
