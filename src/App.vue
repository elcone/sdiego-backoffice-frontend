<script setup>
import { session } from "./auth/session.js";
import MainLayout from "./layouts/MainLayout.vue";
</script>
<template>
  <v-app>
    <MainLayout v-if="session.authenticated" />
    <v-main v-else class="bg-grey-lighten-4">
      <v-alert v-if="session.error" type="error">{{ session.error }}</v-alert>
      <router-view v-else />
    </v-main>
  </v-app>
</template>
