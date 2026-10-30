<script setup>
import { ref } from "vue";
import { houses, accountEntries, money, dateLabel } from "../data/mock";
const selected = ref(null);
const dialog = ref(false);
const headers = [
  { title: "Casa", key: "name" },
  { title: "Propietario", key: "owner" },
  { title: "Cargos", key: "charges" },
  { title: "Pagos", key: "payments" },
  { title: "Saldo", key: "balance" },
  { title: "Estado", key: "status" },
  { title: "Acciones", key: "actions", sortable: false },
];
const entryHeaders = [
  { title: "Fecha", key: "date" },
  { title: "Concepto", key: "concept" },
  { title: "Cargo", key: "charge" },
  { title: "Pago", key: "payment" },
];
function open(item) {
  selected.value = item;
  dialog.value = true;
}
</script>
<template>
  <h1 class="text-h4 mb-6">Casas</h1>
  <v-card flat border
    ><v-data-table :headers="headers" :items="houses" :items-per-page="10">
      <template #item.charges="{ item }">{{ money(item.charges) }}</template
      ><template #item.payments="{ item }">{{ money(item.payments) }}</template>
      <template #item.balance="{ item }">{{
        money(item.charges - item.payments)
      }}</template>
      <template #item.status="{ item }"
        ><v-chip v-if="item.payments > item.charges" color="success"
          >Con saldo a favor</v-chip
        ><span v-else>{{
          item.charges === item.payments ? "Al corriente" : "Saldo pendiente"
        }}</span></template
      >
      <template #item.actions="{ item }"
        ><v-btn variant="text" color="primary" @click="open(item)"
          >Estado de cuenta</v-btn
        ></template
      >
    </v-data-table></v-card
  >
  <v-dialog v-model="dialog" max-width="1000"
    ><v-card
      elevation="0"
      flat
      border
      v-if="selected"
      :title="`Estado de cuenta · ${selected.name}`"
    >
      <v-card-text
        ><p class="mb-4">
          {{ selected.owner }} · Saldo:
          {{ money(selected.charges - selected.payments) }}
        </p>
        <v-alert variant="tonal" type="info" class="mb-4"
          >Vista de ejemplo con movimientos ilustrativos; no representa el
          historial completo de la casa.</v-alert
        ><v-data-table
          :headers="entryHeaders"
          :items="accountEntries"
          :items-per-page="10"
          ><template #item.date="{ item }">{{ dateLabel(item.date) }}</template
          ><template #item.charge="{ item }">{{ money(item.charge) }}</template
          ><template #item.payment="{ item }">{{
            money(item.payment)
          }}</template></v-data-table
        ></v-card-text
      >
      <v-card-actions
        ><v-spacer /><v-btn color="primary" @click="dialog = false"
          >Cerrar</v-btn
        ></v-card-actions
      >
    </v-card></v-dialog
  >
</template>
