import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { compile } from "@vue/compiler-dom";
import { compileScript, parse } from "@vue/compiler-sfc";
import { createRenderer } from "vue";
import { clearSession, session } from "../auth/session.js";
const { descriptor } = parse(await readFile(new URL("./LoginView.vue", import.meta.url), "utf8"));
let destination;
globalThis.loginTestRouter = { replace: async path => { destination = path; } };
const code = compileScript(descriptor, { id: "login-test" }).content
  .replace('from "vue"', `from "${import.meta.resolve("vue")}"`)
  .replace('import { useRoute, useRouter } from "vue-router";', 'const useRoute = () => ({ query: { next: "/casas" } }); const useRouter = () => globalThis.loginTestRouter;')
  .replace('from "../auth/session.js"', `from "${new URL("../auth/session.js", import.meta.url)}"`)
  .replace('from "../auth/navigation.js"', `from "${new URL("../auth/navigation.js", import.meta.url)}"`);
const { default: LoginView } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
test("login form compiles and handles invalid credentials and successful navigation", async () => {
  const errors = [];
  compile(descriptor.template.content, { onError: error => errors.push(error) });
  assert.deepEqual(errors, []);
  assert.match(descriptor.template.content, /autocomplete="username"/);
  assert.match(descriptor.template.content, /type="password"/);
  assert.match(descriptor.template.content, /Iniciar sesión/);
  const renderer = createRenderer({ createComment: () => ({}), insert() {}, remove() {}, parentNode: () => null, nextSibling: () => null });
  const app = renderer.createApp({ ...LoginView, render: () => null });
  app.mount({});
  const state = app._instance.setupState;
  const originalFetch = globalThis.fetch;
  try {
    let valid = false;
    globalThis.fetch = async url => ({ ok: url.endsWith("session/") || valid, status: 400,
      json: async () => url.endsWith("session/") ? { authenticated: false, csrf_token: "initial" }
        : valid ? { authenticated: true, user: { username: "operator" }, permissions: [], csrf_token: "rotated" }
          : { detail: "Credenciales inválidas." } });
    state.username = "operator";
    state.password = "wrong";
    await state.submit();
    assert.equal(state.error, "Credenciales inválidas.");
    assert.equal(state.password, "");
    valid = true;
    state.password = "password";
    await state.submit();
    assert.equal(destination, "/casas");
    assert.equal(session.authenticated, true);
    assert.equal(state.password, "");
  } finally { app.unmount(); clearSession(); globalThis.fetch = originalFetch; delete globalThis.loginTestRouter; }
});
