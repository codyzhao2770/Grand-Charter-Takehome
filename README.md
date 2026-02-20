This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```


docker compose up -d — Starts a PostgreSQL 16 container in the background using the docker-compose.yml config (user: datavault, password: datavault, database: datavault on port 5432). This is the local database your app connects to.

npx prisma migrate dev — Reads the prisma/schema.prisma and creates the actual SQL tables (users, folders, files, db_connections) in your PostgreSQL database. It generates migration files in prisma/migrations/ tracking each schema change.

npm run db:seed — Runs prisma/seed.ts which populates the database with a default user and sample folders (Documents, Documents/Reports, Images, Projects) so the app has data to work with immediately.

npm run dev — Starts the Next.js development server on localhost:3000 with hot reload. This serves both the API routes and the frontend UI.

npm test — Runs Jest against all 54 test suites (folder/file API tests, schema extractor tests, AI safety tests). These use mocked dependencies so they don't need a running database.

You need Docker running for step 1, and steps 1-3 must happen in order before step 4. Step 5 can run independently anytime.