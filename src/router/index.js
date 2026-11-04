import { createRouter, createWebHistory } from "vue-router";
import MovementsView from "../views/MovementsView.vue";
import SummaryView from "../views/SummaryView.vue";
import HousesView from "../views/HousesView.vue";
import ChargesView from "../views/ChargesView.vue";
import CatalogView from "../views/CatalogView.vue";

import LoginView from "../views/LoginView.vue";
import { initializeSession, onSessionExpired, session } from "../auth/session.js";
import { safeReturnPath } from "../auth/navigation.js";

export const routes = [
  { path: "/login", component: LoginView },
  { path: "/", redirect: "/resumen" },
  { path: "/movimientos", component: MovementsView },
  { path: "/resumen", component: SummaryView },
  { path: "/casas", component: HousesView },
  { path: "/cargos", component: ChargesView },
  {
    path: "/tipos-de-cargo",
    component: CatalogView,
    props: { kind: "charge" },
  },
  {
    path: "/tipos-de-gasto",
    component: CatalogView,
    props: { kind: "expense" },
  },
  { path: "/:pathMatch(.*)*", redirect: "/resumen" },
];
const router = createRouter({ history: createWebHistory(), routes });
router.beforeEach(async to => {
  await initializeSession();
  if (to.path !== "/login" && !session.authenticated) return { path: "/login", query: { next: safeReturnPath(to.fullPath) } };
  if (to.path === "/login" && session.authenticated) return safeReturnPath(to.query.next);
});
onSessionExpired(() => router.replace({ path: "/login", query: { next: safeReturnPath(router.currentRoute.value.fullPath) } }));
export default router;
