import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { compile } from "@vue/compiler-dom";
import * as Vue from "vue";
import { compileScript, parse } from "@vue/compiler-sfc";
import { createRenderer, nextTick } from "vue";

// Compile the real setup with Vue's compiler; no DOM or additional test library.
const filename = new URL("./MovementsView.vue", import.meta.url);
const { descriptor } = parse(await readFile(filename, "utf8"));
const source = compileScript(descriptor, { id: "movements-toolbar-test" }).content
  .replaceAll('from "vue"', `from "${import.meta.resolve("vue")}"`)
  .replace('import { VDateInput } from "vuetify/labs/VDateInput";', 'const VDateInput = {};')
  .replace('from "../api/movements"', `from "${new URL("../api/movements.js", import.meta.url)}"`);
const { default: MovementsView } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const renderer = createRenderer({
  createComment: () => ({}),
  insert() {},
  remove() {},
  parentNode: () => null,
  nextSibling: () => null,
});
const originalFetch = globalThis.fetch;
let app;
afterEach(() => {
  app?.unmount();
  globalThis.fetch = originalFetch;
  delete globalThis.document;
});
const settle = async () => {
  await nextTick();
  await delay(0);
};
const bank = {
  id: 1, line_type: "CREDIT", bank_receipt: "ABC", house: 2,
  description: "Nota", is_reviewed: false,
  transaction_timestamp: "2026-02-02T12:00:00Z", amount: "100.00", concept: "Cuota",
};
function mount(respond = () => ({ count: 101, results: [bank] }), summary = { can_change: true }) {
  globalThis.document = { cookie: "csrftoken=local-test" };
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    const data = url.includes("/summary/") ? summary : await respond(url, options);
    return { ok: true, json: async () => data };
  };
  app = renderer.createApp({ ...MovementsView, render: () => null });
  app.mount({});
  return {
    state: app._instance.setupState,
    calls,
    params: () => new URL(calls.filter(call => call.url.startsWith("/api/bank-transaction/?")).at(-1).url, "http://local").searchParams,
  };
}

test("independent type and review groups combine and can each return to all", async () => {
  const { state, params } = mount();
  await settle();
  assert.equal(params().get("tab"), "all");
  assert.equal(params().has("is_reviewed"), false);
  for (const type of ["credit", "debit"]) {
    state.tab = type;
    await settle();
    assert.equal(params().get("tab"), type);
    for (const review of ["reviewed", "pending"]) {
      state.review = review;
      await settle();
      assert.equal(params().get("is_reviewed"), String(review === "reviewed"));
      assert.equal(params().get("tab"), type);
      assert.equal(state.activeFilterCount, 2);
      // A non-mandatory Vuetify group emits undefined when deselected.
      state.review = undefined;
      await settle();
      assert.equal(params().has("is_reviewed"), false);
    }
    state.tab = undefined;
    await settle();
    assert.equal(params().get("tab"), "all");
    assert.equal(state.activeFilterCount, 0);
  }
});

test("scoped search and dates survive hiding, pagination, and ordering; clear resets all filters", async () => {
  const { state, params, calls } = mount();
  await settle();
  state.searchOpen = true;
  state.search = " 6102 ";
  state.searchScope = "house";
  state.tab = "credit";
  state.review = "pending";
  state.dateRange = [new Date(2026, 1, 2), new Date(2026, 1, 3)];
  await delay(350);
  await settle();
  assert.equal(state.activeFilterCount, 4);
  const start = new Date(params().get("timestamp_from"));
  const end = new Date(params().get("timestamp_before"));
  assert.equal(start.getHours(), 0);
  assert.equal(start.getDate(), 2);
  assert.equal(end.getHours(), 0);
  assert.equal(end.getDate(), 4);
  const beforeHiding = calls.length;
  state.searchOpen = false;
  await settle();
  assert.equal(calls.length, beforeHiding);
  assert.equal(state.search, " 6102 ");
  assert.equal(state.searchScope, "house");
  assert.equal(state.activeFilterCount, 4);
  state.page = 2;
  await settle();
  assert.equal(params().get("page"), "2");
  assert.equal(params().get("search"), "6102");
  assert.equal(params().get("search_scope"), "house");
  assert.equal(params().get("is_reviewed"), "false");
  state.sortBy = [{ key: "amount", order: "asc" }];
  await settle();
  assert.equal(params().get("page"), "1");
  assert.equal(params().get("ordering"), "amount");
  state.clearFilters();
  await delay(350);
  await settle();
  assert.equal(state.activeFilterCount, 0);
  assert.equal(params().get("tab"), "all");
  assert.equal(params().get("search_scope"), "all");
  for (const key of ["search", "is_reviewed", "timestamp_from", "timestamp_before"]) {
    assert.equal(params().has(key), false);
  }
});

