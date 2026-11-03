<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { checkSession, login } from "../auth/session.js";
import { safeReturnPath } from "../auth/navigation.js";
const route = useRoute();
const router = useRouter();
const username = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);
async function submit() {
  loading.value = true;
  error.value = "";
  try {
    await checkSession();
    await login(username.value, password.value);
    password.value = "";
    await router.replace(safeReturnPath(route.query.next));
  } catch (failure) { error.value = failure.message; }
  finally { password.value = ""; loading.value = false; }
}
</script>
<template>
  <v-container>
    <v-card max-width="420" class="mx-auto mt-12" title="Privada San Diego" subtitle="Iniciar sesión">
      <v-card-text>
        <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
        <v-form @submit.prevent="submit">
          <v-text-field v-model="username" label="Usuario" autocomplete="username" required />
          <v-text-field v-model="password" label="Contraseña" type="password" autocomplete="current-password" required />
          <v-btn type="submit" color="primary" block :loading="loading">Iniciar sesión</v-btn>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>
