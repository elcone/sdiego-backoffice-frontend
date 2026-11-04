import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { catalog, request } from "./movements.js";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.document;
});

test("PATCH sends session credentials, CSRF, and only the supplied body", async () => {
  globalThis.document = { cookie: "csrftoken=local-token" };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/bank-transaction/1/");
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.headers["X-CSRFToken"], "local-token");
    assert.deepEqual(JSON.parse(options.body), { house: 2, description: "Nota" });
    return { ok: true, json: async () => ({ id: 1 }) };
  };
  assert.deepEqual(await request("/api/bank-transaction/1/", {
    method: "PATCH", body: JSON.stringify({ house: 2, description: "Nota" }),
  }), { id: 1 });
});

test("catalog follows all pages without relying on the backend origin", async () => {
  globalThis.document = { cookie: "" };
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    return { ok: true, json: async () => urls.length === 1
      ? { results: [{ id: 1 }], next: "http://backend/api/house/?page=2" }
      : { results: [{ id: 2 }], next: null } };
  };
  assert.deepEqual(await catalog("house"), [{ id: 1 }, { id: 2 }]);
  assert.deepEqual(urls, ["/api/house/?page_size=100&page=1", "/api/house/?page_size=100&page=2"]);
});

test("authorization and validation errors are shown in Spanish", async () => {
  globalThis.document = { cookie: "" };
  globalThis.fetch = async url => url === "/api/auth/session/"
    ? { ok: true, json: async () => ({ authenticated: false, user: null, permissions: [] }) }
    : { ok: false, status: 403, json: async () => ({}) };
  await assert.rejects(request("/api/bank-transaction/"), /Inicie sesión/);
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ house: ["Casa inválida"] }) });
  await assert.rejects(request("/api/bank-transaction/"), /Casa inválida/);
});

test("non-JSON failures still provide a useful error", async () => {
  globalThis.document = { cookie: "" };
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => { throw new Error(); } });
  await assert.rejects(request("/api/bank-transaction/"), /No se pudo completar/);
});

test("DELETE sends CSRF without a body and accepts an empty 204 response", async () => {
  globalThis.document = { cookie: "csrftoken=local-token" };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/expense-type/3/");
    assert.equal(options.method, "DELETE");
    assert.equal(options.headers["X-CSRFToken"], "local-token");
    assert.equal(options.body, undefined);
    return { ok: true, status: 204, json: async () => { throw new Error("Empty body"); } };
  };
  assert.equal(await request("/api/expense-type/3/", { method: "DELETE" }), null);
});

test("ZIP upload keeps multipart boundary generation and CSRF; conflict details survive", async () => {
  globalThis.document = { cookie: "csrftoken=upload-token" };
  const body = new FormData();
  body.append("file", new Blob(["zip"]), "bank.zip");
  globalThis.fetch = async (url, options) => {
    assert.equal(options.body, body);
    assert.equal(options.headers["Content-Type"], undefined);
    assert.equal(options.headers["X-CSRFToken"], "upload-token");
    return { ok: false, status: 409, json: async () => ({ detail: "No se insertó ningún movimiento.", errors: [{ row: 3, fields: ["amount"] }], inserted_count: 0 }) };
  };
  await assert.rejects(request("/api/bank-transaction/import/", { method: "POST", body }), error => {
    assert.equal(error.status, 409);
    assert.equal(error.data.inserted_count, 0);
    assert.match(error.message, /Fila 3: importe/);
    return true;
  });
});
