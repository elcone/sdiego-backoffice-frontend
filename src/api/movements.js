export async function request(url, options = {}) {
  const token = document.cookie.split("; ").find(value => value.startsWith("csrftoken="))?.split("=")[1];
  const response = await fetch(url, { credentials: "same-origin", ...options,
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(!["GET", "HEAD", "OPTIONS"].includes((options.method || "GET").toUpperCase()) ? { "X-CSRFToken": decodeURIComponent(token || "") } : {}) },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(response.status === 403 ? "La sesión no está iniciada, expiró o no tiene permisos. Inicie sesión e intente nuevamente." : `No se pudo completar la solicitud. ${Object.values(data).flat().join(" ")}`);
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
