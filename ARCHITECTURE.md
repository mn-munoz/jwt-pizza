# Architecture

`jwt-pizza` is the **frontend client** for the JWT Pizza system. It is a static single-page application (SPA) that is built and deployed as plain HTML/CSS/JS, and it talks to two independent backend services over HTTPS. This repo contains no server-side code — all business logic, persistence, and authentication live in those backend services.

## System overview

```
┌─────────────────┐        HTTPS/JSON        ┌───────────────────────┐
│                  │ ───────────────────────► │   jwt-pizza-service   │
│    jwt-pizza     │   auth, orders, menu,    │  (order/business API, │
│  (this repo, SPA)│   franchises, stores,    │   users, DB-backed)   │
│                  │   /api/docs              └───────────────────────┘
│  React + Vite    │
│  static bundle   │        HTTPS/JSON        ┌───────────────────────┐
│                  │ ───────────────────────► │   jwt-pizza-factory   │
└─────────────────┘   order verification,     │ (signs/verifies JWTs  │
                       /api/docs               │  for "pizza" orders)  │
                                                └───────────────────────┘
```

- **jwt-pizza** (this repo): builds to static files and is deployed to a web server (see `deployService.sh`). It owns UI/UX, routing, and client-side state only.
- **jwt-pizza-service**: the backend API for authentication, users, menu, orders, franchises, and stores. Its base URL is injected via `VITE_PIZZA_SERVICE_URL`.
- **jwt-pizza-factory**: a separate service that issues and verifies the JWT that represents a completed pizza order (the "proof of purchase"). Its base URL is injected via `VITE_PIZZA_FACTORY_URL`.

Both backend URLs are environment-specific and configured through Vite env files (`.env.development` points at `localhost:3000` for the service; `.env.production` points at the hosted `pizza-service.cs329.click` / `pizza-factory.cs329.click`).

## Tech stack

