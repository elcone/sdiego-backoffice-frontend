import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { compile } from "@vue/compiler-dom";
import * as Vue from "vue";
import { compileScript, parse } from "@vue/compiler-sfc";
import { createRenderer, nextTick } from "vue";

const { descriptor } = parse(await readFile(new URL("./SummaryView.vue", import.meta.url), "utf8"));
const source = compileScript(descriptor, { id: "summary-test" }).content
  .replaceAll('from "vue"', `from "${import.meta.resolve("vue")}"`)
  .replace('from "../api/movements"', `from "${new URL("../api/movements.js", import.meta.url)}"`)
  .replace('from "../data/mock"', `from "${new URL("../data/mock.js", import.meta.url)}"`);
const { default: SummaryView } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const renderer = createRenderer({
  createComment: () => ({}), insert() {}, remove() {},
  parentNode: () => null, nextSibling: () => null,
});
const originalFetch = globalThis.fetch;
let app;
afterEach(() => { app?.unmount(); globalThis.fetch = originalFetch; delete globalThis.document; });
const settle = async () => { await nextTick(); await delay(0); };
const data = {
  unrecognized_income: "1234.56", income: "1300.25", expense: "-255.16", receivable: "400.00", pending_expenses: "-20.00",
  top_houses: Array.from({ length: 10 }, (_, index) => ({ number: 6101 + index, balance: String(100 - index) + ".00" })),
  top_expenses: [],
};
function mount(respond = url => url === "/api/summary/" ? data : { balance: "1045.09" }) {
  globalThis.document = { cookie: "" };
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => await respond(url) };
  };
  app = renderer.createApp({ ...SummaryView, render: () => null });
  app.mount({});
  return { state: app._instance.setupState, calls };
}
test("loads real aggregates and existing bank balance without paginated lists or recomputing totals", async () => {
  const { state, calls } = mount();
  assert.equal(state.loading, true);
  assert.equal(state.summary, null);
  await settle();
  assert.equal(state.loading, false);
  assert.deepEqual(calls.map(call => call.url), ["/api/summary/", "/api/bank-transaction/summary/"]);
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.deepEqual(state.summary, data);
  assert.equal(state.bankBalance, "1045.09");
  assert.deepEqual(state.summary.top_houses, data.top_houses);
  assert.equal(state.summary.top_houses.length, 10);
  assert.equal(state.money(state.summary.expense), "-$255.16");
  assert.equal(state.money(state.bankBalance), "$1,045.09");
});
test("handles empty real results and formats zero without inventing entries", async () => {
  const empty = { unrecognized_income: "0.00", income: "0.00", expense: "0.00", receivable: "0.00", pending_expenses: "0.00", top_houses: [], top_expenses: [] };
  const { state } = mount(url => url === "/api/summary/" ? empty : { balance: "0.00" });
  await settle();
  assert.deepEqual(state.summary, empty);
  assert.equal(state.bankBalance, "0.00");
  assert.equal(state.money(state.summary.income), "$0.00");
});
test("errors clear stale figures and a successful reload recovers", async () => {
  const { state } = mount();
  await settle();
  globalThis.fetch = async () => { throw new Error("Sin conexión"); };
  await state.load();
  assert.equal(state.loading, false);
  assert.equal(state.error, "Sin conexión");
  assert.equal(state.summary, null);
  assert.equal(state.bankBalance, null);
  globalThis.fetch = async url => ({ ok: true, json: async () => url === "/api/summary/" ? data : { balance: "42.00" } });
  await state.load();
  assert.equal(state.error, "");
  assert.equal(state.bankBalance, "42.00");
});
test("late requests cannot overwrite a more recent summary", async () => {
  const { state } = mount();
  await settle();
  const requests = [];
  globalThis.fetch = url => new Promise(resolve => requests.push({ url, resolve }));
  const first = state.load();
  const second = state.load();
  requests[2].resolve({ ok: true, json: async () => ({ ...data, income: "5.00" }) });
  requests[3].resolve({ ok: true, json: async () => ({ balance: "9.00" }) });
  await second;
  requests[0].resolve({ ok: true, json: async () => data });
  requests[1].resolve({ ok: true, json: async () => ({ balance: "1.00" }) });
  await first;
  assert.equal(state.summary.income, "5.00");
  assert.equal(state.bankBalance, "9.00");
});
test("layout uses responsive columns, equal metric cards, and a large plain bank balance", () => {
  const template = descriptor.template.content;
  for (const removed of ["Situación bancaria", "Cobranza", "Comprobación de gastos", "Movimientos por verificar", "Movimientos por comprobar", "Datos de demostración"]) {
    assert.equal(template.includes(removed), false);
  }
  assert.equal(descriptor.scriptSetup.content.includes("movements,"), false);
  assert.equal(descriptor.scriptSetup.content.includes("isClassified"), false);
  assert.ok(template.includes('class="text-h3 font-weight-semibold text-high-emphasis"'));
  const bank = template.slice(template.indexOf('<div class="py-2 mb-4">'), template.indexOf('<v-divider class="mb-4"'));
  assert.ok(bank.includes('{{ money(bankBalance) }}</p>\n      <p class="text-body-2 text-medium-emphasis mt-1">{{ latestMovementLabel }}</p>'));
  assert.equal(bank.includes("<v-card"), false);
  assert.equal(bank.includes("<v-icon"), false);
  assert.equal((template.match(/<v-col cols="12" md="6">/g) || []).length, 2);
  assert.equal((template.match(/<v-card flat border height="100%">/g) || []).length, 5);
  assert.equal((template.match(/hide-default-footer/g) || []).length, 2);
  assert.equal((template.match(/:items-per-page="-1"/g) || []).length, 2);
  assert.equal(template.includes("<v-btn"), false);
  assert.equal(template.includes("actions"), false);
  for (const label of ["Ingresos del mes", "Saldo por cobrar", "Egresos del mes", "Gastos por comprobar", "No hay casas con adeudo pendiente", "No hay gastos registrados en el mes actual"]) {
    assert.ok(template.includes(label));
  }
});


