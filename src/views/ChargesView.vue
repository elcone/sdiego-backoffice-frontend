<script setup>
import { ref } from "vue";
import { charges, houses, chargeTypes, money, dateLabel } from "../data/mock";
const dialog = ref(false);
const mode = ref("all");
const house = ref(null);
const chargeType = ref(null);
const amount = ref(null);
const headers = [
  { title: "Fecha", key: "date" },
  { title: "Concepto", key: "concept" },
  { title: "Aplicación", key: "scope" },
  { title: "Importe por casa", key: "amount" },
];
function open() {
  mode.value = "all";
  house.value = null;
  chargeType.value = null;
  amount.value = null;
  dialog.value = true;
}
</script>
<template>
  <div class="d-flex flex-wrap align-center justify-space-between ga-4 mb-6">
    <h1 class="text-h4">Cargos</h1>
    <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" @click="open"
      >Nuevo cargo</v-btn
    >
  </div>
  <v-card flat border
    ><v-data-table :headers="headers" :items="charges"
      ><template #item.date="{ item }">{{ dateLabel(item.date) }}</template
      ><template #item.amount="{ item }">{{
        money(item.amount)
      }}</template></v-data-table
    ></v-card
  >
  <v-dialog v-model="dialog" max-width="600"
    ><v-card elevation="0" flat border title="Nuevo cargo"
      ><v-card-text>
        <v-alert type="info" variant="tonal" class="mb-6"
          >Formulario de demostración. La creación de cargos estará disponible
          en una próxima iteración.</v-alert
        >
        <v-select
          v-model="mode"
          label="Modalidad"
          :items="[
            { title: 'Todas las casas', value: 'all' },
            { title: 'Casa individual', value: 'individual' },
          ]"
        />
        <v-select
          v-if="mode === 'individual'"
          v-model="house"
          label="Casa"
          :items="houses"
          item-title="name"
          item-value="id"
        />
        <v-select
          v-model="chargeType"
          label="Tipo de cargo"
          :items="chargeTypes"
          item-title="name"
          item-value="id"
        />
        <v-text-field
          v-model="amount"
          label="Importe por casa"
          type="number"
          prefix="$"
          min="0"
        /> </v-card-text
      ><v-card-actions
        ><v-spacer /><v-btn @click="dialog = false">Cerrar</v-btn
        ><v-btn color="primary" disabled>Crear cargo</v-btn></v-card-actions
      ></v-card
    ></v-dialog
  >
</template>
