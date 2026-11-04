import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { compile } from "@vue/compiler-dom";
import * as Vue from "vue";
import { compileScript, parse } from "@vue/compiler-sfc";
import { createRenderer, nextTick } from "vue";

const components = {};
for (const name of ["ChargesView", "CatalogView"]) {
  const { descriptor } = parse(await readFile(new URL(`./${name}.vue`, import.meta.url), "utf8"));
  const source = compileScript(descriptor, { id: name }).content
    .replaceAll('from "vue"', `from "${import.meta.resolve("vue")}"`)
    .replace('import { VDateInput } from "vuetify/labs/VDateInput";', "const VDateInput = {};")
    .replace('from "../data/mock"', `from "${new URL("../data/mock.js", import.meta.url)}"`)
    .replace('from "../api/movements"', `from "${new URL("../api/movements.js", import.meta.url)}"`);
  components[name] = {
    component: (await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)).default,
    template: descriptor.template.content,
  };
}
const renderer = createRenderer({
  createComment: () => ({}), insert() {}, remove() {},
  parentNode: () => null, nextSibling: () => null,
});
const originalFetch = globalThis.fetch;
let app;
afterEach(() => { app?.unmount(); globalThis.fetch = originalFetch; delete globalThis.document; });
const settle = async () => { await nextTick(); await delay(0); };
const houses = [{ id: 7, number: 6101 }, { id: 8, number: 6102 }];
const types = [{ id: 3, name: "Cuota" }];
const rows = [
  { id: 1, house: 7, charge_type: 3, amount: "-12.35", period: "2026-11-01", due_date: "2026-11-15", description: "Ajuste de mantenimiento" },
  { id: 2, house: 8, charge_type: 3, amount: "15.00", period: "2026-10-01", due_date: "2026-10-15" },
];
function mount(name, props = {}, respond) {
  globalThis.document = { cookie: "csrftoken=local-token" };
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    const data = respond ? await respond(url, options) :
      { results: url.startsWith("/api/house/") ? houses : url.startsWith("/api/charge/") ? rows : types };
    return { ok: true, json: async () => data };
  };
  app = renderer.createApp({ ...components[name].component, render: () => null }, props);
  app.mount({});
  return { state: app._instance.setupState, calls };
}
test("charges load real rows and labels, search all approved fields and reset pagination", async () => {
  const { state, calls } = mount("ChargesView");
  await settle();
  assert.deepEqual(state.charges, rows);
  assert.equal(state.houseName(7), 6101);
  assert.equal(state.chargeTypeName(3), "Cuota");
  assert.equal(state.searchOpen, false);
  for (const [query, expected] of [["6101", [rows[0]]], ["cuota", rows], ["2026-10", [rows[1]]]]) {
    state.page = 2;
    state.search = query;
    await settle();
    assert.equal(state.page, 1);
    assert.deepEqual(state.filteredCharges, expected);
  }
  state.searchOpen = true;
  state.searchOpen = false;
  assert.equal(state.search, "2026-10");
  assert.equal(calls.length, 3);
  const template = components.ChargesView.template;
  assert.ok(template.includes('v-show="searchOpen"'));
  assert.ok(template.includes('<v-col cols="12">'));
  assert.ok(template.includes(':items-per-page="50"'));
  assert.deepEqual(state.headers.map(header => header.title), ["Casa", "Tipo de cargo", "Periodo", "Vencimiento", "Importe", "Descripción"]);
});
test("individual charge submits exact signed amount and local calendar dates then refreshes", async () => {
  const { state, calls } = mount("ChargesView");
  await settle();
  state.open();
  assert.equal(state.draft.mode, "all");
  assert.equal(state.draft.amount, null);
  Object.assign(state.draft, {
    mode: "individual", house: 7, chargeType: 3, amount: "-12.35",
    period: new Date(2026, 10, 1), dueDate: new Date(2026, 10, 15), description: "Ajuste",
  });
  await state.save();
  const write = calls.find(call => call.options.method === "POST");
  assert.equal(write.url, "/api/charge/");
  assert.deepEqual(JSON.parse(write.options.body), {
    house: 7, charge_type: 3, amount: "-12.35", period: "2026-11-01",
    due_date: "2026-11-15", description: "Ajuste",
  });
  assert.equal(write.options.headers["X-CSRFToken"], "local-token");
  assert.equal(state.dialog, false);
  assert.equal(calls.length, 7);
  const template = components.ChargesView.template;
  assert.ok(template.includes("Todas las casas"));
  assert.ok(template.includes("Casa individual"));
  assert.ok(template.includes('v-if="draft.mode === \'individual\'"'));
  assert.equal(template.includes("Formulario de demostración"), false);
});
for (const [kind, endpoint] of [["charge", "charge-type"], ["expense", "expense-type"]]) {
  test(`${kind} catalog creates, edits and deletes using only model fields`, async () => {
    const { state, calls } = mount("CatalogView", { kind });
    await settle();
    assert.deepEqual(state.rows, types);
    state.open();
    state.draft.name = "Nuevo";
    await state.save();
    let write = calls.find(call => call.options.method === "POST");
    assert.equal(write.url, `/api/${endpoint}/`);
    assert.deepEqual(JSON.parse(write.options.body), { name: "Nuevo" });
    state.open(types[0]);
    state.draft.name = "Editado";
    await state.save();
    write = calls.find(call => call.options.method === "PATCH");
    assert.equal(write.url, `/api/${endpoint}/3/`);
    assert.deepEqual(JSON.parse(write.options.body), { name: "Editado" });
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      return options.method === "DELETE" ? { ok: true, status: 204 } :
        { ok: true, json: async () => ({ results: [] }) };
    };
    await state.remove(types[0]);
    write = calls.find(call => call.options.method === "DELETE");
    assert.equal(write.url, `/api/${endpoint}/3/`);
    assert.equal(write.options.headers["X-CSRFToken"], "local-token");
    assert.deepEqual(state.rows, []);
  });
}
test("catalog protection and charge validation errors stay visible without closing form", async () => {
  const { state } = mount("CatalogView", { kind: "expense" });
  await settle();
  state.open();
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ name: ["Nombre inválido"] }) });
  await state.save();
  assert.ok(state.saveError.includes("Nombre inválido"));
  assert.equal(state.dialog, true);
  await state.remove(types[0]);
  assert.ok(state.error.includes("Nombre inválido"));
  assert.deepEqual(state.rows, types);
  app.unmount();
  const charges = mount("ChargesView");
  await settle();
  charges.state.open();
  charges.state.draft.mode = "individual";
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ period: ["Periodo inválido"] }) });
  await charges.state.save();
  assert.ok(charges.state.saveError.includes("Periodo inválido"));
  assert.equal(charges.state.dialog, true);
  assert.equal(charges.state.saving, false);
});
test("charge and catalog loading failures support retry", async () => {
  for (const name of ["ChargesView", "CatalogView"]) {
    const { state } = mount(name, { kind: "charge" }, () => { throw new Error("Sin conexión"); });
    await settle();
    assert.equal(state.loading, false);
    assert.equal(state.error, "Sin conexión");
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ results: [] }) });
    await state.load();
    assert.equal(state.error, "");
    assert.deepEqual(name === "ChargesView" ? state.charges : state.rows, []);
    app.unmount();
  }
});

