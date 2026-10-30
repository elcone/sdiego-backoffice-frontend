<script setup>
import { computed } from "vue";
import { chargeTypes, expenseTypes } from "../data/mock";
const props = defineProps({ kind: { type: String, required: true } });
const headers = computed(() => [
  { title: "ID", key: "id" },
  { title: "Nombre", key: "name" },
  ...(props.kind === "charge"
    ? [{ title: "Descripción", key: "description" }]
    : []),
]);
</script>
<template>
  <h1 class="text-h4 mb-6">
    {{ kind === "charge" ? "Tipos de cargo" : "Tipos de gasto" }}
  </h1>
  <v-card flat border
    ><v-data-table
      :headers="headers"
      :items="kind === 'charge' ? chargeTypes : expenseTypes"
  /></v-card>
</template>