test("ranking cards use matching semibold headings and dividers", () => {
  const template = descriptor.template.content;
  for (const title of ["10 casas con mayor adeudo", "10 conceptos con mayor gasto"]) {
    assert.ok(template.includes(`<v-card-title class="text-h6 font-weight-semibold">${title}</v-card-title>\n          <v-divider />`));
  }
});
test("empty rankings display centered placeholders instead of table headers", () => {
  const template = descriptor.template.content;
  for (const [key, title, message] of [
    ["top_houses", "10 casas con mayor adeudo", "No hay casas con adeudo pendiente"],
    ["top_expenses", "10 conceptos con mayor gasto", "No hay gastos registrados en el mes actual"],
  ]) {
    const titlePosition = template.indexOf(title);
    const start = template.lastIndexOf("<v-card ", titlePosition);
    const end = template.indexOf("</v-card>", titlePosition) + "</v-card>".length;
    const card = template.slice(start, end);
    const { code } = compile(card, { mode: "function" });
    const render = new Function("Vue", code)(Vue);
    const output = vnode => JSON.stringify(vnode, (key, value) =>
      key === "default" && typeof value === "function" ? value() : value,
    );
    const context = {
      summary: { ...data, [key]: [] }, houseHeaders: [], expenseHeaders: [],
      money: value => value,
    };
    const empty = output(render(context));
    assert.ok(empty.includes(message));
    assert.ok(empty.includes("text-center py-8"));
    assert.ok(empty.includes('"type":"v-icon"'));
    assert.equal(empty.includes('"type":"v-data-table"'), false);
    assert.equal(empty.includes("bg-"), false);
    context.summary[key] = key === "top_houses"
      ? [{ number: 6101, balance: "100.00" }]
      : [{ name: "Mantenimiento", total: "100.00" }];
    const populated = output(render(context));
    assert.ok(populated.includes('"type":"v-data-table"'));
    assert.equal(populated.includes(message), false);

  }
});