| Layer          | Choice                                              |
| -------------- | ---------------------------------------------------- |
| Build tool     | [Vite](https://vitejs.dev/) (`npm run dev/build/preview`) |
| UI framework   | React 18 + TypeScript                                |
| Routing        | `react-router-dom` (client-side, `BrowserRouter`)     |
| Styling        | Tailwind CSS + [Preline](https://preline.co/) component library |
| HTTP           | native `fetch` (no axios/query library)               |
| State          | local React state only — no Redux/Context store       |

There is no test runner, linter config, or CI pipeline defined in `package.json` at present — the project is intentionally minimal for the course.

## Entry point and bootstrapping

- [index.html](index.html) is the single HTML shell; it loads [index.tsx](index.tsx) as a module script.
- [index.tsx](index.tsx) creates the React root and wraps the app in `BrowserRouter`, then renders [App](src/app/app.tsx).

## Application shell (`src/app`)

[app.tsx](src/app/app.tsx) is the composition root:

- Holds the single piece of global state that matters app-wide: the logged-in `user` (`User | null`), fetched once on mount via `pizzaService.getUser()`.
- Declares a single `navItems` array that doubles as both the **route table** and the **navigation menu model**. Each entry has a `path`, the `component` to render, a `display` tag (`nav`, `footer`, or neither for hidden/internal routes), and optional `constraints` (predicate functions like `isAdmin`/`loggedIn`) that gate whether a nav link is shown.
- Renders [Header](src/app/header.tsx) and [Footer](src/app/footer.tsx) from that same `navItems` list, and a `<Routes>` block that maps it to `<Route>` elements — so adding a page means adding one entry to `navItems`, not touching multiple files.
- Role gating (diner/franchisee/admin) is done client-side only, via `Role.isRole(user, Role.Admin)` from the service layer, purely to control what's shown in the UI. The actual authorization enforcement happens server-side in `jwt-pizza-service`.

Routing note: most authenticated actions live under an optional `:subPath?` segment (e.g. `/:subPath?/login`, `/:subPath?/create-store`) so a page like `/menu/login` can redirect back to `/menu` after auth using the breadcrumb/back navigation in [appNavigation.tsx](src/hooks/appNavigation.tsx).

## Views (`src/views`)

One file per route/page (home, menu, login, register, logout, dinerDashboard, franchiseDashboard, adminDashboard, createFranchise/closeFranchise, createStore/closeStore, payment, delivery, history, about, docs, notFound). Views:

- Use the shared [View](src/views/view.tsx) wrapper for consistent page title/layout chrome.
- Call the service layer directly (see below) rather than going through any shared data-fetching/cache layer.
- Pass state between routes via `react-router`'s `navigate(path, { state })` — e.g. [payment.tsx](src/views/payment.tsx) receives the pending `order` via location state, submits it to the service, and forwards the resulting signed `order`/`jwt` to `/delivery`.

## Components, hooks, icons

- [src/components/](src/components/) — small reusable presentational pieces (`Button`, `Card`, `Carousel`, `Slide`, `Quote`, `Breadcrumb`).
- [src/hooks/appNavigation.tsx](src/hooks/appNavigation.tsx) — `useBreadcrumb`, a navigation helper that walks up one path segment (used for "back"/cancel flows and by the breadcrumb component).
- [src/icons.tsx](src/icons.tsx) — inline SVG icon components (from HeroIcons).

## Service layer (`src/service`) — the API boundary

This is the architectural seam between UI and backend, and it's intentionally an interface + implementation split:

- [pizzaService.ts](src/service/pizzaService.ts) — defines all domain types (`User`, `Role`, `Menu`, `Pizza`, `Order`, `OrderHistory`, `Franchise`, `Store`, etc.) and the `PizzaService` interface that every view programs against.
- [httpPizzaService.ts](src/service/httpPizzaService.ts) — the concrete implementation, `HttpPizzaService`, backed by `fetch`. A single `callEndpoint(path, method, body)` helper centralizes:
  - Prefixing relative paths with `VITE_PIZZA_SERVICE_URL` (absolute URLs, e.g. factory calls, pass through unchanged).
  - Attaching `Authorization: Bearer <token>` from `localStorage`.
  - JSON encoding/decoding and normalizing failures into `{ code, message }` rejections.
- [service.ts](src/service/service.ts) — the composition point: exports a single `pizzaService` singleton bound to `httpPizzaService`. Views only ever import `pizzaService` from here, never `HttpPizzaService` directly — so swapping in a mock/test implementation means changing one line in this file.

### Auth model

Authentication is JWT-based and stateless on the client:

1. `login`/`register` hit `PUT`/`POST /api/auth` on `jwt-pizza-service`, which returns `{ user, token }`. The token is stored in `localStorage` (not cookies), and also sent via `credentials: 'include'` for any cookie-based session the service may set.
2. Every subsequent request attaches the stored token as a Bearer header.
3. `logout` calls `DELETE /api/auth` and clears the local token.
4. `getUser()` calls `GET /api/user/me` using the stored token; a failure (e.g. expired token) clears it, resulting in a logged-out state.

### Order flow and the two-service split

The order/verify flow is the clearest illustration of why there are two backend services:

1. Diner builds an order in [menu.tsx](src/views/menu.tsx) → confirms in [payment.tsx](src/views/payment.tsx) → `pizzaService.order(order)` posts to `jwt-pizza-service` (`POST /api/order`), which persists the order and returns `{ order, jwt }` — the `jwt` is a signed token asserting the order is valid/paid.
2. The `jwt` is carried to [delivery.tsx](src/views/delivery.tsx), which calls `pizzaService.verifyOrder(jwt)` — this hits `jwt-pizza-factory` directly (`POST /api/order/verify`), **not** `jwt-pizza-service`. The factory independently validates the signed token, decoupling "did the order get placed" (service) from "is this token authentic" (factory).

### Docs endpoint

`pizzaService.docs(docType)` fetches self-describing API docs (`/api/docs`) from either backend — `jwt-pizza-service` by default, or `jwt-pizza-factory` when `docType === 'factory'` — rendered by [docs.tsx](src/views/docs.tsx). This is how the app surfaces live backend API documentation without duplicating it in the frontend.

## Build & deployment

- `npm run dev` — Vite dev server, using `.env.development` (local backend at `localhost:3000`).
- `npm run build` — production build to `dist/`, using `.env.production` (hosted backend URLs). A `dist/version.json` timestamp is stamped in by the deploy script for cache-busting/diagnostics.
- [deployService.sh](deployService.sh) — deploy script: builds the app, stamps `version.json`, then `scp`s the `dist/` output to a target host's `public_html/jwt-pizza` over SSH (`-k <pem key> -h <hostname>`). There is no server process to manage — the deployed artifact is static files served by whatever web server runs on the target host.

## Key takeaways for extending this app

- **Add a page**: create a view under `src/views`, add one entry to `navItems` in [app.tsx](src/app/app.tsx).
- **Add/change an API call**: extend the `PizzaService` interface in [pizzaService.ts](src/service/pizzaService.ts) and implement it in [httpPizzaService.ts](src/service/httpPizzaService.ts); views should never call `fetch` directly.
- **Role-gated UI**: use `Role.isRole(user, Role.X)` as a `constraints` predicate on a `navItems` entry, or inline in a view — remembering this only hides UI, it doesn't replace server-side authorization.
- **Cross-service calls**: default to `jwt-pizza-service`; only call `jwt-pizza-factory` for order-token verification (or its `/api/docs`), and only via absolute URLs built from `VITE_PIZZA_FACTORY_URL`.
