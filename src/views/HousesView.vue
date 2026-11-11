<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { request } from "../api/movements";
import ChargesView from "./ChargesView.vue";
import { dateLabel } from "../data/mock";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
function money(value) {
  const text = String(value);
  const [integer, cents = "00"] = text.replace(/^-/, "").split(".");
  const formatted = currency.formatToParts(BigInt(integer)).map(part =>
    part.type === "fraction" ? cents.padEnd(2, "0") : part.value,
  ).join("");
  return `${text.startsWith("-") ? "-" : ""}${formatted}`;
}

const page = ref(1);
const chargeForm = ref(null);
async function chargeSaved() {
  await Promise.all([open(selected.value), load()]);
}
const search = ref("");
const searchOpen = ref(false);
const houses = ref([]);
const balanceFilter = ref(null);
const filteredHouses = computed(() => houses.value.filter(house => {
  if (balanceFilter.value === "credit") return house.balance < 0;
  if (balanceFilter.value === "current") return house.balance == 0;
  if (balanceFilter.value === "pending") return house.balance > 0;
  return true;
}));
const loading = ref(false);
const error = ref("");
const selected = ref(null);
const statement = ref(null);
const statementLoading = ref(false);
const statementError = ref("");
const dialog = ref(false);
const entryPage = ref(1);
let listRequest = 0;
let statementRequest = 0;
const headers = [
  { title: "Casa", key: "number", sortable: false },
  { title: "Cargos", key: "total_charges", align: "end", nowrap: true, sortable: false },
  { title: "Pagos", key: "total_payments", align: "end", nowrap: true, sortable: false },
  { title: "Saldo", key: "balance", align: "end", nowrap: true, sortable: false },
  { title: "Estado", key: "status", sortable: false },
  { title: "Acciones", key: "actions", sortable: false },
];
const entryHeaders = [
  { title: "Fecha", key: "date", sortable: false },
  { title: "Concepto", key: "description", sortable: false },
  { title: "Cargo", key: "charge_amount", align: "end", nowrap: true, sortable: false },
  { title: "Pago", key: "payment_amount", align: "end", nowrap: true, sortable: false },
  { title: "Saldo", key: "running_balance", align: "end", nowrap: true, sortable: false },
];
const entries = computed(() => (statement.value?.results || []).map(row => ({
  ...row, key: `${row.transaction_type}-${row.id}`,
})));
async function load() {
  const current = ++listRequest;
  loading.value = true;
  error.value = "";
  try {
    const params = new URLSearchParams({ page_size: "100" });
    const number = (search.value || "").trim();
    if (number) params.set("number", number);
    const rows = [];
    let next = `/api/house/?${params}`;
    while (next) {
      const data = await request(next);
      if (current !== listRequest) return;
      rows.push(...data.results);
      next = data.next;
    }
    houses.value = rows;
  } catch (err) {
    if (current !== listRequest) return;
    error.value = err.message;
    houses.value = [];
  } finally {
    if (current === listRequest) loading.value = false;
  }
}
async function open(item) {
  const current = ++statementRequest;
  selected.value = item;
  dialog.value = true;
  statement.value = null;
  entryPage.value = 1;
  statementError.value = "";
  statementLoading.value = true;
  try {
    const data = await request(`/api/house/${item.id}/statement/`);
    if (current === statementRequest) statement.value = data;
  } catch (err) {
    if (current === statementRequest) statementError.value = err.message;
  } finally {
    if (current === statementRequest) statementLoading.value = false;
  }
}
watch(balanceFilter, () => { page.value = 1; });
watch(search, () => { page.value = 1; load(); }, { immediate: true });
onBeforeUnmount(() => { listRequest++; statementRequest++; });
</script>