test("bulk mode sends one request without house IDs, reports counts and refreshes", async () => {
  for (const result of [
    { created_count: 1, skipped_count: 1, total_count: 2 },
    { created_count: 0, skipped_count: 2, total_count: 2 },
  ]) {
    const { state, calls } = mount("ChargesView", {}, (url, options) =>
      options.method === "POST" ? result : {
        results: url.startsWith("/api/house/") ? houses : url.startsWith("/api/charge/") ? rows : types,
      });
    await settle();
    state.open();
    assert.equal(state.draft.mode, "all");
    Object.assign(state.draft, {
      house: 7, chargeType: 3, amount: "-12.35",
      period: new Date(2026, 10, 1), dueDate: new Date(2026, 10, 15),
      description: "Ajuste",
    });
    await state.save();
    const writes = calls.filter(call => call.options.method === "POST");
    assert.equal(writes.length, 1);
    assert.equal(writes[0].url, "/api/charge/generate-all/");
    assert.deepEqual(JSON.parse(writes[0].options.body), {
      charge_type: 3, amount: "-12.35", period: "2026-11-01",
      due_date: "2026-11-15", description: "Ajuste",
    });
    assert.equal(state.saved, true);
    assert.equal(state.resultMessage, `Cargos creados: ${result.created_count}. Omitidos: ${result.skipped_count}.`);
    assert.equal(state.dialog, false);
    assert.equal(state.saving, false);
    assert.equal(calls.length, 7);
    assert.deepEqual(state.charges, rows);
    app.unmount();
  }
  const template = components.ChargesView.template;
  assert.ok(template.includes('<v-snackbar v-model="saved" timeout="3000">'));
  assert.equal(template.includes(':disabled="draft.mode !== \'individual\'"'), false);
});
test("bulk errors preserve the form and do not refresh or show success", async () => {
  const { state, calls } = mount("ChargesView");
  await settle();
  state.open();
  const count = calls.length;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: false, status: 400, json: async () => ({ amount: ["Importe inválido"] }) };
  };
  await state.save();
  assert.equal(calls.length, count + 1);
  assert.equal(calls.at(-1).url, "/api/charge/generate-all/");
  assert.ok(state.saveError.includes("Importe inválido"));
  assert.equal(state.dialog, true);
  assert.equal(state.saved, false);
  assert.equal(state.saving, false);
});
test("a second submit while bulk generation is pending sends no additional request", async () => {
  const { state } = mount("ChargesView");
  await settle();
  state.open();
  let finish;
  const writes = [];
  globalThis.fetch = async (url, options) => {
    if (options.method === "POST") {
      writes.push(url);
      return new Promise(resolve => { finish = resolve; });
    }
    return { ok: true, json: async () => ({ results: [] }) };
  };
  const pending = state.save();
  assert.equal(state.saving, true);
  await state.save();
  assert.deepEqual(writes, ["/api/charge/generate-all/"]);
  finish({ ok: true, json: async () => ({ created_count: 2, skipped_count: 0, total_count: 2 }) });
  await pending;
  assert.equal(state.saving, false);
});

