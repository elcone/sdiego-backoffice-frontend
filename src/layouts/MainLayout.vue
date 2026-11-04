<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { logout } from "../auth/session.js";
const router = useRouter();
const logoutError = ref("");
const loggingOut = ref(false);
async function signOut() {
  loggingOut.value = true;
  logoutError.value = "";
  try { await logout(); await router.replace("/login"); }
  catch (error) { logoutError.value = error.message; }
  finally { loggingOut.value = false; }
}
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
        prepend-icon="mdi-tag-arrow-right-outline"
        color="primary"
      />
      <v-list-item
        title="Tipos de gasto"
        to="/tipos-de-gasto"
        prepend-icon="mdi-tag-arrow-left-outline"
        color="primary"
      />
    </v-list>
    <template #append>
      <v-divider />
      <v-list nav>
        <v-list-item
          title="Cerrar sesión"
          prepend-icon="mdi-logout"
          color="primary"
          :disabled="loggingOut"
          @click="signOut"
        >
          <template v-if="loggingOut" #append>
            <v-progress-circular indeterminate size="20" width="2" />
          </template>
        </v-list-item>
      </v-list>
    </template>
  </v-navigation-drawer>
  <v-main class="bg-grey-lighten-4">
    <v-container fluid>
      <v-alert v-if="logoutError" type="error" class="mb-4">{{ logoutError }}</v-alert>
      <router-view />
    </v-container>
  </v-main>
</template>
