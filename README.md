# NeuroGym-front

Aplicación web de **NeuroGym** (PWA Mobile First) para socios, personal administrativo de gimnasios y profesionales independientes (nutricionistas y deportólogos). Se comunica con la API REST de [NeuroGym-back](../NeuroGym-back).

Trabajo Final de Ingeniería en Sistemas Informáticos — Universidad Abierta Interamericana (UAI). Autora: Agustina De Yuliis.

## Tecnologías

- React 19 + TypeScript 5.9
- Vite 7 y `vite-plugin-pwa` (instalable, sin modo sin conexión: RD14)
- React Router 7
- `qrcode.react` (QR de ingreso) y `html5-qrcode` (lectura con la cámara en recepción, RNF8)
- Recharts (gráficos de NeuroGym Intelligence)
- Vitest + Testing Library

## Organización de carpetas

```
src/
├── assets/styles/      # Estilos globales Mobile First (paleta del prototipo del TFI)
├── components/         # Componentes reutilizables (ui, lector QR, comprobante, notificaciones…)
├── contexts/           # Sesión y permisos (AuthContext)
├── hooks/              # useApi / useAccion
├── layouts/            # Estructuras de panel por perfil
├── pages/
│   ├── publico/        # Sitio público, ingreso, acceso administrativo, registro de profesionales
│   ├── socio/          # Inicio y bienvenida, rutina, turnos, QR, cuotas, beneficios, equipamiento, marketplace, perfil
│   ├── admin/          # Panel, recepción QR, socios, cobros, horarios, sedes, equipamiento, retención, Intelligence, precios, usuarios, políticas
│   └── profesional/    # Agenda y perfil profesional
├── routes/             # Rutas y protección por perfil y permiso
├── services/           # Cliente HTTP de la API
├── types/              # Tipos compartidos
├── utils/              # Formato de importes, fechas y estados
├── validations/        # Validaciones de formularios
├── App.tsx
└── main.tsx
tests/                  # Pruebas de validaciones y componentes
```

## Instalación y ejecución

```bash
npm install
cp .env.example .env    # VITE_API_URL=http://localhost:3000/api
npm run dev             # http://localhost:5173
```

El backend debe estar en ejecución (`npm run dev` en NeuroGym-back).

## Comandos

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Verificación de tipos y compilación de producción (genera el service worker) |
| `npm run preview` | Sirve la compilación |
| `npm run typecheck` | Verificación de tipos |
| `npm test` | Pruebas |

## Conexión con el backend

`src/services/api.ts` envía el JWT en `Authorization: Bearer` y traduce los errores de la API (`{ error, mensaje, detalle }`). La interfaz oculta las opciones que el rol no puede usar, pero **la autorización real la valida el backend** en cada solicitud.

Accesos:

- `/ingreso`: socios y profesionales.
- `/admin/ingreso`: personal del gimnasio (acceso separado, RF14).
- `/profesionales/registro`: registro autónomo de profesionales (RF28).

Sin credenciales de prueba de Mercado Pago el pago en línea aparece deshabilitado: no hay simulador ni cobros reales. El pago único vuelve a `/socio/pagos?resultado=...&pago={id}` y el backend confirma la orden consultando la API de Orders.
