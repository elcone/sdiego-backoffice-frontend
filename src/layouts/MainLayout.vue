<script setup>
import { ref } from "vue";
const drawer = ref(null);
const links = [
  { title: "Resumen", to: "/resumen", icon: "mdi-view-dashboard-outline" },
  {
    title: "Movimientos bancarios",
    to: "/movimientos",
    icon: "mdi-bank-transfer",
  },
  { title: "Casas", to: "/casas", icon: "mdi-home-outline" },
  { title: "Cargos", to: "/cargos", icon: "mdi-receipt-text-outline" },
];
</script>
<template>
  <v-app-bar color="primary" flat>
    <template #prepend>
      <v-app-bar-nav-icon
        aria-label="Expandir o contraer navegación"
        @click="drawer = !drawer"
      />
    </template>
    <v-app-bar-title>Privada San Diego</v-app-bar-title>
  </v-app-bar>
  <v-navigation-drawer v-model="drawer" color="white">
    <v-list nav>
      <v-list-item
        v-for="link in links"
        :key="link.to"
        :title="link.title"
        :to="link.to"
        :prepend-icon="link.icon"
        color="primary"
      />
    </v-list>
    <v-divider />
    <v-list nav>
      <v-list-subheader>Configuración</v-list-subheader>
      <v-list-item
        title="Tipos de cargo"
        to="/tipos-de-cargo"
        prepend-icon="mdi-format-list-bulleted"
        color="primary"
      />
      <v-list-item
        title="Tipos de gasto"
        to="/tipos-de-gasto"
        prepend-icon="mdi-tag-outline"
        color="primary"
      />
    </v-list>
  </v-navigation-drawer>
  <v-main class="bg-grey-lighten-4">
    <v-container fluid><router-view /></v-container>
  </v-main>
</template>
