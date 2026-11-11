<script setup>
import { computed, reactive, ref, watch, onBeforeUnmount } from "vue";
import { VDateInput } from "vuetify/labs/VDateInput";
import { request, catalog } from "../api/movements";

const movements = ref([]);
const houses = ref([]);
const expenseTypes = ref([]);
const canChange = ref(false);
const canImport = ref(false);
const latestTransaction = ref(null);
const importDialog = ref(false);
const importFile = ref(null);
const importing = ref(false);
const importError = ref("");
const importResult = ref(null);
async function importZip() {
  if (importing.value) return;
  const file = Array.isArray(importFile.value) ? importFile.value[0] : importFile.value;
  if (!file) { importError.value = "Seleccione un archivo ZIP."; return; }
  importing.value = true;
  importError.value = "";
  importResult.value = null;
  try {
    const body = new FormData();
    body.append("file", file);
    importResult.value = await request("/api/bank-transaction/import/", { method: "POST", body });
    importFile.value = null;
    page.value = 1;
    await load();
  } catch (failure) {
    importError.value = failure.message;
  } finally {
    importing.value = false;
  }
}
const loading = ref(false);
const error = ref("");
const editError = ref("");
const saving = ref(false);
const detailLoading = ref(null);
const count = ref(0);
const page = ref(1);
const pageSize = ref(50);
const sortBy = ref([{ key: "date", order: "desc" }]);
const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});
const money = (value) => value == null ? "—" : moneyFormatter.format(value);
const mapMovement = (item) => ({
  ...item,
  date: item.transaction_timestamp,
  type: item.line_type,
  receipt: item.bank_receipt,
});

const tab = ref(null);
const search = ref("");
const dateRange = ref([]);
const searchOpen = ref(false);
const searchScope = ref("all");
const review = ref(null);
const dialog = ref(false);
const selected = ref(null);
const draft = reactive({
  assignment: null,
  description: "",
  is_reviewed: false,
});
const saved = ref(false);

const lineLabels = {
  CREDIT: "Ingreso",
  DEBIT: "Egreso",
  COMMISSION: "Comisión",
  COMMISSION_VAT: "IVA comisión",
};
const searchScopes = [
  { title: "Todo", value: "all", icon: "mdi-format-list-bulleted" },
  { title: "Casa", value: "house", icon: "mdi-home-outline" },
  { title: "Concepto", value: "concept", icon: "mdi-text-box-outline" },
];

const selectedSearchScope = computed(() =>
  searchScopes.find(scope => scope.value === searchScope.value),
);

const bankDateFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City", day: "2-digit", month: "2-digit", year: "numeric",
});
const latestMovementLabel = computed(() => latestTransaction.value
  ? `Movimientos hasta ${bankDateFormatter.format(new Date(latestTransaction.value))}`
  : "Sin movimientos");