<template>
  <v-card flat border>
    <v-card-text>
      <div class="d-flex flex-wrap align-center justify-space-between ga-2">
        <h1 class="text-h6">Casas</h1>
        <div class="d-flex flex-wrap align-center ga-2">
          <v-btn-toggle v-model="balanceFilter" divided border color="primary" variant="text" aria-label="Saldo de las casas">
            <v-tooltip text="Al corriente">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  value="current"
                  icon
                  width="48"
                  height="100%"
                  :aria-pressed="balanceFilter === 'current'"
                  aria-label="Al corriente"
                >
                  <v-icon
                    size="24"
                    icon="mdi-check-circle-outline"
                    :class="{ 'text-medium-emphasis': balanceFilter !== 'current' }"
                  />
                </v-btn>
              </template>
            </v-tooltip>
            <v-tooltip text="Saldo pendiente">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  value="pending"
                  icon
                  width="48"
                  height="100%"
                  :aria-pressed="balanceFilter === 'pending'"
                  aria-label="Saldo pendiente"
                >
                  <v-icon
                    size="24"
                    icon="mdi-alert-circle-outline"
                    :class="{ 'text-medium-emphasis': balanceFilter !== 'pending' }"
                  />
                </v-btn>
              </template>
            </v-tooltip>
            <v-tooltip text="Saldo a favor">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  value="credit"
                  icon
                  width="48"
                  height="100%"
                  :aria-pressed="balanceFilter === 'credit'"
                  aria-label="Saldo a favor"
                >
                  <v-icon
                    size="24"
                    icon="mdi-crown-circle-outline"
                    :class="{ 'text-medium-emphasis': balanceFilter !== 'credit' }"
                  />
                </v-btn>
              </template>
            </v-tooltip>
          </v-btn-toggle>
          <v-btn-group divided border variant="text">
            <v-tooltip text="Buscar">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon
                  width="48"
                  height="100%"
                  :color="searchOpen ? 'primary' : undefined"
                  :active="searchOpen"
                  aria-label="Buscar"
                  :aria-pressed="searchOpen"
                  :aria-expanded="searchOpen"
                  aria-controls="house-search"
                  @click="searchOpen = !searchOpen"
                >
                  <v-icon
                    size="24"
                    icon="mdi-magnify"
                    :class="{ 'text-medium-emphasis': !searchOpen }"
                  />
                </v-btn>
              </template>
            </v-tooltip>
          </v-btn-group>
        </div>
      </div>
      <v-row v-show="searchOpen" id="house-search" class="mt-2" dense>
        <v-col cols="12">
          <v-text-field
            v-model="search"
            placeholder="Buscar por número de casa"
            aria-label="Buscar por número de casa"
            prepend-inner-icon="mdi-home-search-outline"
            rounded="pill"
            variant="outlined"
            density="compact"
            clearable
            hide-details
          />
        </v-col>
      </v-row>
    </v-card-text>
    <v-divider />
    <v-alert v-if="error" type="error" variant="tonal">{{ error }}
      <v-btn variant="text" @click="load">Reintentar</v-btn>
    </v-alert>
    <v-data-table
      v-model:page="page"
      :items-per-page="50"
      :items-per-page-options="[50]"
      :headers="headers"
      :items="filteredHouses"
      :loading="loading"
      no-data-text="No se encontraron casas"
      loading-text="Cargando casas…"
    >
      <template #item.total_charges="{ item }">{{ money(item.total_charges) }}</template>
      <template #item.total_payments="{ item }">{{ money(item.total_payments) }}</template>
      <template #item.balance="{ item }">{{ money(item.balance) }}</template>
      <template #item.status="{ item }">
        <v-chip
          :color="
            item.balance > 0
              ? 'warning'
              : item.balance < 0
                ? 'success'
                : undefined
          "
          variant="tonal"
          >{{
            item.balance > 0
              ? "Saldo pendiente"
              : item.balance < 0
                ? "Con saldo a favor"
                : "Al corriente"
          }}</v-chip
        >
      </template>
      <template #item.actions="{ item }">
        <v-tooltip text="Estado de cuenta">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon
              variant="text"
              size="small"
              :aria-label="`Estado de cuenta de la casa ${item.number}`"
              @click="open(item)"
            >
              <v-icon
                icon="mdi-file-document-outline"
                class="text-medium-emphasis"
              />
            </v-btn>
          </template>
        </v-tooltip>
      </template>
    </v-data-table>
  </v-card>

  <v-dialog v-model="dialog" max-width="1000">
    <v-card
      v-if="selected"
      elevation="0"
      flat
      border
      :title="`Estado de cuenta ${selected.number}`"
    >
      <v-card-text class="pa-0">
        <v-progress-linear v-if="statementLoading" indeterminate aria-label="Cargando estado de cuenta" />
        <v-alert v-if="statementError" type="error" variant="tonal">{{ statementError }}
          <v-btn variant="text" @click="open(selected)">Reintentar</v-btn>
        </v-alert>
        <v-data-table
          :headers="entryHeaders"
          :items="entries"
          item-value="key"
          v-model:page="entryPage"
          :loading="statementLoading"
          no-data-text="Sin movimientos"
          :items-per-page="10"
          :items-per-page-options="[10]"
        >
          <template #item.date="{ item }">{{ dateLabel(item.date) }}</template>
          <template #item.charge_amount="{ item }"><span v-if="item.transaction_type === 'charge'">{{ money(item.charge_amount) }}</span></template>
          <template #item.payment_amount="{ item }"><span v-if="item.transaction_type === 'payment'">{{ money(item.payment_amount) }}</span></template>
          <template #item.running_balance="{ item }">
            <v-chip :color="item.running_balance > 0 ? 'error' : item.running_balance < 0 ? 'success' : undefined" variant="tonal">{{ money(item.running_balance) }}</v-chip>
          </template>
        </v-data-table>
      </v-card-text>
      <v-card-actions>
        <v-btn color="primary" @click="chargeForm.open()">Nuevo cargo</v-btn>
        <v-spacer />
        <v-btn @click="dialog = false">Cerrar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <ChargesView v-if="dialog && selected" ref="chargeForm" :house="selected" @saved="chargeSaved" />
</template>