test("load, empty, error and retry states remain functional", async () => {
  let resolveList;
  const { state } = mount(() => new Promise(resolve => { resolveList = resolve; }));
  assert.equal(state.loading, true);
  resolveList({ count: 0, results: [] });
  await settle();
  assert.equal(state.loading, false);
  assert.equal(state.count, 0);
  assert.deepEqual(state.movements, []);
  globalThis.fetch = async () => { throw new Error("Sin conexión"); };
  await state.load();
  assert.equal(state.error, "Sin conexión");
  assert.equal(state.loading, false);
  globalThis.fetch = async url => ({ ok: true, json: async () => url.includes("/summary/")
    ? { can_change: true } : { count: 1, results: [bank] } });
  await state.load();
  assert.equal(state.error, "");
  assert.equal(state.movements[0].id, 1);
});

test("administrative save still uses detail, CSRF and only editable fields, then reloads", async () => {
  const { state, calls } = mount((url) => {
    if (url === "/api/house/?page_size=100&page=1") return { results: [{ id: 2, number: 6102 }], next: null };
    if (url === "/api/expense-type/?page_size=100&page=1") return { results: [], next: null };
    if (url === "/api/bank-transaction/1/") return bank;
    return { count: 1, results: [bank] };
  });
  await settle();
  await state.edit(state.movements[0]);
  assert.equal(state.dialog, true);
  assert.equal(state.draft.assignment, 2);
  state.draft.description = "Actualizada";
  state.draft.is_reviewed = true;
  const beforeSave = calls.length;
  await state.save();
  const patch = calls.find(call => call.options.method === "PATCH");
  assert.deepEqual(JSON.parse(patch.options.body), { house: 2, description: "Actualizada", is_reviewed: true });
  assert.equal(patch.options.headers["X-CSRFToken"], "local-test");
  assert.ok(calls.slice(beforeSave).some(call => call.url.startsWith("/api/bank-transaction/?")));
  assert.equal(state.dialog, false);
  assert.equal(state.saved, true);
});


test("clear availability follows all filter controls, including scope alone, and resets their state", async () => {
  const { state } = mount();
  await settle();
  assert.equal(state.canClearFilters, false);
  for (const [key, value] of [
    ["search", "Cuota"],
    ["searchScope", "house"],
    ["dateRange", [new Date(2026, 1, 2)]],
    ["tab", "credit"],
    ["review", "reviewed"],
  ]) {
    state[key] = value;
    assert.equal(state.canClearFilters, true);
    state.clearFilters();
    assert.equal(state.canClearFilters, false);
    assert.equal(state.search, "");
    assert.equal(state.searchScope, "all");
    assert.deepEqual(state.dateRange, []);
    assert.equal(state.tab, null);
    assert.equal(state.review, null);
  }
  for (const [scope, title] of [["all", "Todo"], ["house", "Casa"], ["concept", "Concepto"]]) {
    state.searchScope = scope;
    state.searchOpen = true;
    assert.equal(state.selectedSearchScope.title, title);
    state.searchOpen = false;
    state.searchOpen = true;
    assert.equal(state.searchScope, scope);
    assert.equal(state.selectedSearchScope.title, title);
  }
});

// Render the actual cell templates to cover presentation without changing data.
function renderCell(column, item) {
  const slot = descriptor.template.content.match(
    new RegExp(`<template #item\\.${column}="\\{ item \\}">([\\s\\S]*?)</template>`),
  );
  assert.ok(slot, `Missing ${column} cell template`);
  const { code } = compile(`<span>${slot[1]}</span>`, { mode: "function" });
  const render = new Function("Vue", code)(Vue);
  return render({ item }).children.trim();
}

test("expense type cells are empty when unassigned and preserve assigned labels", () => {
  for (const type of ["DEBIT", "COMMISSION", "COMMISSION_VAT"]) {
    assert.equal(renderCell("assignment", { type, expense_type: null, expense_type_label: null }), "");
    assert.equal(renderCell("assignment", { type, expense_type: 1, expense_type_label: "Mantenimiento" }), "Mantenimiento");
  }
  assert.equal(renderCell("assignment", { type: "CREDIT", house_label: null }), "Sin asignar");
  assert.equal(renderCell("assignment", { type: "CREDIT", house_label: "6102" }), "6102");
});

test("description cells are empty for null or empty text and preserve supplied text", () => {
  for (const description of [null, "", "Pago de mantenimiento"]) {
    assert.equal(renderCell("description", { description }), description ?? "");
  }
});

