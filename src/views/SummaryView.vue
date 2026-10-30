<script setup>
import { computed } from "vue";
import { movements, houses, isClassified, money } from "../data/mock";
const income = computed(() =>
  movements
    .filter((m) => m.type === "CREDIT")
    .reduce((sum, m) => sum + m.amount, 0),
);
const expenses = computed(() =>
  movements
    .filter((m) => m.type !== "CREDIT")
    .reduce((sum, m) => sum + m.amount, 0),
);
const receivable = houses.reduce(
  (sum, h) => sum + Math.max(0, h.charges - h.payments),
  0,
);
</script>
<template>
  <h1 class="text-h4 mb-6">Resumen</h1>
  <v-card flat border color="primary" class="mb-6" title="Saldo en bancos"
    ><v-card-text class="text-h3">{{
      money(income - expenses)
    }}</v-card-text></v-card
  >
  <v-row>
    <v-col cols="12" sm="6" md="3"
      ><v-card flat border title="Ingresos"
        ><v-card-text class="text-h5">{{ money(income) }}</v-card-text></v-card
      ></v-col
    >
    <v-col cols="12" sm="6" md="3"
      ><v-card flat border title="Egresos"
        ><v-card-text class="text-h5">{{
          money(expenses)
        }}</v-card-text></v-card
      ></v-col
    >
    <v-col cols="12" sm="6" md="3"
      ><v-card flat border title="Saldo por cobrar"
        ><v-card-text class="text-h5">{{
          money(receivable)
        }}</v-card-text></v-card
      ></v-col
    >
    <v-col cols="12" sm="6" md="3"
      ><v-card flat border title="Movimientos pendientes"
        ><v-card-text class="text-h5">{{
          movements.filter((m) => !isClassified(m)).length
        }}</v-card-text></v-card
      ></v-col
    >
  </v-row>
  <p class="text-body-2 mt-6">
    Datos de demostración. Los indicadores bancarios consideran todos los
    movimientos locales.
  </p>
</template>
