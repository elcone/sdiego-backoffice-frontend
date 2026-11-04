<script setup>
import { onBeforeUnmount, reactive, ref, watch } from "vue";
import { catalog, request } from "../api/movements";
const props = defineProps({ kind: { type: String, required: true } });
const rows = ref([]);
const loading = ref(false);
const error = ref("");
const dialog = ref(false);
const selected = ref(null);
const draft = reactive({ name: "" });
const saving = ref(false);
const saveError = ref("");
let listRequest = 0;
const endpoint = () => props.kind === "charge" ? "charge-type" : "expense-type";
const headers = [
  { title: "ID", key: "id" },
  { title: "Nombre", key: "name" },
  { title: "Acciones", key: "actions", sortable: false },
];
async function load() {
  const current = ++listRequest;
  loading.value = true;
  error.value = "";
  try {
    const data = await catalog(endpoint());
    if (current === listRequest) rows.value = data;
  } catch (failure) {
    if (current === listRequest) { error.value = failure.message; rows.value = []; }
  } finally {
    if (current === listRequest) loading.value = false;
  }
}
function open(item = null) {
  selected.value = item;
  draft.name = item?.name || "";
  saveError.value = "";
  dialog.value = true;
}
async function save() {
  if (saving.value) return;
  saving.value = true;
  saveError.value = "";
  try {
    await request(`/api/${endpoint()}/${selected.value ? selected.value.id + "/" : ""}`, {
      method: selected.value ? "PATCH" : "POST",
      body: JSON.stringify({ name: draft.name }),
    });
    dialog.value = false;
    await load();
  } catch (failure) {
    saveError.value = failure.message;
  } finally {
    saving.value = false;
  }
}
async function remove(item) {
  error.value = "";
  try {
    await request(`/api/${endpoint()}/${item.id}/`, { method: "DELETE" });
    await load();
  } catch (failure) {
    error.value = failure.message;
  }
}
watch(() => props.kind, () => { dialog.value = false; load(); }, { immediate: true });
onBeforeUnmount(() => { listRequest++; });
</script>

<template>
  <v-fab
    app
    layout
    icon
    location="bottom end"
    color="primary"
    size="56"
    elevation="4"
    class="treasury-fab"
    @click="open()"
  >
    <v-icon icon="mdi-plus" />
    <v-tooltip
      activator="parent"
      :text="props.kind === 'charge' ? 'Nuevo tipo de cargo' : 'Nuevo tipo de gasto'"
      :activator-props="{ 'aria-label': props.kind === 'charge' ? 'Nuevo tipo de cargo' : 'Nuevo tipo de gasto' }"
    />
  </v-fab>
  <v-card flat border>
    <v-card-text class="d-flex flex-wrap align-center justify-space-between ga-2">
      <h1 class="text-h6">{{ props.kind === "charge" ? "Tipos de cargo" : "Tipos de gasto" }}</h1>
    </v-card-text>
    <v-divider />
    <v-alert v-if="error" type="error" variant="tonal">{{ error }}
      <v-btn variant="text" @click="load">Reintentar</v-btn>
    </v-alert>
    <v-data-table :headers="headers" :items="rows" :items-per-page="10" :loading="loading" no-data-text="No se encontraron tipos">
      <template #item.actions="{ item }">
        <v-tooltip text="Editar">
          <template #activator="{ props: buttonProps }">
            <v-btn v-bind="buttonProps" icon="mdi-pencil-outline" variant="text" size="small" aria-label="Editar" @click="open(item)" />
          </template>
        </v-tooltip>
        <v-tooltip text="Eliminar">
          <template #activator="{ props: buttonProps }">
            <v-btn v-bind="buttonProps" icon="mdi-delete-outline" variant="text" size="small" aria-label="Eliminar" @click="remove(item)" />
          </template>
        </v-tooltip>
      </template>
    </v-data-table>
  </v-card>
  <v-dialog v-model="dialog" max-width="600">
    <v-card flat border :title="selected ? 'Editar tipo' : 'Nuevo tipo'">
      <v-card-text>
        <v-alert v-if="saveError" type="error" variant="tonal" class="mb-4">{{ saveError }}</v-alert>
        <v-text-field v-model="draft.name" label="Nombre" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="saving" @click="dialog = false">Cerrar</v-btn>
        <v-btn color="primary" :loading="saving" @click="save">Guardar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.treasury-fab :deep(.v-fab__container) {
  margin: 24px;
}
</style>
