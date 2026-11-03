# Privada San Diego · Frontend

Interfaz administrativa con Vue 3, Vite, Vuetify 3 y Vue Router. JavaScript con Composition API y `<script setup>`.

## Desarrollo

Requiere Node.js 20.19+ o 22.12+ compatible con Vite 7. Validado con Node.js 24.16.0 y npm 11.13.0.

```bash
npm ci
npm run dev
```

Abrir la dirección indicada por Vite. Para acceder desde Windows/WSL si es necesario: `npm run dev -- --host 0.0.0.0`.

```bash
npm run build
npm run preview
```

En producción, configurar el servidor para servir `index.html` en rutas de la aplicación (history fallback).

## Rutas

- `/` redirige a `/movimientos`.
- `/movimientos`: filtros locales, paginación y edición mediante diálogo.
- `/resumen`: indicadores con datos ficticios.
- `/casas`: tabla y diálogo de estado de cuenta ilustrativo.
- `/cargos`: listado y formulario de demostración; no crea cargos.
- `/tipos-de-cargo` y `/tipos-de-gasto`: catálogos de lectura.

## Organización

- `src/components/`: reservado para componentes compartidos cuando exista una necesidad real.
- `src/layouts/`: layout compartido.
- `src/router/`: rutas y redirecciones.
- `src/views/`: pantallas.
- `src/data/`: ejemplos ficticios y formatos.
- `src/plugins/`: Vuetify con tema predeterminado, Roboto local, Material Design Icons e idioma español.

Los movimientos se mantienen en memoria y se reinician al recargar. La clasificación depende de la casa o tipo de gasto asignado. Cancelar un diálogo descarta sus cambios. No hay autenticación, persistencia ni conexión al backend. Los estados de cuenta son ilustrativos y los datos de casas son independientes de la clasificación bancaria.

Los filtros de movimientos se abren en un panel dentro del card (a la derecha en escritorio y encima de la tabla en móvil). El rango de fechas se selecciona con `VDateInput` (`multiple="range"`), importado explícitamente desde `vuetify/labs/VDateInput`. Se confirma con Aplicar y se conserva al cerrar el panel. Los indicadores de flujos consideran solo ese rango: Ingresos suma CREDIT; Egresos suma DEBIT; Comisiones + IVA suma COMMISSION y COMMISSION_VAT. La búsqueda, el estado, el tipo de línea, la vista y la paginación solo afectan la tabla. Fecha y hora se presentan desde el mismo timestamp ficticio `date`; `is_reviewed` se edita únicamente en el diálogo, de forma independiente de la clasificación. La tabla muestra 50 registros por página inicialmente. Roboto y MDI se sirven localmente desde sus paquetes npm.

El indicador Saldo bancario suma únicamente el balance registrado en el último movimiento (por timestamp) de cada cuenta, independientemente de los filtros. Los movimientos ficticios incluyen `accountId` y `balance` de demostración; no se calcula el balance a partir de los importes. La demo contiene una cuenta y su último balance es $13,414.00. Solo el encabezado y el panel de filtros de Movimientos usan densidad compacta; la tabla y el diálogo conservan su densidad normal.

## Autenticación con Django (iteración 5)

Vue consulta `GET /api/auth/session/` antes de resolver la navegación y recupera
la sesión de Django al recargar. `/login` utiliza `POST /api/auth/login/` y el
layout permite cerrar sesión con `POST /api/auth/logout/`. Las rutas
administrativas requieren sesión. El estado se mantiene en memoria, sin
credenciales en localStorage ni sessionStorage. Las escrituras usan CSRF y no
se repiten automáticamente después de un error. Viewflow conserva `/accounts/`.
El desarrollo mantiene el mismo origen mediante el proxy existente de Vite.

Antes de producción se requiere una `SECRET_KEY` estable y protegida,
`DEBUG=False`, `ALLOWED_HOSTS` explícitos, cookies Secure bajo HTTPS,
configuración correcta del proxy inverso y protección frente a intentos
repetidos de login. Esta iteración no configura ni despliega estas medidas.

Pruebas: `node --test src/api/*.test.js src/auth/*.test.js src/router/*.test.js src/views/*.test.js`.
