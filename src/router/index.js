import { createRouter, createWebHistory } from "vue-router";
import MovementsView from "../views/MovementsView.vue";
import SummaryView from "../views/SummaryView.vue";
import HousesView from "../views/HousesView.vue";
import ChargesView from "../views/ChargesView.vue";
import CatalogView from "../views/CatalogView.vue";

export const routes = [
  { path: "/", redirect: "/movimientos" },
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
  { path: "/:pathMatch(.*)*", redirect: "/movimientos" },
];
export default createRouter({ history: createWebHistory(), routes });
