import { checkSession, currentCsrfToken, expireSession } from "../auth/session.js";

export async function request(url, options = {}) {
  const token = currentCsrfToken();
  const response = await fetch(url, { credentials: "same-origin", ...options,
    headers: { Accept: "application/json", ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...(!["GET", "HEAD", "OPTIONS"].includes((options.method || "GET").toUpperCase()) ? { "X-CSRFToken": token || "" } : {}) },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      expireSession();
      throw new Error("Inicie sesión para continuar.");
    }
    if (response.status === 403) {
      let active;
      try { active = (await checkSession()).authenticated; }
      catch { throw new Error("No se pudo verificar la sesión. Intente nuevamente."); }
      if (!active) {
        expireSession();
        throw new Error("Inicie sesión para continuar.");
      }
      throw new Error(typeof data.detail === "string" && data.detail.startsWith("CSRF Failed:")
        ? "No se pudo validar la seguridad de la solicitud (CSRF). Intente nuevamente."
        : data.detail ? "No tiene permisos para realizar esta operación."
          : "La solicitud fue rechazada. La sesión sigue activa.");
    }
    const bankLabels = { transaction_timestamp: "fecha y hora", amount: "importe", account_balance: "saldo", concept: "concepto" };
    const details = Array.isArray(data.errors)
      ? data.errors.map(item => `Fila ${item.row}: ${item.message || (item.fields || []).map(field => bankLabels[field] || field).join(", ")}`).join("; ") : "";
    const error = new Error(`No se pudo completar la solicitud. ${data.detail || Object.values(data).flat().filter(value => typeof value === "string").join(" ")} ${details}`.trim());
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

export async function catalog(name) {
  const rows = [];
  let page = 1;
  while (true) {
    const data = await request(`/api/${name}/?page_size=100&page=${page}`);
    rows.push(...data.results);
    if (!data.next) return rows;
    page++;
  }
}
