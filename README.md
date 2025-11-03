# Pollos Tello’s API

Backend NestJS + Prisma que alimenta al frontend (catálogo, checkout, fidelización y panel admin). Este documento captura el estado final del servicio antes de migrar a nuevos proyectos.

---

## Stack y Arquitectura

- **NestJS 11** (TypeScript) con estructura modular (`src/app.module.ts`).  
- **Prisma ORM** sobre PostgreSQL (Supabase) con migraciones versionadas en `prisma/migrations`.  
- **Firebase Admin** (ID tokens) para autenticación de usuarios finales.  
- **API Key** adicional para integraciones server-to-server (`x-api-key`).  
- **Jest** para tests (`test/`).  
- Despliegue actual en Render (Free) usando pooler IPv4 de Supabase.

---

## Variables de Entorno

Crear `.env` con los parámetros indispensables:

```env
# Conexión base de datos (usar pooler IPv4 para Render Free)
DATABASE_URL="postgresql://usuario:password@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?pgbouncer=true&sslmode=require"
DIRECT_URL="postgresql://usuario:password@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?pgbouncer=true&sslmode=require"

# Claves de acceso
API_KEY="0108_Sabi@,Varita1111"                 # Consumida por el frontend
API_KEYS="otra_clave_opcional_separada_por_comas"

# Firebase Admin (usar JSON completo escapado o ruta a archivo)
FIREBASE_SERVICE_ACCOUNT_JSON='{ "project_id": "...", "client_email": "...", "private_key": "-----BEGIN PRIVATE KEY-----\\n..." }'

# Control de administradores (emails autorizados para panel)
ADMIN_EMAILS="admin@pollostellos.com,otro@pollostellos.com"

# Configuración opcional
PRISMA_LOG_QUERY=false
PORT=3000
```

> En entornos productivos usar valores reales y rotar `API_KEY` periódicamente. Nunca exponerlos en repos públicos.

---

## Setup Local

```bash
npm install
npm run prisma:generate
npm run prisma:migrate --name init      # sólo la primera vez (usa prisma migrate dev)
npm run start:dev                       # servidor en http://localhost:3000
```

Pruebas unitarias (opcional): `npm test -- --passWithNoTests`

---

## Despliegue en Render

1. Configurar las variables anteriores en **Render → Environment** (usar el pooler IPv4).  
2. Tras cambiar env vars ejecutar: **Clear build cache** + **Deploy latest commit**.  
3. Monitorear logs (`Events` y `Logs`) hasta ver `Nest application successfully started`.  
4. Si aparecen errores `P2024`/`P1001`, revisar límites de conexión (`DATABASE_URL` con `pgbouncer=true` + ajustar `pool_timeout` en `prisma schema`).  

> Sugerencia: limitar `pool.max` a ~6 conexiones en `schema.prisma` para planes Free.

---

## Principales Módulos (`src/`)

| Módulo | Descripción |
|--------|-------------|
| `auth` | Guardias JWT, estrategia Firebase, decoradores `@Public()`. |
| `users` | CRUD + endpoints `/users/:id/engagement`, emisores de descuentos (`grantDiscount`), share coupons. |
| `orders` | Creación y actualización de pedidos, tracking de estados, mensajes internos. |
| `menu` | Categorías / ítems publicados en el front (`/menu/public`, `/menu/categories`). |
| `discounts` | Gestión de códigos personalizados, redenciones y auditoría. |
| `share-coupons` | Lógica de referidos (emitir, activar, canjear). |
| `loyalty` | Eventos de lealtad, métricas de ahorro. |
| `whatsapp` | Registros de interacción, enlaces generados. |
| `inventory` | Tablas de stock, suppliers, movimientos (planificados). |

`prisma/schema.prisma` refleja la relación completa (Users, Orders, OrderItemSnapshot, DiscountCode, ShareCoupon, LoyaltyEvent, etc.).

---

## Seguridad y Buenas Prácticas

- **Firebase ID Tokens**: todas las rutas protegidas verifican `Authorization: Bearer <token>`. El front los obtiene con Firebase Auth Web SDK.  
- **API Key**: requerida en clientes de confianza (frontend incluye `x-api-key`). Rotar y almacenar fuera de repos.  
- **Supabase RLS**: habilitar Row Level Security en tablas públicas (`ReferralShare`, `WhatsappInteraction`, `LoyaltyEvent`, `StockItem`, etc.) para evitar accesos desde PostgREST.  
- **Logging**: configurar Logflare/Datadog para capturar errores críticos y latencia.  
- **Rate limiting / throttling**: considerar `@nestjs/throttler` para endpoints sensibles (ej. emisión de códigos).  

---

## Flujo con el Frontend

- El frontend (`Pollos_Tellos` o variantes) llama a esta API vía `src/utils/api.ts` usando `VITE_API_URL` + `VITE_API_KEY`.  
- Al iniciar sesión, el front invoca `POST /users` para asegurar que existan los perfiles.  
- Checkout: `POST /orders` registra la orden antes de abrir WhatsApp. Estados sucesivos (`PATCH /orders/:id/status`) se gestionan desde el admin.  
- Descuentos: `GET /users/:id` entrega `discountCodesOwned`, `shareCoupons`, historial de redenciones.  
- Menu: `GET /menu/public` provee secciones + items según visibilidad y audiencia.

---

## Scripts NPM

| Comando | Descripción |
|---------|-------------|
| `npm run start:dev` | Hot reload (Nest CLI). |
| `npm run start` | Arranque en modo producción (requiere `npm run build`). |
| `npm run build` | Transpila TypeScript a `dist/`. |
| `npm run prisma:generate` | Regenera el cliente Prisma. |
| `npm run prisma:migrate` | Crea/aplica migraciones (desarrollo). |
| `npm run prisma:deploy` | Aplica migraciones en entornos productivos. |
| `npm test` | Ejecuta Jest (usar `--passWithNoTests` si aún no hay specs). |

---

## Migrar a Otro Proyecto (ej. Moda)

1. Clonar este repo en un nuevo directorio (p. ej. `moda-api`).  
2. Crear nueva base en Supabase, ejecutar `npm run prisma:migrate deploy`.  
3. Ajustar `.env` con nuevas credenciales y `API_KEY`.  
4. Personalizar textos/correos en `ADMIN_EMAILS`, seed inicial (opcional).  
5. Desplegar en Render (o similar) y conectar el nuevo frontend mediante las variables `VITE_API_URL` / `VITE_API_KEY`.  
6. Revisar políticas de descuentos, share coupons y fidelización para que reflejen el negocio objetivo.

Este README documenta el snapshot final de Pollos Tello’s API listo para ser archivado o reusado como base privada de nuevos verticales.