test("all search scopes preserve query, review and dates through server ordering", async () => {
  const { state, params } = mount();
  await settle();
  state.search = " Cuota ";
  state.tab = "debit";
  state.review = "reviewed";
  state.dateRange = [new Date(2026, 1, 2)];
  await delay(350);
  await settle();
  for (const scope of ["all", "house", "concept"]) {
    state.searchScope = scope;
    await settle();
    for (const [key, field] of [
      ["date", "transaction_timestamp"], ["type", "line_type"],
      ["amount", "amount"], ["concept", "concept"],
      ["description", "description"], ["is_reviewed", "is_reviewed"],
    ]) {
      for (const order of ["asc", "desc"]) {
        state.sortBy = [{ key, order }];
        await settle();
        assert.equal(params().get("ordering"), `${order === "desc" ? "-" : ""}${field}`);
        assert.equal(params().get("search_scope"), scope);
        assert.equal(params().get("search"), "Cuota");
        assert.equal(params().get("tab"), "debit");
        assert.equal(params().get("is_reviewed"), "true");
        assert.equal(new Date(params().get("timestamp_from")).getDate(), 2);
        assert.equal(new Date(params().get("timestamp_before")).getDate(), 3);
      }
    }
  }
});

test("import uploads ZIP, blocks duplicate submissions and refreshes list and summary", async () => {
  let release;
  const summary = { can_import: true, latest_transaction_timestamp: "2026-10-29T05:41:14Z" };
  const { state, calls } = mount(async url => {
    if (url.endsWith("/import/")) return new Promise(resolve => { release = resolve; });
    return { count: 1, results: [bank] };
  }, summary);
  await settle();
  assert.equal(state.latestMovementLabel, "Movimientos hasta 28/10/2026");
  state.importFile = new Blob(["zip"]);
  const pending = state.importZip();
  await settle();
  assert.equal(state.importing, true);
  await state.importZip();
  assert.equal(calls.filter(call => call.url.endsWith("/import/")).length, 1);
  const upload = calls.find(call => call.url.endsWith("/import/"));
  assert.equal(upload.options.body instanceof FormData, true);
  assert.equal(upload.options.headers["Content-Type"], undefined);
  const before = calls.length;
  summary.latest_transaction_timestamp = "2026-11-02T05:59:59Z";
  release({ found_count: 122, inserted_count: 0, skipped_count: 122 });
  await pending;
  assert.equal(state.importing, false);
  assert.equal(state.importResult.skipped_count, 122);
  assert.equal(state.latestMovementLabel, "Movimientos hasta 01/11/2026");
  assert.equal(state.importFile, null);
  assert.equal(calls.slice(before).some(call => call.url.includes("/summary/")), true);
  assert.equal(calls.slice(before).some(call => call.url.startsWith("/api/bank-transaction/?")), true);
});

test("import failure stays visible and does not refresh or claim success", async () => {
  const { state, calls } = mount();
  await settle();
  state.importFile = new Blob(["zip"]);
  globalThis.fetch = async () => ({ ok: false, status: 409, json: async () => ({ detail: "Conflicto bancario. No se insertó ningún movimiento.", errors: [{ row: 4, fields: ["concept"] }] }) });
  const before = calls.length;
  await state.importZip();
  assert.equal(state.importing, false);
  assert.equal(state.importResult, null);
  assert.match(state.importError, /Conflicto bancario/);
  assert.match(state.importError, /Fila 4: concepto/);
  assert.equal(calls.length, before);
});


test("summary supplies import permission and the latest recorded bank timestamp", async () => {
  const { state } = mount(undefined, { can_change: false, can_import: true, latest_transaction_timestamp: bank.transaction_timestamp });
  await settle();
  assert.equal(state.canImport, true);
  assert.equal(state.canChange, false);
  assert.equal(state.latestTransaction, bank.transaction_timestamp);
  assert.match(descriptor.template.content, /v-if="canImport"/);
  assert.doesNotMatch(descriptor.template.content, /latestMovementLabel/);
});


test("bank subtitle uses the stored maximum in Mexico City and handles no movements", async () => {
  const { state } = mount(undefined, { latest_transaction_timestamp: "2026-01-01T05:59:59Z" });
  await settle();
  assert.equal(state.latestMovementLabel, "Movimientos hasta 31/12/2025");
  state.latestTransaction = "2026-01-01T06:00:00Z";
  assert.equal(state.latestMovementLabel, "Movimientos hasta 01/01/2026");
  state.latestTransaction = "2021-07-01T05:00:00Z";
  assert.equal(state.latestMovementLabel, "Movimientos hasta 01/07/2021");
  state.latestTransaction = null;
  assert.equal(state.latestMovementLabel, "Sin movimientos");
});
