import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { session, clearSession } from "../auth/session.js";
let code = await readFile(new URL("./index.js", import.meta.url), "utf8");
code = code.replace(/import (\w+) from "[^"\n]+\.vue";/g, 'const $1 = { render: () => null };')
  .replaceAll("createWebHistory", "createMemoryHistory")
  .replace('from "vue-router"', `from "${import.meta.resolve("vue-router")}"`)
  .replace('from "../auth/session.js"', `from "${new URL("../auth/session.js", import.meta.url)}"`)
  .replace('from "../auth/navigation.js"', `from "${new URL("../auth/navigation.js", import.meta.url)}"`);
test("navigation waits for bootstrap, protects routes, and restores internal return path", async () => {
  const originalFetch = globalThis.fetch;
  try {
    let resolve;
    globalThis.fetch = () => new Promise(done => { resolve = done; });
    const { default: router } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
    const navigation = router.push("/casas");
    await new Promise(done => setTimeout(done, 0));
    assert.equal(router.currentRoute.value.matched.length, 0);
    resolve({ ok: true, json: async () => ({ authenticated: false, user: null, permissions: [] }) });
    await navigation;
    assert.equal(router.currentRoute.value.path, "/login");
    assert.equal(router.currentRoute.value.query.next, "/casas");
    await router.push("/");
    assert.equal(router.currentRoute.value.path, "/login");
    assert.equal(router.currentRoute.value.query.next, "/resumen");
    session.authenticated = true;
    await router.push("/login");
    assert.equal(router.currentRoute.value.path, "/resumen");
    await router.push("/");
    assert.equal(router.currentRoute.value.path, "/resumen");
    await router.push("/unknown");
    assert.equal(router.currentRoute.value.path, "/resumen");
    for (const path of ["/movimientos", "/cargos", "/casas", "/tipos-de-cargo", "/tipos-de-gasto", "/resumen"]) {
      await router.push(path);
      assert.equal(router.currentRoute.value.path, path);
    }
    await router.push("/login?next=/resumen");
    assert.equal(router.currentRoute.value.path, "/resumen");
    await router.push("/login?next=https://evil.test");
    assert.equal(router.currentRoute.value.path, "/resumen");
  } finally { globalThis.fetch = originalFetch; clearSession(); }
});
