/**
 * k6 helpers — auth admin.
 *
 * Récupère un token admin pour les chaos scripts.
 */
import http from 'k6/http';

export function loginAsAdmin(baseUrl, email, password) {
  const r = http.post(`${baseUrl}/api/admin/login`, JSON.stringify({
    email, password,
  }), { headers: { 'Content-Type': 'application/json' } });
  if (r.status !== 200) {
    throw new Error(`Admin login failed: ${r.status}`);
  }
  const cookie = r.headers['Set-Cookie'] ?? '';
  return { cookie };
}
