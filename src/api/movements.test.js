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
  globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
  await assert.rejects(request("/api/bank-transaction/"), /Inicie sesión/);
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ house: ["Casa inválida"] }) });
  await assert.rejects(request("/api/bank-transaction/"), /Casa inválida/);
});

test("non-JSON failures still provide a useful error", async () => {
  globalThis.document = { cookie: "" };
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => { throw new Error(); } });
  await assert.rejects(request("/api/bank-transaction/"), /No se pudo completar/);
});