test("description search is partial and case insensitive without matching missing values", async () => {
  const { state } = mount("ChargesView");
  await settle();
  state.charges = [...rows, { ...rows[1], id: 3, description: null }];
  for (const query of ["MANTEN", "de mantenimiento", "ajuste"]) {
    state.search = query;
    await settle();
    assert.deepEqual(state.filteredCharges, [rows[0]]);
  }
  for (const query of ["null", "undefined", "sin coincidencias"]) {
    state.search = query;
    await settle();
    assert.deepEqual(state.filteredCharges, []);
  }
});
test("description cells display the real text and leave absent values empty", () => {
  const template = components.ChargesView.template;
  const slot = template.match(/<template #item\.description="{ item }">([\s\S]*?)<\/template>/);
  assert.ok(slot);
  const { code } = compile(slot[1], { mode: "function" });
  const render = new Function("Vue", code)(Vue);
  for (const description of ["Ajuste de mantenimiento", "", null, undefined]) {
    assert.equal(render({ item: { description } }), description || "");
  }
  assert.ok(template.includes('placeholder="Buscar por casa, tipo de cargo, periodo o descripción"'));
});

test("charges collect every API page in order and retain table pagination at 50", async () => {
  const apiRows = Array.from({ length: 125 }, (_, index) => ({ ...rows[0], id: index + 1 }));
  const { state, calls } = mount("ChargesView", {}, url => {
    if (url.startsWith("/api/charge/")) {
      const page = Number(new URL(url, "http://local").searchParams.get("page"));
      return {
        results: apiRows.slice((page - 1) * 100, page * 100),
        next: page === 1 ? "/api/charge/?page=2" : null,
      };
    }
    return { results: url.startsWith("/api/house/") ? houses : types };
  });
  await settle();
  assert.deepEqual(state.charges, apiRows);
  assert.deepEqual(calls.filter(call => call.url.startsWith("/api/charge/")).map(call => call.url), [
    "/api/charge/?page_size=100&page=1",
    "/api/charge/?page_size=100&page=2",
  ]);
  const table = components.ChargesView.template.match(/<v-data-table[\s\S]*?>/)[0];
  assert.ok(table.includes(':items-per-page="50"'));
  assert.ok(table.includes('v-model:page="page"'));
  assert.equal(table.includes("hide-default-footer"), false);
  state.page = 3;
  assert.equal(state.page, 3);
  assert.deepEqual(state.filteredCharges, apiRows);
});

for (const [kind, label] of [["charge", "Nuevo tipo de cargo"], ["expense", "Nuevo tipo de gasto"]]) {
  test(`${kind} catalog FAB is accessible, circular and opens the creation action`, () => {
    const fabTemplate = components.CatalogView.template.match(/<v-fab[\s\S]*?<\/v-fab>/)[0];
    const render = new Function("Vue", compile(fabTemplate, { mode: "function" }).code)(Vue);
    let opened = 0;
    const fab = render({ props: { kind }, open: () => { opened++; } }, []);
    assert.equal(fab.props.icon, "");
    assert.equal(fab.props.size, "56");
    assert.equal(fab.props.color, "primary");
    assert.equal(fab.props.elevation, "4");
    assert.equal(fab.props.location, "bottom end");
    assert.equal(fab.props.extended, undefined);
    assert.equal(fab.props.layout, "");
    fab.props.onClick();
    assert.equal(opened, 1);
    const contents = Array.isArray(fab.children) ? fab.children : fab.children.default();
    assert.equal(contents.find(node => node.type === "v-icon").props.icon, "mdi-plus");
    const tooltip = contents.find(node => node.type === "v-tooltip");
    assert.equal(tooltip.props.text, label);
    assert.equal(tooltip.props.activator, "parent");
    assert.equal(tooltip.props["activator-props"]["aria-label"], label);
    assert.equal(components.CatalogView.template.includes('>Nuevo tipo</v-btn>'), false);
  });
}
