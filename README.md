# Property frontend

A property maintenance app with resident, administrator, and technician portals in one React SPA. It connects to the `cp-be` backend using cookie authentication and role-based access.

| Portal     | Entry         | Main features                                                                  |
| ---------- | ------------- | ------------------------------------------------------------------------------ |
| Resident   | `/`           | Create reports, track current-unit reports/history, view profile               |
| Admin      | `/admin`      | View maintenance queues/metrics; manage accounts, units, reports, and settings |
| Technician | `/technician` | Browse assignments/history, start work, submit results, costs, and receipts    |

Sign in at `/login` with a backend account for the appropriate role. Resident and technician layouts stay within a 430px mobile shell; admin is responsive. All portals support system, light, and dark appearance. The Admin Dashboard shows live maintenance metrics, Recharts monthly activity/cost charts, and report action queues with Latest/Priority ordering. Charts require the Admin-only `GET /api/dashboard/trends?months=6` aggregate. Priority sorting requires the matching cp-be contract (`GET /api/reports?sort=priority`) and runs before pagination.

## Quick start

Use **Bun 1.4.2** and **Node 24.15+ in the Node 24 series** (tested with 24.18.1). The engine also permits Node 26+, which has not been verified here. Bun manages dependencies and scripts; Node is needed by tooling.

```sh
bun install --frozen-lockfile
cp .env.example .env
bun dev
```

Open [localhost:5173](http://localhost:5173). Run the sibling backend from `../cp-be` using its README; authenticated features require it. Use the matching backend contract and migrations, including `0005_cost_item_prices` for the current cost-item format.

For phone testing on the same network, run `bun dev --host 0.0.0.0` and open your computer’s LAN address.

## Configuration

| Variable            | Default                 | Purpose                                                        |
| ------------------- | ----------------------- | -------------------------------------------------------------- |
| `VITE_API_BASE_URL` | `/api`                  | Browser API base path or HTTP(S) URL; compiled into the build  |
| `API_PROXY_TARGET`  | `http://localhost:3001` | Server-only backend target for Vite’s development `/api` proxy |

The default proxy keeps frontend requests on the same origin. A direct cross-origin API needs credentialed CORS and compatible cookie settings on the backend. Keep secrets out of `VITE_*` variables.

## Commands

| Command                                   | Purpose                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `bun dev`                                 | Start Vite development server                                                 |
| `bun run check`                           | Generate API client, run tests, lint, check formatting, type-check, and build |
| `bun run test` / `bun run test:watch`     | Run tests once / watch                                                        |
| `bun run test:coverage`                   | Run tests with coverage                                                       |
| `bun run typecheck`                       | Generate routes and check strict TypeScript                                   |
| `bun run lint`                            | Check ESLint rules                                                            |
| `bun run format` / `bun run format:check` | Format files / check formatting                                               |
| `bun run build`                           | Type-check and build to `dist/`                                               |
| `bun run preview`                         | Preview the production build locally                                          |
| `bun run api:update`                      | Download backend OpenAPI contract and regenerate the client                   |

Tests use Vitest, Testing Library, and local HTTP fixtures; they do not require a running backend. For UI changes, also check both themes, keyboard interaction, and widths of 375px, 768px, and 1440px.

## Working in the repo

The stack is React, Vite, strict TypeScript, Tailwind v4, shadcn Nova / Base UI, TanStack Router and Query, Axios, Zustand, React Hook Form, Zod, and Recharts 3.8.0 through the existing shadcn Chart setup. Recharts peer ranges support the installed React/React DOM 19 versions. Direct dependencies are pinned in `package.json`; retain `bun.lock`.

```text
src/
  app/            Router, QueryClient, and theme initialization
  routes/         File-based routes and page metadata
  layouts/        Resident, admin, and technician shells
  features/       Feature pages, components, hooks, API boundaries, and schemas
  components/     Shared components; ui/ contains Base UI primitives
  lib/            API transport/generated client, environment, schemas, utilities
  stores/         Shared UI preferences
  index.css       Semantic theme tokens and global styles
tests/            Tests mirroring source and scripts
openapi/          Saved backend contract
scripts/          OpenAPI sync and metadata correction
```

- `@/*` maps to `src/*`. Add pages in `src/routes/`; never edit `src/routeTree.gen.ts` manually. Route generation runs before type checking.
- Router owns URLs, Query owns server state, Zustand owns shared UI preferences, and React Hook Form with Zod owns forms.
- Reuse the shared QueryClient and Axios transport. Use generated API functions, pass cancellation signals, and validate untrusted responses at feature boundaries.
- Add shadcn components with `bunx shadcn@4.21.4 add <component>` without reinitializing the setup. Base UI uses `render` composition; button-styled links need `nativeButton={false}`.
- Direct `/examples/form`, `/admin/examples/form`, and `/technician/examples/form` routes are local demonstrations; submissions are not persisted.

### Backend contract

With the backend running, use `bun run api:update`. The default contract URL is `http://localhost:3001/api/docs-json`; Swagger UI is at [localhost:3001/api/docs](http://localhost:3001/api/docs).

For another backend address:

```sh
bun run api:sync http://localhost:3002/api/docs-json
bun run api:generate
```

`api:generate` reads `openapi/cp-be.json` offline and writes `src/lib/api/generated/`. Never edit generated files manually. Keep the snapshot and generated client together when updating the contract; builds do not download backend changes. Backend workflow guides live in `../cp-be/docs/`.

Compatibility notes: TypeScript **6.0.3** is intentional because `typescript-eslint` **8.71.1** supports TypeScript below 6.1; upgrade them together. Orval **8.41.0** requires Node 22.18+. The direct Ajv **8.20.0** dev dependency satisfies Orval’s `ajv-draft-04` peer and avoids resolving ESLint’s Ajv 6. `scripts/openapi-transformer.ts` corrects nullable-string Swagger metadata for assignment notes and rejection reasons until the backend schema supplies explicit string types.

## Deployment

Serve `dist/` as one SPA, falling back to `index.html` for application routes while preserving asset paths. Route `/api` to the backend separately, or set `VITE_API_BASE_URL` before building. `bun run preview` is for local verification. No hosting provider is configured; production cookie, CORS, and proxy behavior still require deployment verification.
