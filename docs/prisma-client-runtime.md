# Prisma Client Runtime Notes

## Required Mode

This project uses the standard Node Prisma Client with a direct PostgreSQL datasource.

- `DATABASE_URL` must stay in the `postgresql://...` form
- `DIRECT_URL` must stay in the `postgresql://...` form
- Do not use Prisma Accelerate / Data Proxy URLs such as `prisma://...`

## Generate Command

Use one of the following:

```bash
npm run prisma:generate
```

or

```bash
npx prisma generate
```

Do **not** run:

```bash
npx prisma generate --no-engine
```

Generating Prisma Client with `--no-engine` makes the runtime expect a `prisma://` datasource URL, which breaks login and any other normal database query in this project.

## Windows Note

If `query_engine-windows.dll.node` is locked:

1. Stop the current Next.js / Node.js process that is using the workspace
2. Delete `node_modules/.prisma/client`
3. Run `npx prisma generate`

## Minimal Verification

After regeneration, a direct Prisma query should work:

```js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

await prisma.user.findFirst();
await prisma.$disconnect();
```

If that works, the runtime is using the normal PostgreSQL engine path again.
