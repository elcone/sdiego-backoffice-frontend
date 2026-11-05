<script setup>
import { onBeforeUnmount, ref } from "vue";
import { request } from "../api/movements";
import { money } from "../data/mock";

const summary = ref(null);
const bankBalance = ref(null);
const loading = ref(false);
const error = ref("");
let currentRequest = 0;
const houseHeaders = [
  { title: "Casa", key: "number", sortable: false },
  { title: "Adeudo", key: "balance", align: "end", sortable: false },
];
const expenseHeaders = [
  { title: "Concepto", key: "name", sortable: false },
  { title: "Total", key: "total", align: "end", sortable: false },
];
async function load() {
  const current = ++currentRequest;
  loading.value = true;
  error.value = "";
  try {
    const [data, bank] = await Promise.all([
      request("/api/summary/"),
      request("/api/bank-transaction/summary/"),
    ]);
    if (current !== currentRequest) return;
    summary.value = data;
    bankBalance.value = bank.balance;
  } catch (failure) {
    if (current === currentRequest) {
      error.value = failure.message;
      summary.value = null;
      bankBalance.value = null;
    }
  } finally {
    if (current === currentRequest) loading.value = false;
  }
}
load();
onBeforeUnmount(() => { currentRequest++; });
</script>

<template>
  <h1 class="text-h6 mb-4">Resumen</h1>
  <v-progress-linear v-if="loading" indeterminate aria-label="Cargando resumen" />
  <v-alert v-if="error" type="error" variant="tonal">{{ error }}</v-alert>
  <template v-if="summary">
    <div class="py-2 mb-4">
      <p class="text-subtitle-1">Saldo en bancos</p>
      <p class="text-h3 font-weight-semibold text-high-emphasis">{{ money(bankBalance) }}</p>
    </div>
    <v-divider class="mb-4" />
    <v-row>
      <v-col cols="12" md="6">
        <h2 class="text-h6 mb-3">Ingresos</h2>
        <v-row class="mb-3">
          <v-col cols="12" sm="4">
            <v-card flat border height="100%">
              <v-card-text>
                <h3 class="text-body-2 text-medium-emphasis mb-1">Ingresos del mes</h3>
                <p class="text-h6">{{ money(summary.income) }}</p>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="4">
            <v-card flat border height="100%">
              <v-card-text>
                <h3 class="text-body-2 text-medium-emphasis mb-1">Saldo por cobrar</h3>
                <p class="text-h6">{{ money(summary.receivable) }}</p>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="4">
            <v-card flat border height="100%">
              <v-card-text>
                <h3 class="text-body-2 text-medium-emphasis mb-1">Ingresos sin identificar</h3>
                <p class="text-h6">{{ money(summary.unrecognized_income) }}</p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
        <v-card flat border>
          <v-card-title class="text-h6 font-weight-semibold">10 casas con mayor adeudo</v-card-title>
          <v-divider />
          <v-data-table
            v-if="summary.top_houses.length"
            :headers="houseHeaders"
            :items="summary.top_houses"
            :items-per-page="-1"
            hide-default-footer
          >
            <template #item.balance="{ item }">{{ money(item.balance) }}</template>
          </v-data-table>
          <v-card-text v-else class="text-center py-8">
            <v-icon icon="mdi-home-outline" size="32" class="text-medium-emphasis mb-2" />
            <p>No hay casas con adeudo pendiente</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <h2 class="text-h6 mb-3">Egresos</h2>
        <v-row class="mb-3">
          <v-col cols="12" sm="6">
            <v-card flat border height="100%">
              <v-card-text>
                <h3 class="text-body-2 text-medium-emphasis mb-1">Egresos del mes</h3>
                <p class="text-h6">{{ money(summary.expense) }}</p>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6">
            <v-card flat border height="100%">
              <v-card-text>
                <h3 class="text-body-2 text-medium-emphasis mb-1">Gastos por comprobar</h3>
                <p class="text-h6">{{ money(summary.pending_expenses) }}</p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
        <v-card flat border>
          <v-card-title class="text-h6 font-weight-semibold">10 conceptos con mayor gasto</v-card-title>
          <v-divider />
          <v-data-table
            v-if="summary.top_expenses.length"
            :headers="expenseHeaders"
            :items="summary.top_expenses"
            :items-per-page="-1"
            hide-default-footer
          >
            <template #item.total="{ item }">{{ money(item.total) }}</template>
          </v-data-table>
          <v-card-text v-else class="text-center py-8">
            <v-icon icon="mdi-receipt-text-outline" size="32" class="text-medium-emphasis mb-2" />
            <p>No hay gastos registrados en el mes actual</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </template>
</template>
