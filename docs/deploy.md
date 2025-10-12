# Deploy Checklist

## Variables de entorno

- `DATABASE_URL`
- `API_KEY`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `ADMIN_EMAILS`
- `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` (opcional como fallback)

Asegurate de replicar los mismos valores en Render antes del build.

## Migraciones y cliente Prisma

```bash
rm -rf node_modules/.prisma
npx prisma generate --schema prisma/schema.prisma
npx prisma migrate deploy
```

> Esta rama incluye la migración `20251006_order_item_snapshots` para guardar los items normalizados de cada pedido.

## Build & Deploy

```bash
rm -rf dist
npm ci
npm run build
```

Render: activar *Clear build cache* si aparecen residuos del cliente Prisma o de `dist/`.

Smoke tests recomendados:

1. Crear un pedido como invitado y como admin, verificar que aparece `normalizedItems` en la API.
2. Confirmar/cancelar desde `/admin` y revisar que el historial se actualiza.
3. Validar logs en Render (buscar errores de Firebase o Prisma).
