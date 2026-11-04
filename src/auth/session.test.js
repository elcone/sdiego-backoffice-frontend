import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { checkSession, clearSession, login, logout, onSessionExpired, session } from "./session.js";
import { safeReturnPath } from "./navigation.js";
import { request } from "../api/movements.js";
const originalFetch = globalThis.fetch;
afterEach(() => { clearSession(); onSessionExpired(() => {}); globalThis.fetch = originalFetch; delete globalThis.document; });
const response = data => ({ ok: true, json: async () => data });
const active = { authenticated: true, user: { username: "operator" }, permissions: [], csrf_token: "rotated" };
test("bootstrap recovers session and login uses rotated CSRF for subsequent writes", async () => {
  globalThis.document = { cookie: "" };
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("session/")) return response({ ...active, authenticated: false, csrf_token: "initial" });
    return response(active);
  };
  await checkSession();
  await login("operator", "password");
  assert.equal(calls[1].options.headers["X-CSRFToken"], "initial");
  assert.equal(session.authenticated, true);
  await request("/api/charge/", { method: "POST", body: "{}" });
  assert.equal(calls[2].options.headers["X-CSRFToken"], "rotated");
  await checkSession();
  await logout();
  assert.equal(session.authenticated, false);
  assert.equal(calls.at(-1).options.method, "POST");
});
test("401 expires session, active 403 preserves session, expired 403 requests login; writes never retry", async () => {
  for (const [status, authenticated] of [[401, false], [403, true], [403, false]]) {
    let expired = 0;
    let writes = 0;
    onSessionExpired(() => expired++);
    globalThis.fetch = async url => {
      if (url.endsWith("session/")) return response({ ...active, authenticated });
      writes++;
      return { ok: false, status, json: async () => ({ detail: "denied" }) };
    };
    await assert.rejects(request("/api/charge/", { method: "POST", body: "{}" }), authenticated ? /permisos/ : /Inicie sesión/);
    assert.equal(writes, 1);
    assert.equal(expired, authenticated ? 0 : 1);
    assert.equal(session.authenticated, authenticated);
  }
});
test("reliable CSRF errors preserve active session", async () => {
  globalThis.fetch = async url => url.endsWith("session/") ? response(active)
    : { ok: false, status: 403, json: async () => ({ detail: "CSRF Failed: token incorrect" }) };
  await assert.rejects(request("/api/charge/", { method: "POST" }), /CSRF/);
  assert.equal(session.authenticated, true);
});
test("return paths allow only existing internal administrative routes", () => {
  for (const value of ["https://evil.test", "//evil.test", "/\\evil.test", "/login", "/missing", ["/casas"], "/casas\n"]) assert.equal(safeReturnPath(value), "/resumen");
  assert.equal(safeReturnPath(undefined), "/resumen");
  assert.equal(safeReturnPath("/movimientos"), "/movimientos");
  assert.equal(safeReturnPath("/casas?activo=1#detalle"), "/casas?activo=1#detalle");
});
