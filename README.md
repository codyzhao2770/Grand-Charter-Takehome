## Features
### Schema Extractor
- Store comprehensive database information on a hosted file system
- Enter any database credentials to establish connection for import
- App will extract tables, relationships, enums, indexes, interfaces, as well as generate a full interactive schema diagram
- Provides DB metrics and supports searching paginated data
- Schema export as JSON
- Natural language querying by integrating gpt-mini

### File System
- Full drag-and-drop upload and download functionality
- File search and filtering functionality
- Organized and clean UI designed with UX in mind

## Getting Started
You need Docker running for step 1, and steps 1-3 must happen in order before step 4.

1. `docker compose up -d` — Starts a PostgreSQL 16 container in the background using the docker-compose.yml config (user: datavault, password: datavault, database: datavault on port 5432). This is the local database your app connects to.

2. `npx prisma migrate dev` — Reads the prisma/schema.prisma and creates the actual SQL tables (users, folders, files, db_connections) in your PostgreSQL database. It generates migration files in prisma/migrations/ tracking each schema change.

3. `npm run db:seed` — Runs prisma/seed.ts which populates the database with a default user and sample folders (Documents, Documents/Reports, Images, Projects) so the app has data to work with immediately.

4. `npm run dev` — Starts the Next.js development server on localhost:3000 with hot reload. This serves both the API routes and the frontend UI.

`npm test` — Runs Jest against all 54 test suites (folder/file API tests, schema extractor tests, AI safety tests). These use mocked dependencies so they don't need a running database.