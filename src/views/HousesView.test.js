import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { compile } from "@vue/compiler-dom";
import * as Vue from "vue";
import { compileScript, parse } from "@vue/compiler-sfc";
import { createRenderer, nextTick } from "vue";

// Compile the real setup with Vue's compiler; no DOM or additional test library.
const filename = new URL("./HousesView.vue", import.meta.url);
const { descriptor } = parse(await readFile(filename, "utf8"));
const source = compileScript(descriptor, { id: "houses-test" }).content
  .replaceAll('from "vue"', `from "${import.meta.resolve("vue")}"`)

  .replace('from "../data/mock"', `from "${new URL("../data/mock.js", import.meta.url)}"`)
  .replace('from "../api/movements"', `from "${new URL("../api/movements.js", import.meta.url)}"`);
const { default: HousesView } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
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
const house = { id: 7, number: 6101, total_charges: "1100.25", total_payments: "1400.25", balance: "-300.00" };
const statement = {
  house: { id: 7, number: 6101 }, total_charges: "1100.25", total_payments: "1400.25", balance: "-300.00",
  results: [
    { id: 1, transaction_type: "charge", date: "2026-02-01", description: "Cuota", charge_amount: "1100.25", payment_amount: "0.00", running_balance: "1100.25" },
    { id: 1, transaction_type: "payment", date: "2026-02-02", description: "Abono", charge_amount: "0.00", payment_amount: "1400.25", running_balance: "-300.00" },
  ],
};
function mount(respond = () => ({ count: 79, results: [house] })) {
  globalThis.document = { cookie: "" };
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => await respond(url) };
  };
  app = renderer.createApp({ ...HousesView, render: () => null });
  app.mount({});
  return { state: app._instance.setupState, calls, params: () => new URL(calls.at(-1).url, "http://local").searchParams };
}
test("list loads every API page in order and preserves exact backend search", async () => {
  const second = { ...house, id: 8, number: 6102, balance: "0.00" };
  const { state, calls, params } = mount(url => url.includes("page=2")
    ? { results: [second], next: null }
    : { results: [house], next: "/api/house/?page=2" });
  await settle();
  assert.deepEqual(state.houses, [house, second]);
  assert.equal(calls[0].options.credentials, "same-origin");
  state.search = " 6101 ";
  await settle();
  assert.equal(new URL(calls.at(-2).url, "http://local").searchParams.get("number"), "6101");
  state.search = null;
  await settle();
  assert.equal(new URL(calls.at(-2).url, "http://local").searchParams.has("number"), false);
});
test("exclusive balance filter uses current backend balances and combines with search", async () => {
  const rows = [house, { ...house, id: 8, balance: "0.00" }, { ...house, id: 9, balance: "0.01" }];
  const { state, params } = mount(url => ({ results: url.includes("number=") ? [house] : rows }));
  await settle();
  assert.equal(state.balanceFilter, null);
  assert.deepEqual(state.filteredHouses, rows);
  for (const [filter, index] of [["credit", 0], ["current", 1], ["pending", 2]]) {
    state.balanceFilter = filter;
    assert.deepEqual(state.filteredHouses, [rows[index]]);
    state.balanceFilter = undefined;
    assert.deepEqual(state.filteredHouses, rows);
  }
  state.balanceFilter = "pending";
  state.search = "6101";
  await settle();
  assert.equal(params().get("number"), "6101");
  assert.deepEqual(state.filteredHouses, []);
  state.balanceFilter = "credit";
  assert.deepEqual(state.filteredHouses, [house]);
});
test("statement loads selected house, keeps signed amounts, unique IDs and resets its page", async () => {
  const { state, calls } = mount(url => url.includes("/statement/") ? statement : { count: 1, results: [house] });
  await settle();
  state.entryPage = 3;
  await state.open(house);
  assert.equal(calls.at(-1).url, "/api/house/7/statement/");
  assert.equal(state.dialog, true);
  assert.equal(state.entryPage, 1);
  assert.equal(state.statement.balance, "-300.00");
  assert.deepEqual(state.entries.map(row => row.key), ["charge-1", "payment-1"]);
  assert.equal(state.entries[1].running_balance, "-300.00");
});
test("list and statement expose loading, empty, errors and retry", async () => {
  let resolve;
  const { state } = mount(() => new Promise(done => { resolve = done; }));
  assert.equal(state.loading, true);
  await settle();
  resolve({ count: 0, results: [] });
  await settle();
  assert.equal(state.loading, false);
  assert.deepEqual(state.houses, []);
  globalThis.fetch = async () => { throw new Error("Sin conexión"); };
  await state.load();
  assert.equal(state.error, "Sin conexión");
  assert.equal(state.loading, false);
  await state.open(house);
  assert.equal(state.statementError, "Sin conexión");
  assert.equal(state.statementLoading, false);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ...statement, results: [] }) });
  await state.open(house);
  assert.equal(state.statementError, "");
  assert.deepEqual(state.entries, []);
});
test("stale list and statement responses cannot replace current selection", async () => {
  const { state } = mount();
  await settle();
  const pending = [];
  globalThis.fetch = url => new Promise(resolve => pending.push({ url, resolve }));
  state.search = "6101";
  await nextTick();
  state.search = "6102";
  await nextTick();
  pending[1].resolve({ ok: true, json: async () => ({ count: 0, results: [] }) });
  await settle();
  pending[0].resolve({ ok: true, json: async () => ({ count: 1, results: [house] }) });
  await settle();
  assert.deepEqual(state.houses, []);
  const first = state.open(house);
  const second = state.open({ id: 8, number: 6102 });
  pending[3].resolve({ ok: true, json: async () => ({ ...statement, house: { id: 8, number: 6102 }, results: [] }) });
  await second;
  pending[2].resolve({ ok: true, json: async () => statement });
  await first;
  assert.equal(state.statement.house.id, 8);
});
test("actual templates preserve negative amounts and account credit status", () => {
  const context = { item: house, money: value => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value) };
  for (const column of ["total_charges", "total_payments", "balance", "status"]) {
    const slot = descriptor.template.content.match(new RegExp(`<template #item\\.${column}="\\{ item \\}">([\\s\\S]*?)</template>`));
    assert.ok(slot);
    const { code } = compile(slot[1], { mode: "function" });
    const vnode = new Function("Vue", code)(Vue)(context);
    const output = JSON.stringify(vnode, (key, value) => typeof value === "symbol" ? String(value) : value);
    assert.ok(output.includes(column === "status" ? "Con saldo a favor" : column === "balance" ? "-" : "$"));
  }
});