const dateFormatter = new Intl.DateTimeFormat("es-MX");
const timeFormatter = new Intl.DateTimeFormat("es-MX", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const movementDate = (value) => dateFormatter.format(new Date(value));
const movementTime = (value) => timeFormatter.format(new Date(value));

const rangeBounds = computed(() => {
  const days = (dateRange.value || [])
    .filter(Boolean)
    .map(value => new Date(value))
    .sort((a, b) => a - b);
  if (!days.length) return {};
  const start = new Date(days[0]);
  start.setHours(0, 0, 0, 0);
  const end = new Date(days[days.length - 1]);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  return { timestamp_from: start.toISOString(), timestamp_before: end.toISOString() };
});
const activeFilterCount = computed(() =>
  Number(tab.value != null) +
  Number(review.value != null) +
  Number(Boolean(search.value?.trim())) +
  Number(Boolean(dateRange.value?.length)),
);
const canClearFilters = computed(() =>
  activeFilterCount.value > 0 || searchScope.value !== "all",
);

const headers = computed(() => [
  { title: "Fecha", key: "date", nowrap: true },
  { title: "Hora", key: "time", sortable: false, nowrap: true },
  { title: "Línea", key: "type", nowrap: true },
  { title: "Importe", key: "amount", align: "end", nowrap: true },
  { title: "Concepto", key: "concept" },
  ...(tab.value == null
    ? []
    : [
        {
          title: tab.value === "credit" ? "Casa" : "Tipo de gasto",
          key: "assignment",
          sortable: false,
        },
        { title: "Descripción", key: "description" },
        { title: "Revisado", key: "is_reviewed" },
      ]),
  { title: "Acciones", key: "actions", sortable: false },
]);
let listRequest = 0;
async function load() {
  const current = ++listRequest;
  loading.value = true;
  error.value = "";
  const fields = {
    date: "transaction_timestamp",
    type: "line_type",
    amount: "amount",
    concept: "concept",
    description: "description",
    is_reviewed: "is_reviewed",
  };
  const params = new URLSearchParams({
    page: page.value,
    page_size: pageSize.value,
    tab: tab.value || "all",
    search_scope: searchScope.value,
  });
  if (search.value?.trim()) params.set("search", search.value.trim());
  if (review.value != null) {
    params.set("is_reviewed", String(review.value === "reviewed"));
  }
  for (const [key, value] of Object.entries(rangeBounds.value)) {
    params.set(key, value);
  }
  const ordering = sortBy.value
    .map(({key, order}) => `${order === "desc" ? "-" : ""}${fields[key]}`)
    .join(",");
  params.set("ordering", ordering || "-transaction_timestamp");
  try {
    const [data, summary] = await Promise.all([
      request(`/api/bank-transaction/?${params}`),
      request(`/api/bank-transaction/summary/?${new URLSearchParams(rangeBounds.value)}`),
    ]);
    if (current !== listRequest) return;
    movements.value = data.results.map(mapMovement);
    count.value = data.count;
    canChange.value = summary.can_change;
    canImport.value = summary.can_import;
    latestTransaction.value = summary.latest_transaction_timestamp;
  } catch (failure) {
    if (current !== listRequest) return;
    error.value = failure.message;
    movements.value = [];
    count.value = 0;
    canChange.value = false;
    canImport.value = false;
  } finally {
    if (current === listRequest) loading.value = false;
  }
}
let searchTimer;
onBeforeUnmount(() => {
  clearTimeout(searchTimer);
  listRequest++;
});
function reloadFirstPage() {
  if (page.value !== 1) page.value = 1;
  else load();
}
watch(
  [tab, review, searchScope, rangeBounds, pageSize, sortBy],
  reloadFirstPage,
  { deep: true },
);
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(reloadFirstPage, 300);
});
watch(page, load);
load();

async function edit(item) {
  if (detailLoading.value != null) return;
  detailLoading.value = item.id;
  editError.value = "";
  error.value = "";
  selected.value = null;
  try {
    const [detail, houseList, expenseList] = await Promise.all([
      request(`/api/bank-transaction/${item.id}/`), catalog("house"), catalog("expense-type"),
    ]);
    selected.value = mapMovement(detail);
    houses.value = houseList.map(house => ({ ...house, name: String(house.number) }));
    expenseTypes.value = expenseList;
    draft.assignment = detail.line_type === "CREDIT" ? detail.house : detail.expense_type;
    draft.description = detail.description;
    draft.is_reviewed = detail.is_reviewed;
    dialog.value = true;
  } catch (failure) {
    error.value = failure.message;
  } finally {
    detailLoading.value = null;
  }
}
async function save() {
  if (!selected.value || saving.value) return;
  saving.value = true;
  editError.value = "";
  try {
    await request(`/api/bank-transaction/${selected.value.id}/`, {
      method: "PATCH",
      body: JSON.stringify({
        [selected.value.type === "CREDIT" ? "house" : "expense_type"]: draft.assignment,
        description: draft.description,
        is_reviewed: draft.is_reviewed,
      }),
    });
    dialog.value = false;
    saved.value = true;
    await load();
  } catch (failure) {
    editError.value = failure.message;
  } finally {
    saving.value = false;
  }
}
function clearFilters() {
  search.value = "";
  dateRange.value = [];
  tab.value = null;
  review.value = null;
  searchScope.value = "all";
}
</script>

