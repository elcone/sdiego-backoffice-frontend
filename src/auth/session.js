import { reactive } from "vue";

export const session = reactive({ authenticated: false, user: null, permissions: [], ready: false, error: "" });
let initialCheck;
let csrfToken = "";
let onExpired = () => {};
export function onSessionExpired(callback) { onExpired = callback; }
export function clearSession() {
  Object.assign(session, { authenticated: false, user: null, permissions: [] });
  csrfToken = "";
}
export function expireSession() { clearSession(); onExpired(); }
export function currentCsrfToken() {
  return decodeURIComponent(globalThis.document?.cookie.split("; ").find(value => value.startsWith("csrftoken="))?.slice(10) || csrfToken);
}
async function authRequest(action, body) {
  const response = await fetch(`/api/auth/${action}/`, {
    credentials: "same-origin", method: body ? "POST" : "GET",
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json", "X-CSRFToken": currentCsrfToken() } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status === 403
    ? "No se pudo validar la seguridad de la solicitud. Actualice la página e intente nuevamente."
    : data.detail || "No se pudo consultar la sesión.");
  Object.assign(session, { authenticated: data.authenticated, user: data.user, permissions: data.permissions, ready: true, error: "" });
  csrfToken = data.csrf_token;
  return data;
}
export const checkSession = () => authRequest("session");
export function initializeSession() {
  if (!initialCheck) initialCheck = checkSession().catch(error => { initialCheck = undefined; session.error = "No se pudo comprobar la sesión. Recargue la página para intentar nuevamente."; throw error; });
  return initialCheck;
}
export const login = (username, password) => authRequest("login", { username, password });
export async function logout() { await authRequest("logout", {}); clearSession(); }