test("money formats decimal strings without losing cents or large integer precision", async () => {
  const { state } = mount();
  await settle();
  assert.equal(state.money("-300.00"), "-$300.00");
  assert.equal(state.money("0.00"), "$0.00");
  assert.equal(state.money("9999999999999999999999.99"), "$9,999,999,999,999,999,999,999.99");
  assert.equal(state.money("-0.01"), "-$0.01");
});


test("statement cells show only their transaction amount and signed balance chips", async () => {
  const { state } = mount();
  await settle();
  for (const row of [...statement.results, { running_balance: "0.00" }]) {
    for (const column of ["charge_amount", "payment_amount", "running_balance"]) {
      const slot = descriptor.template.content.match(new RegExp(`<template #item\\.${column}="{ item }">([\\s\\S]*?)</template>`));
      const { code } = compile(slot[1], { mode: "function" });
      const vnode = new Function("Vue", code)(Vue)({ item: row, money: state.money });
      const output = JSON.stringify(vnode);
      if (column === "running_balance") {
        assert.ok(output.includes(state.money(row.running_balance)));
        assert.equal(vnode.props.color, row.running_balance > 0 ? "error" : row.running_balance < 0 ? "success" : undefined);
      } else {
        const kind = column === "charge_amount" ? "charge" : "payment";
        assert.equal(output.includes("$"), row.transaction_type === kind);
      }
    }
  }
});
test("template preserves account action and fixes list and statement presentation", () => {
  const template = descriptor.template.content;
  assert.ok(template.includes('hide-default-footer'));
  assert.ok(template.includes(':items-per-page="-1"'));
  assert.equal(template.includes('mandatory'), false);
  assert.equal(template.includes('multiple'), false);
  assert.equal(template.includes('value="all"'), false);
  assert.ok(template.includes('mdi-file-document-outline'));
  assert.ok(template.includes('Estado de cuenta ${selected.number}'));
  assert.ok(template.includes('<v-card-text class="pa-0">'));
  assert.ok(template.includes(':items-per-page="10"'));
  assert.ok(template.includes(':items-per-page-options="[10]"'));
  assert.equal(template.includes('statement.total_charges'), false);
  assert.equal(template.includes('Estado de cuenta ·'), false);
});


test("search toggle follows Movements visibility and preserves search and financial selection", async () => {
  const { state, calls, params } = mount();
  await settle();
  assert.equal(state.searchOpen, false);
  const button = descriptor.template.content.match(/<v-btn\s[^>]*aria-label="Buscar"[^>]*>[\s\S]*?<\/v-btn>/)[0];
  assert.ok(button.includes('icon="mdi-magnify"'));
  const { code } = compile(button, { mode: "function" });
  const render = new Function("Vue", code)(Vue);
  const context = { searchOpen: state.searchOpen, props: {} };
  let vnode = render(context);
  assert.equal(vnode.props["aria-expanded"], false);
  vnode.props.onClick();
  assert.equal(context.searchOpen, true);
  state.searchOpen = context.searchOpen;
  state.balanceFilter = "credit";
  state.search = "6101";
  await settle();
  const count = calls.length;
  vnode = render(context);
  assert.equal(vnode.props["aria-expanded"], true);
  vnode.props.onClick();
  state.searchOpen = context.searchOpen;
  await settle();
  assert.equal(state.searchOpen, false);
  assert.equal(state.search, "6101");
  assert.equal(state.balanceFilter, "credit");
  assert.equal(params().get("number"), "6101");
  assert.deepEqual(state.filteredHouses, [house]);
  assert.equal(calls.length, count);
  assert.ok(descriptor.template.content.includes('v-show="searchOpen" id="house-search" class="mt-2" dense'));
  const searchRow = descriptor.template.content.match(/<v-row v-show="searchOpen"[\s\S]*?<\/v-row>/)[0];
  assert.ok(searchRow.includes('<v-col cols="12">'));
});

test("financial toggle exposes exactly the three requested icons using optional single selection", () => {
  const group = descriptor.template.content.match(/<v-btn-toggle[\s\S]*?<\/v-btn-toggle>/)[0];
  assert.equal(group.includes("mandatory"), false);
  assert.equal(group.includes("multiple"), false);
  assert.equal((group.match(/<v-btn\s/g) || []).length, 3);
  let previousPosition = -1;
  for (const [value, label, icon] of [
    ["current", "Al corriente", "mdi-check-circle-outline"],
    ["pending", "Saldo pendiente", "mdi-alert-circle-outline"],
    ["credit", "Saldo a favor", "mdi-crown-circle-outline"],
  ]) {
    const position = group.indexOf(`value="${value}"`);
    assert.ok(position > previousPosition);
    previousPosition = position;
    assert.ok(group.includes(`aria-label="${label}"`));
    assert.ok(group.includes(`icon="${icon}"`));
  }
});