<template>
  <v-fab
    v-if="canImport"
    app
    layout
    icon
    location="bottom end"
    color="primary"
    size="56"
    elevation="4"
    class="treasury-fab"
    @click="importDialog = true"
  >
    <v-icon icon="mdi-upload" />
    <v-tooltip activator="parent" text="Importar ZIP" :activator-props="{ 'aria-label': 'Importar ZIP' }" />
  </v-fab>
  <v-dialog v-model="importDialog" max-width="560" :persistent="importing">
    <v-card title="Importar ZIP bancario">
      <v-card-text>
        <v-file-input v-model="importFile" label="Archivo ZIP de BanBajío" accept=".zip,application/zip" :disabled="importing" show-size />
        <v-progress-linear v-if="importing" indeterminate aria-label="Procesando importación" />
        <v-alert v-if="importError" type="error" class="mt-3">{{ importError }}</v-alert>
        <v-alert v-if="importResult" type="success" class="mt-3">Encontrados: {{ importResult.found_count }}. Insertados: {{ importResult.inserted_count }}. Omitidos: {{ importResult.skipped_count }}.</v-alert>
      </v-card-text>
      <v-card-actions>
        <v-btn :disabled="importing" @click="importDialog = false">Cerrar</v-btn>
        <v-btn color="primary" :loading="importing" :disabled="!importFile || importing" @click="importZip">Importar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <v-card flat border>
    <v-card-text role="group" aria-label="Encabezado de movimientos">
      <div class="d-flex flex-wrap align-center justify-space-between ga-2">
        <div>
          <h1 class="text-h6">Movimientos bancarios</h1>
        </div>
        <div class="d-flex flex-wrap align-center ga-2">
          <v-btn-toggle
            v-model="tab"
            divided
            border
            color="primary"
            variant="text"
            aria-label="Tipo de movimientos"
          >
            <v-tooltip text="Ingresos">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  value="credit"
                  icon
                  width="48"
                  height="100%"
                  :aria-pressed="tab === 'credit'"
                  aria-label="Ingresos"
                >
                  <v-icon
                    size="24"
                    icon="mdi-bank-plus"
                    :class="{ 'text-medium-emphasis': tab !== 'credit' }"
                  />
                </v-btn>
              </template>
            </v-tooltip>
            <v-tooltip text="Egresos">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  value="debit"
                  icon
                  width="48"
                  height="100%"
                  :aria-pressed="tab === 'debit'"
                  aria-label="Egresos"
                >
                  <v-icon
                    size="24"
                    icon="mdi-bank-minus"
                    :class="{ 'text-medium-emphasis': tab !== 'debit' }"
                  />
                </v-btn>
              </template>
            </v-tooltip>
          </v-btn-toggle>
          <v-btn-toggle
            v-model="review"
            divided
            border
            color="primary"
            variant="text"
            aria-label="Revisión de movimientos"
          >
            <v-tooltip text="Revisados">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  value="reviewed"
                  icon
                  width="48"
                  height="100%"
                  :aria-pressed="review === 'reviewed'"
                  aria-label="Revisados"
                >
                  <v-icon
                    size="24"
                    icon="mdi-check-circle-outline"
                    :class="{ 'text-medium-emphasis': review !== 'reviewed' }"
                  />
                </v-btn>
              </template>
            </v-tooltip>
            <v-tooltip text="Pendientes">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  value="pending"
                  icon
                  width="48"
                  height="100%"
                  :aria-pressed="review === 'pending'"
                  aria-label="Pendientes"
                >
                  <v-icon
                    size="24"
                    icon="mdi-clock-outline"
                    :class="{ 'text-medium-emphasis': review !== 'pending' }"
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
                  aria-controls="movement-search"
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
            <v-tooltip text="Limpiar filtros">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon
                  width="48"
                  height="100%"
                  :active="false"
                  :disabled="!canClearFilters"
                  aria-label="Limpiar filtros"
                  @click="clearFilters"
                >
                  <v-icon
                    icon="mdi-filter-remove-outline"
                    size="24"
                    class="text-medium-emphasis"
                  />
                </v-btn>
              </template>
            </v-tooltip>
          </v-btn-group>
        </div>
      </div>
      <v-row v-show="searchOpen" id="movement-search" class="mt-2" dense>
        <v-col cols="12" md="9">
          <v-text-field
            v-model="search"
            placeholder="Buscar"
            aria-label="Búsqueda de movimientos"
            prepend-inner-icon="mdi-magnify"
            rounded="pill"
            variant="outlined"
            density="compact"
            clearable
            hide-details
          >
            <template #append-inner>
              <v-menu>
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    :icon="selectedSearchScope.icon"
                    :aria-label="`Alcance: ${selectedSearchScope.title}`"
                    :title="`Buscar en: ${selectedSearchScope.title}`"
                    size="small"
                    width="32"
                    height="32"
                    variant="text"
                  />
                </template>
                <v-list aria-label="Alcance de búsqueda" density="compact">
                  <v-list-item
                    v-for="scope in searchScopes"
                    :key="scope.value"
                    :title="scope.title"
                    :prepend-icon="scope.icon"
                    :active="searchScope === scope.value"
                    :append-icon="searchScope === scope.value ? 'mdi-check' : undefined"
                    color="primary"
                    @click="searchScope = scope.value"
                  />
                </v-list>
              </v-menu>
            </template>
          </v-text-field>
        </v-col>
        <v-col cols="12" md="3">
          <VDateInput
            v-model="dateRange"
            placeholder="Buscar por fecha"
            aria-label="Buscar por fecha"
            :prepend-icon="null"
            prepend-inner-icon="mdi-calendar-range"
            multiple="range"
            :hide-actions="false"
            ok-text="Aplicar"
            cancel-text="Cancelar"
            input-format="dd/mm/yyyy"
            rounded="pill"
            variant="outlined"
            density="compact"
            hide-details
            clearable
            :picker-props="{ elevation: 0, border: true }"
          />
        </v-col>
      </v-row>
    </v-card-text>
    <v-divider />
    <v-row no-gutters>
      <v-col cols="12">
        <v-alert v-if="error" type="error" class="ma-4">
          {{ error }}
          <v-btn variant="text" @click="load">Reintentar</v-btn>
          <v-btn href="/accounts/login/?next=/movimientos" variant="text">
            Iniciar sesión
          </v-btn>
        </v-alert>
        <v-data-table-server
          :headers="headers"
          :items="movements"
          :items-length="count"
          :loading="loading"
          loading-text="Cargando movimientos…"
          no-data-text="No hay movimientos para los filtros seleccionados."
          v-model:page="page"
          v-model:items-per-page="pageSize"
          :items-per-page-options="[10, 25, 50, 100]"
          v-model:sort-by="sortBy"
        >
          <template #item.date="{ item }">{{
            movementDate(item.date)
          }}</template>
          <template #item.time="{ item }">{{
            movementTime(item.date)
          }}</template>
          <template #item.type="{ item }">
            <v-chip
              :color="item.type === 'CREDIT' ? 'success' : 'error'"
              variant="tonal"
              >{{ lineLabels[item.type] }}</v-chip
            >
          </template>
          <template #item.amount="{ item }">
            <span :class="item.type === 'CREDIT' ? 'text-success' : ''"
              >{{ item.type === "CREDIT" ? "+" : "−"
              }}{{ money(Math.abs(Number(item.amount))) }}</span
            >
          </template>
          <template #item.assignment="{ item }">
            {{
              item.type === "CREDIT"
                ? item.house_label ||
                  "Sin asignar"
                : item.expense_type_label ||
                  ""
            }}
          </template>
          <template #item.description="{ item }">{{
            item.description || ""
          }}</template>
          <template #item.is_reviewed="{ item }">
            <v-chip
              :color="item.is_reviewed ? 'success' : 'warning'"
              :prepend-icon="
                item.is_reviewed
                  ? 'mdi-check-circle-outline'
                  : 'mdi-clock-outline'
              "
              variant="tonal"
              >{{ item.is_reviewed ? "Revisado" : "Pendiente" }}</v-chip
            >
          </template>
          <template #item.actions="{ item }">
            <v-tooltip text="Editar">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon
                  variant="text"
                  size="small"
                  :disabled="!canChange || detailLoading != null"
                  :loading="detailLoading === item.id"
                  :aria-label="`Editar movimiento ${item.receipt}`"
                  @click="edit(item)"
                >
                  <v-icon icon="mdi-pencil" class="text-medium-emphasis" />
                </v-btn>
              </template>
            </v-tooltip>
          </template>
        </v-data-table-server>
      </v-col>
    </v-row>
  </v-card>

  <v-dialog v-model="dialog" :persistent="saving" max-width="480">
    <v-card v-if="selected" elevation="0" flat border title="Editar movimiento">
      <v-form @submit.prevent="save">
        <v-card-text>
          <v-alert v-if="editError" type="error" class="mb-4">{{ editError }}</v-alert>
          <div class="mb-4">
            <p>
              {{ movementDate(selected.date) }} ·
              {{ movementTime(selected.date) }} · {{ selected.receipt }}
            </p>
            <p>{{ selected.concept }}</p>
            <p class="text-subtitle-1">{{ money(selected.amount) }}</p>
            <p class="text-caption">Información bancaria de solo lectura</p>
          </div>
          <v-select
            v-model="draft.assignment"
            :label="selected.type === 'CREDIT' ? 'Casa' : 'Tipo de gasto'"
            :items="selected.type === 'CREDIT' ? houses : expenseTypes"
            item-title="name"
            item-value="id"
            clearable
          />
          <v-textarea
            v-model="draft.description"
            label="Descripción"
            rows="3"
          />
          <v-checkbox
            v-model="draft.is_reviewed"
            label="Revisado"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn :disabled="saving" @click="dialog = false">Cancelar</v-btn>
          <v-btn color="primary" type="submit" :loading="saving">Guardar</v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
  <v-snackbar v-model="saved" timeout="3000"
    >Movimiento actualizado.</v-snackbar
  >
</template>

<style scoped>
.treasury-fab :deep(.v-fab__container) {
  margin: 24px;
}
</style>
