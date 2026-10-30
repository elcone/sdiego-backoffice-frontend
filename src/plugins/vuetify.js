import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";
import { createVuetify } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi";
import { es } from "vuetify/locale";

export default createVuetify({
  locale: { locale: "es", messages: { es } },
  icons: { defaultSet: "mdi", aliases, sets: { mdi } },
});