test("expense ranking card is always present for a successful empty response", async () => {
  const { state } = mount(url => url === "/api/summary/" ? { ...data, top_expenses: [] } : { balance: "1.00" });
  await settle();
  assert.deepEqual(state.summary.top_expenses, []);
  const template = descriptor.template.content;
  const titlePosition = template.indexOf("10 conceptos con mayor gasto");
  const cardStart = template.lastIndexOf("<v-card ", titlePosition);
  assert.equal(template.slice(cardStart, template.indexOf(">", cardStart) + 1), "<v-card flat border>");
  assert.ok(template.includes("No hay gastos registrados en el mes actual"));
});
test("expense ranking preserves backend order and positive monetary values", async () => {
  const ranking = [
    { name: "Mantenimiento", total: "1000.50" },
    { name: "Sin clasificar", total: "250.25" },
  ];
  const { state } = mount(url => url === "/api/summary/" ? { ...data, top_expenses: ranking } : { balance: "1.00" });
  await settle();
  assert.deepEqual(state.summary.top_expenses, ranking);
  assert.equal(state.money(state.summary.top_expenses[0].total), "$1,000.50");
  assert.equal(state.money(state.summary.top_expenses[1].total), "$250.25");
  assert.equal(state.summary.expense, "-255.16");
});


test("unrecognized income follows receivable in three equal responsive income cards", async () => {
  const { state } = mount();
  await settle();
  assert.equal(state.summary.unrecognized_income, "1234.56");
  const template = descriptor.template.content;
  const row = template.match(/<v-row class="mb-3">([\s\S]*?)<\/v-row>/)[1];
  assert.equal((row.match(/<v-col cols="12" sm="4">/g) || []).length, 3);
  assert.deepEqual([...row.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map(match => match[1]), [
    "Ingresos del mes", "Saldo por cobrar", "Ingresos sin identificar",
  ]);
  const title = row.indexOf("Ingresos sin identificar");
  const card = row.slice(row.lastIndexOf("<v-card ", title), row.indexOf("</v-card>", title) + "</v-card>".length);
  const render = new Function("Vue", compile(card, { mode: "function" }).code)(Vue);
  for (const [amount, expected] of [["1234.56", "$1,234.56"], ["0.00", "$0.00"]]) {
    const vnode = render({ summary: { unrecognized_income: amount }, money: state.money });
    const output = JSON.stringify(vnode, (key, value) =>
      key === "default" && typeof value === "function" ? value() : value,
    );
    assert.ok(output.includes(expected));
    assert.ok(output.includes("Ingresos sin identificar"));
  }
});


test("bank cutoff formats exact date and time in Mexico City and clears after failure", async () => {
  const { state } = mount(url => url === "/api/summary/" ? data : {
    balance: "1.00", latest_transaction_timestamp: "2026-11-01T05:35:00Z",
  });
  await settle();
  assert.equal(state.latestMovementLabel, "Movimientos al 31/10/2026 23:35");
  state.latestTransaction = "2021-07-01T05:15:00Z";
  assert.equal(state.latestMovementLabel, "Movimientos al 01/07/2021 00:15");
  state.latestTransaction = null;
  assert.equal(state.latestMovementLabel, "Sin movimientos");
  state.latestTransaction = "2026-11-01T06:00:00Z";
  assert.equal(state.latestMovementLabel, "Movimientos al 01/11/2026 00:00");
  globalThis.fetch = async () => { throw new Error("Sin conexión"); };
  await state.load();
  assert.equal(state.latestTransaction, null);
  assert.ok(descriptor.template.content.includes("{{ latestMovementLabel }}"));
  assert.equal(descriptor.template.content.includes('>Resumen</h1>'), false);
});
