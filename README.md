# Pollos Tello's API

Backend monolito construido con [NestJS](https://nestjs.com/) y [Prisma](https://www.prisma.io/) para gestionar clientes, pedidos, referidos, stock y analítica del negocio.

## Stack principal
- **NestJS 11** (TypeScript) con `@nestjs/config` para manejo de entornos.
- **Prisma ORM** con PostgreSQL como base de datos relacional.
- **Jest** para pruebas unitarias.
- Validación de requests con `class-validator` / `class-transformer`.

## Estructura inicial de dominios
- `users`: endpoints REST para CRUD de usuarios + snapshot de engagement (conteo de pedidos mensuales, canjes, share events, etc.).
- Modelo Prisma incluye entidades para pedidos, items, códigos de descuento, referidos, interacciones de WhatsApp, lealtad, stock e inventarios.
- `prisma/` contiene el esquema relacional completo (`schema.prisma`).

## Configuración rápida
1. Crear y exportar la variable de entorno `DATABASE_URL` (o editar `.env`). Ejemplo:
   ```env
   DATABASE_URL="postgresql://usuario:password@localhost:5432/pollos_tellos?schema=public"
   ```
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Generar el cliente de Prisma y aplicar migraciones (una vez que definas la primera migración):
   ```bash
   npm run prisma:generate
   npm run prisma:migrate --name init
   ```
4. Levantar el servidor en modo desarrollo:
   ```bash
   npm run start:dev
   ```
5. Ejecutar pruebas:
   ```bash
   npm test -- --passWithNoTests
   ```

## Scripts disponibles
| Comando | Descripción |
| --- | --- |
| `npm run start` | Inicia la API en modo producción (requiere build previo). |
| `npm run start:dev` | Hot reload para desarrollo. |
| `npm run build` | Compila TypeScript a JavaScript. |
| `npm run prisma:generate` | Regenera el cliente Prisma. |
| `npm run prisma:migrate` | Crea/aplica migraciones (`prisma migrate dev`). |
| `npm run prisma:deploy` | Aplica migraciones en entornos productivos. |
| `npm test` | Ejecuta las pruebas unitarias con Jest. |

## Próximos pasos sugeridos
- Definir migraciones iniciales (`npm run prisma:migrate`).
- Crear módulos adicionales (`orders`, `inventory`, `referrals`, `analytics`) reutilizando `PrismaService`.
- Agregar Guards/strategies para autenticación (por ejemplo JWT basado en Firebase UID).
- Implementar endpoints que registren el intento de pedido antes de abrir WhatsApp, y el seguimiento del “bonus” (JackTello's).
- Conectar tu frontend (`Pollos_Tellos`) apuntando a esta API (`/users`, `/users/:id/engagement`, etc.).

> Ante cualquier cambio en el esquema Prisma, recordá ejecutar `npm run prisma:generate` y crear migraciones para mantener la base sincronizada.
