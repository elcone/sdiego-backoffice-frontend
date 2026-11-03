<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { VDateInput } from "vuetify/labs/VDateInput";
import { money, dateLabel } from "../data/mock";
import { catalog, request } from "../api/movements";

const search = ref("");
const searchOpen = ref(false);
const charges = ref([]);
const houses = ref([]);
const chargeTypes = ref([]);
const loading = ref(false);
const error = ref("");
const saving = ref(false);
const saved = ref(false);
const resultMessage = ref("");
const saveError = ref("");
const page = ref(1);
let listRequest = 0;
async function load() {
  const current = ++listRequest;
  loading.value = true;
  error.value = "";
  try {
    const [chargeRows, houseRows, typeRows] = await Promise.all([
      catalog("charge"), catalog("house"), catalog("charge-type"),
    ]);
    if (current !== listRequest) return;
    charges.value = chargeRows;
    houses.value = houseRows;
    chargeTypes.value = typeRows;
  } catch (failure) {
    if (current === listRequest) { error.value = failure.message; charges.value = []; }
  } finally {
    if (current === listRequest) loading.value = false;
  }
}
function apiDate(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
async function save() {
  if (saving.value) return;
  saving.value = true;
  saveError.value = "";
  try {
    const bulk = draft.mode === "all";
    const result = await request(bulk ? "/api/charge/generate-all/" : "/api/charge/", {
      method: "POST",
      body: JSON.stringify({
        ...(bulk ? {} : { house: draft.house }),
        charge_type: draft.chargeType, amount: draft.amount,
        period: apiDate(draft.period), due_date: apiDate(draft.dueDate),
        description: draft.description,
      }),
    });
    dialog.value = false;
    if (bulk) {
      resultMessage.value = `Cargos creados: ${result.created_count}. Omitidos: ${result.skipped_count}.`;
      saved.value = true;
    }
    await load();
  } catch (failure) {
    saveError.value = failure.message;
  } finally {
    saving.value = false;
  }
}
watch(search, () => { page.value = 1; });
load();
onBeforeUnmount(() => { listRequest++; });
const dialog = ref(false);
const draft = reactive({
  mode: "all",
  house: null,
  chargeType: null,
  amount: null,
  period: null,
  dueDate: null,
  description: "",
});
const headers = [
  { title: "Casa", key: "house" },
  { title: "Tipo de cargo", key: "charge_type" },
  { title: "Periodo", key: "period", nowrap: true },
  { title: "Vencimiento", key: "due_date", nowrap: true },
  { title: "Importe", key: "amount", align: "end", nowrap: true },
  { title: "Descripción", key: "description" },
];
const houseName = (id) =>
  houses.value.find((house) => house.id === id)?.number || "Sin casa";
const chargeTypeName = (id) =>
  chargeTypes.value.find((type) => type.id === id)?.name || "Sin tipo";
const filteredCharges = computed(() => {
  const query = (search.value || "").trim().toLocaleLowerCase("es");
  return charges.value.filter((charge) =>
    `${houseName(charge.house)} ${chargeTypeName(charge.charge_type)} ${charge.period} ${dateLabel(charge.period)} ${charge.description || ""}`
      .toLocaleLowerCase("es")
      .includes(query),
  );
});
function open() {
  Object.assign(draft, {
    mode: "all",
    house: null,
    chargeType: null,
    amount: null,
    period: null,
    dueDate: null,
    description: "",
  });
  saveError.value = "";
  dialog.value = true;
}
</script>

<template>
  <v-card flat border>
    <v-card-text>
      <div class="d-flex align-center justify-space-between ga-3 mb-4">
        <h1 class="text-h6">Cargos</h1>
        <div class="d-flex align-center ga-2">
          <v-btn-group divided border variant="text">
            <v-tooltip text="Buscar">
              <template #activator="{ props }">
                <v-btn v-bind="props" icon width="48" height="100%"
                  :color="searchOpen ? 'primary' : undefined" :active="searchOpen"
                  aria-label="Buscar" :aria-pressed="searchOpen" :aria-expanded="searchOpen"
                  aria-controls="charge-search" @click="searchOpen = !searchOpen">
                  <v-icon size="24" icon="mdi-magnify" :class="{ 'text-medium-emphasis': !searchOpen }" />
                </v-btn>
              </template>
            </v-tooltip>
          </v-btn-group>
          <v-btn
            color="primary"
            variant="flat"
            prepend-icon="mdi-plus"
            @click="open"
            >Nuevo cargo</v-btn
          >
        </div>
      </div>
      <v-row v-show="searchOpen" id="charge-search" class="mt-2" dense>
        <v-col cols="12">
          <v-text-field
            v-model="search"
            placeholder="Buscar por casa, tipo de cargo, periodo o descripción"
            aria-label="Buscar por casa, tipo de cargo, periodo o descripción"
            prepend-inner-icon="mdi-magnify"
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
      :loading="loading"
      :headers="headers"
      :items="filteredCharges"
      :items-per-page="50"
    >
      <template #item.description="{ item }">{{ item.description || "" }}</template>
      <template #item.house="{ item }">{{ houseName(item.house) }}</template>
      <template #item.charge_type="{ item }">{{
        chargeTypeName(item.charge_type)
      }}</template>
      <template #item.period="{ item }">{{ dateLabel(item.period) }}</template>
      <template #item.due_date="{ item }">{{
        dateLabel(item.due_date)
      }}</template>
      <template #item.amount="{ item }"
        >{{ item.amount > 0 ? "+" : "" }}{{ money(item.amount) }}</template
      >
    </v-data-table>
  </v-card>

  <v-dialog v-model="dialog" max-width="600" scrollable>
    <v-card elevation="0" flat border title="Nuevo cargo">
      <v-card-text>
        <v-alert v-if="saveError" type="error" variant="tonal" class="mb-4">{{ saveError }}</v-alert>
        <v-select
          v-model="draft.mode"
          label="Modalidad"
          :items="[
            { title: 'Todas las casas', value: 'all' },
            { title: 'Casa individual', value: 'individual' },
          ]"
        />
        <v-select
          v-if="draft.mode === 'individual'"
          v-model="draft.house"
          label="Casa"
          :items="houses"
          item-title="number"
          item-value="id"
        />
        <v-select
          v-model="draft.chargeType"
          label="Tipo de cargo"
          :items="chargeTypes"
          item-title="name"
          item-value="id"
        />
        <v-text-field
          v-model="draft.amount"
          label="Importe"
          type="number"
          prefix="$"
        />
        <VDateInput
          v-model="draft.period"
          label="Periodo"
          input-format="dd/mm/yyyy"
          :picker-props="{ elevation: 0, border: true }"
        />
        <VDateInput
          v-model="draft.dueDate"
          label="Vencimiento"
          input-format="dd/mm/yyyy"
          :picker-props="{ elevation: 0, border: true }"
        />
        <v-textarea v-model="draft.description" label="Descripción" rows="3" />
      </v-card-text>
      <v-card-actions
        ><v-spacer /><v-btn :disabled="saving" @click="dialog = false">Cerrar</v-btn
        ><v-btn color="primary" :loading="saving" @click="save">Crear cargo</v-btn></v-card-actions
      >
    </v-card>
  </v-dialog>
  <v-snackbar v-model="saved" timeout="3000">{{ resultMessage }}</v-snackbar>
</template>
