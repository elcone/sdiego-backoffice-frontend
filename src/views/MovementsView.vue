<script setup>
import { computed, reactive, ref, watch } from "vue";
import { VDateInput } from "vuetify/labs/VDateInput";
import {
  movements,
  houses,
  expenseTypes,
  isClassified,
  money,
} from "../data/mock";

const tab = ref("all");
const search = ref("");
const dateRange = ref([]);
const filtersOpen = ref(false);
const lineType = ref(null);
const status = ref(null);
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
const statusOptions = [
  { title: "Pendientes", value: "pending" },
  { title: "Clasificados", value: "classified" },
];
const lineOptions = computed(() =>
  Object.entries(lineLabels)
    .filter(
      ([type]) =>
        tab.value === "all" ||
        (tab.value === "credit" ? type === "CREDIT" : type !== "CREDIT"),
    )
    .map(([value, title]) => ({ title, value })),
);
watch(tab, () => {
  lineType.value = null;
});

const dateFormatter = new Intl.DateTimeFormat("es-MX");
const timeFormatter = new Intl.DateTimeFormat("es-MX", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const movementDate = (value) => dateFormatter.format(new Date(value));
const movementTime = (value) => timeFormatter.format(new Date(value));

// Compare local calendar days so the last day of the range is inclusive.
function dateKey(value) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
const rangeBounds = computed(() => {
  const days = (dateRange.value || []).map(dateKey).sort();
  return { start: days[0], end: days[days.length - 1] };
});
const rangedMovements = computed(() =>
  movements.filter((item) => {
    const day = dateKey(new Date(item.date));
    return (
      (!rangeBounds.value.start || day >= rangeBounds.value.start) &&
      (!rangeBounds.value.end || day <= rangeBounds.value.end)
    );
  }),
);
// Balances are recorded demo values, never derived from movement amounts.
const bankBalance = computed(() => {
  const latestByAccount = new Map();
  for (const item of movements) {
    const previous = latestByAccount.get(item.accountId);
    if (!previous || new Date(item.date) > new Date(previous.date)) {
      latestByAccount.set(item.accountId, item);
    }
  }
  return [...latestByAccount.values()].reduce(
    (total, item) => total + item.balance,
    0,
  );
});
const indicators = computed(() => {
  const totals = { income: 0, expense: 0, commission: 0 };
  for (const item of rangedMovements.value) {
    if (item.type === "CREDIT") totals.income += item.amount;
    else if (item.type === "DEBIT") totals.expense += item.amount;
    else if (item.type === "COMMISSION" || item.type === "COMMISSION_VAT")
      totals.commission += item.amount;
  }
  return [
    {
      title: "Saldo bancario",
      amount: bankBalance.value,
      icon: "mdi-bank-outline",
      color: "primary",
    },
    {
      title: "Ingresos",
      amount: totals.income,
      icon: "mdi-bank-transfer-in",
      color: "success",
    },
    {
      title: "Egresos",
      amount: totals.expense,
      icon: "mdi-bank-transfer-out",
      color: "error",
    },
    {
      title: "Comisiones + IVA",
      amount: totals.commission,
      icon: "mdi-bank-minus",
      color: "error",
    },
  ];
});
const activeFilters = computed(() => [
  ...(dateRange.value?.length
    ? [
        `Fechas: ${movementDate(dateRange.value[0])} – ${movementDate(dateRange.value[dateRange.value.length - 1])}`,
      ]
    : []),
  ...(status.value != null
    ? [
        `Estado: ${statusOptions.find((option) => option.value === status.value).title}`,
      ]
    : []),
  ...(lineType.value != null ? [`Línea: ${lineLabels[lineType.value]}`] : []),
]);
const headers = computed(() => [
  { title: "Fecha", key: "date", nowrap: true },
  { title: "Hora", key: "time", sortable: false, nowrap: true },
  { title: "Línea", key: "type", nowrap: true },
  { title: "Importe", key: "amount", align: "end", nowrap: true },
  { title: "Concepto", key: "concept" },
  ...(tab.value === "all"
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
const filtered = computed(() => {
  const query = (search.value || "").trim().toLocaleLowerCase("es");
  return rangedMovements.value.filter(
    (item) =>
      (tab.value === "all" ||
        (tab.value === "credit"
          ? item.type === "CREDIT"
          : item.type !== "CREDIT")) &&
      (!query ||
        `${item.receipt} ${item.concept}`
          .toLocaleLowerCase("es")
          .includes(query)) &&
      (lineType.value == null || item.type === lineType.value) &&
      (status.value == null ||
        (status.value === "classified"
          ? isClassified(item)
          : !isClassified(item))),
  );
});

function edit(item) {
  selected.value = item;
  draft.assignment = item.type === "CREDIT" ? item.houseId : item.expenseTypeId;
  draft.description = item.description;
  draft.is_reviewed = item.is_reviewed;
  dialog.value = true;
}
function save() {
  if (!selected.value) return;
  selected.value[
    selected.value.type === "CREDIT" ? "houseId" : "expenseTypeId"
  ] = draft.assignment;
  selected.value.description = draft.description;
  selected.value.is_reviewed = draft.is_reviewed;
  dialog.value = false;
  saved.value = true;
}
function clearFilters() {
  search.value = "";
  dateRange.value = [];
  status.value = null;
  lineType.value = null;
}
</script>

<template>
  <section aria-label="Indicadores de movimientos" class="mb-4">
    <v-row>
      <v-col
        v-for="indicator in indicators"
        :key="indicator.title"
        cols="12"
        sm="6"
        md="3"
      >
        <v-card flat border>
          <v-card-text class="d-flex align-center justify-space-between ga-2">
            <div>
              <h2 class="text-body-2 text-medium-emphasis mb-1">
                {{ indicator.title }}
              </h2>
              <p class="text-subtitle-1 font-weight-medium">
                {{ money(indicator.amount) }}
              </p>
            </div>
            <v-icon :icon="indicator.icon" :color="indicator.color" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </section>

  <v-card flat border>
    <v-card-text role="group" aria-label="Encabezado de movimientos">
      <div class="d-flex align-center justify-space-between ga-2 mb-4">
        <h1 class="text-h6">Movimientos bancarios</h1>
        <div class="d-flex align-center ga-1 flex-shrink-0">
          <v-btn-toggle
            v-model="tab"
            mandatory
            divided
            border
            color="primary"
            variant="text"
            aria-label="Tipo de movimientos"
          >
            <v-tooltip text="Todos">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  value="all"
                  icon
                  :aria-pressed="tab === 'all'"
                  aria-label="Todos"
                >
                  <v-icon
                    icon="mdi-format-list-bulleted"
                    :class="{ 'text-medium-emphasis': tab !== 'all' }"
                  />
                </v-btn>
              </template>
            </v-tooltip>
            <v-tooltip text="Ingresos">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  value="credit"
                  icon
                  :aria-pressed="tab === 'credit'"
                  aria-label="Ingresos"
                >
                  <v-icon
                    icon="mdi-bank-transfer-in"
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
                  :aria-pressed="tab === 'debit'"
                  aria-label="Egresos"
                >
                  <v-icon
                    icon="mdi-bank-transfer-out"
                    :class="{ 'text-medium-emphasis': tab !== 'debit' }"
                  />
                </v-btn>
              </template>
            </v-tooltip>
          </v-btn-toggle>
          <v-btn-group divided border color="primary" variant="text">
            <v-tooltip text="Filtros">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon
                  :active="filtersOpen"
                  aria-label="Filtros"
                  :aria-pressed="filtersOpen"
                  :aria-expanded="filtersOpen"
                  aria-controls="movement-filters"
                  @click="filtersOpen = !filtersOpen"
                >
                  <v-icon
                    icon="mdi-filter-variant"
                    :class="{ 'text-medium-emphasis': !filtersOpen }"
                  />
                </v-btn>
              </template>
            </v-tooltip>
          </v-btn-group>
        </div>
      </div>
      <v-text-field
        v-model="search"
        placeholder="Buscar por recibo o concepto"
        aria-label="Buscar por recibo o concepto"
        prepend-inner-icon="mdi-magnify"
        rounded="pill"
        variant="outlined"
        density="compact"
        clearable
        hide-details
      />
      <div
        v-if="activeFilters.length"
        class="d-flex flex-wrap align-center ga-2 mt-4"
      >
        <v-chip v-for="filter in activeFilters" :key="filter" variant="tonal">{{
          filter
        }}</v-chip>
      </div>
    </v-card-text>
    <v-divider />
    <v-row no-gutters>
      <v-col
        cols="12"
        :md="filtersOpen ? 8 : 12"
        class="order-last order-md-first"
      >
        <v-data-table
          :headers="headers"
          :items="filtered"
          :items-per-page="50"
          :items-per-page-options="[10, 25, 50, 100]"
          :sort-by="[{ key: 'date', order: 'desc' }]"
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
              }}{{ money(item.amount) }}</span
            >
          </template>
          <template #item.assignment="{ item }">
            {{
              item.type === "CREDIT"
                ? houses.find((h) => h.id === item.houseId)?.name ||
                  "Sin asignar"
                : expenseTypes.find((t) => t.id === item.expenseTypeId)?.name ||
                  "Pendiente"
            }}
          </template>
          <template #item.description="{ item }">{{
            item.description || "Sin descripción"
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
                  :aria-label="`Editar movimiento ${item.receipt}`"
                  @click="edit(item)"
                >
                  <v-icon icon="mdi-pencil" class="text-medium-emphasis" />
                </v-btn>
              </template>
            </v-tooltip>
          </template>
        </v-data-table>
      </v-col>
      <v-col
        v-if="filtersOpen"
        id="movement-filters"
        cols="12"
        md="4"
        class="order-first order-md-last border-s"
      >
        <section aria-label="Filtros de movimientos" class="pa-4">
          <div class="d-flex align-center justify-space-between mb-4">
            <h2 class="text-subtitle-2 text-medium-emphasis">Filtros</h2>
            <v-btn
              icon="mdi-close"
              variant="text"
              density="compact"
              aria-label="Cerrar filtros"
              @click="filtersOpen = false"
            />
          </div>
          <VDateInput
            v-model="dateRange"
            label="Rango de fechas"
            :prepend-icon="null"
            multiple="range"
            :hide-actions="false"
            ok-text="Aplicar"
            cancel-text="Cancelar"
            input-format="dd/mm/yyyy"
            clearable
            :picker-props="{ elevation: 0, border: true }"
          >
            <template #label="{ label }"
              ><span class="text-caption">{{ label }}</span></template
            >
          </VDateInput>
          <v-select
            v-model="status"
            label="Estado"
            :items="statusOptions"
            clearable
          >
            <template #label="{ label }"
              ><span class="text-caption">{{ label }}</span></template
            >
          </v-select>
          <v-select
            v-model="lineType"
            label="Tipo de línea"
            clearable
            :items="lineOptions"
          >
            <template #label="{ label }"
              ><span class="text-caption">{{ label }}</span></template
            >
          </v-select>
          <v-btn
            variant="text"
            block
            prepend-icon="mdi-filter-remove-outline"
            @click="clearFilters"
          >
            Limpiar filtros
          </v-btn>
        </section>
      </v-col>
    </v-row>
  </v-card>

  <v-dialog v-model="dialog" max-width="480">
    <v-card v-if="selected" elevation="0" flat border title="Editar movimiento">
      <v-form @submit.prevent="save">
        <v-card-text>
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
          <v-btn @click="dialog = false">Cancelar</v-btn>
          <v-btn color="primary" type="submit">Guardar</v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
  <v-snackbar v-model="saved" timeout="3000"
    >Movimiento actualizado localmente.</v-snackbar
  >
</template>
