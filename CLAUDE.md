# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm start          # CRA dev server on :3000 (reads .env.local)
npm run build      # production build into build/ (untracked)
npx firebase deploy --only functions   # deploys functions/ (Node 20)
```

There are no tests and no lint script — `react-scripts test` exists via CRA but no test files are present, and linting is only the inline `eslintConfig: ["react-app"]` that runs during `start`/`build`.

Frontend deploys to Vercel (`vercel.json`: SPA rewrite of everything to `/`, output `build/`). Only the six `REACT_APP_FIREBASE_*` vars are actually required — without them `initializeApp` receives an undefined config and the app renders blank. `REACT_APP_ADMIN_ID` and `REACT_APP_ADMIN_PASSWORD` are optional: they fall back to `admin` / `Dash@2026` in code (`AuthContext.js:34-35`). `functions/` deploys separately through the Firebase CLI — it is not part of the Vercel build.

## Language

Code, comments, UI copy, and Firestore field semantics are in **Portuguese (pt-BR)**. Existing comments are long, explanatory, and explain *why* a rule exists (often referencing an agency decision or a legacy data shape). Match that: write new comments in Portuguese in the same register.

## Architecture

Create React App (JavaScript, no TypeScript, no state library, no CSS framework). Firebase is the entire backend: Firestore for data, Auth for the team login, Storage for uploads, one Cloud Function.

### Domain constants live in one file

`src/lib/firebase.js` is the single source of truth for the whole domain, not just the SDK init: sector identities (color/emoji/logo), client lifecycle stages, kanban columns, priorities, SLA tables, service catalogs, portal enums. **Change a sector color or add a status there, and the whole app follows.** Always check this file before hardcoding a label, color, or status string anywhere else.

### Data layer = hooks with live listeners

`src/hooks/use*.js` are the data layer for everything a screen renders. Each opens an `onSnapshot` on a collection, maps `{ id, ...data }` into state, and exposes CRUD closures. There is no cache, no normalization, no global store — components subscribe by calling the hook, and every open tab updates in real time. Firestore collections: `clients`, `collaborators`, `tasks`, `requests`, `documents` (+ `versions` subcollection), `portal_clients`, `portal_products`, `userIndex`, and the singleton `app_config/general`.

Four files bypass the hooks and hit Firestore directly, each for a reason:

- `contexts/AuthContext.js:81,87` — `getDocs` on `collaborators` during login, before any hook is mounted; also writes `userIndex` (`:96,110`) and `collaborators` (`:107,214,244`)
- `contexts/PortalAuthContext.js:38,63` — portal login lookup and `lastLoginAt`
- `components/shared/PatchNotesPopup.js:46,63` — reads and writes `collaborators.lastPatchSeen`
- `pages/sectors/DocPrintPage.js:56` — a single `getDoc` with no listener, so a document edited mid-print cannot change under the PDF

### Storage layout

Three unrelated areas share the bucket:

- `brand-hub/{clientId}/{id}_{file}` — brandbook/Cofre materials (`useClients.js:136`), indexed in the client doc under `brandbook.materials`
- `contratos/` and `briefings/` — registration attachments (`useClients.js:516`). Separate folders on purpose: the contract holds CPF, CNPJ and amounts and is **never rendered in any screen** of the app
- `portal-products/{portalClientId}/{productId}/{file}` — portal product photos (`usePortalProducts.js:84`)

### Two independent auth systems

- **Team** — `src/contexts/AuthContext.js`. Users type a `loginId`, which is converted to a synthetic email (`loginId@squadmvps.interno`, `loginIdToEmail`) for Firebase Auth. The profile (sector, isAdmin, csRole, leaderOf) lives in the `collaborators` doc, joined by `authUid`. It carries a **lazy migration** path: accounts predating Auth still hold a plaintext `password` in Firestore; on first login it validates against that, creates the Auth account, then nulls the field. Every Firestore call in the login chain is wrapped in `withTimeout` and is best-effort — nothing in the profile/index write path may block a login.
- **Portal clients** (external e-commerce customers uploading products) — `src/contexts/PortalAuthContext.js`. Completely separate: username + SHA-256 hash checked against `portal_clients`, session in `sessionStorage`. It never touches Firebase Auth.

Creating a collaborator uses a **secondary, disposable Firebase app instance** (`useCollaborators.js`) because `createUserWithEmailAndPassword` on the default instance would sign the admin out. Resetting someone else's password requires the Admin SDK, hence the sole Cloud Function `resetCollaboratorPassword`, which re-verifies the caller is an admin via `userIndex` then `collaborators.authUid`.

### Routing and access control

`src/App.js` holds every route plus `ProtectedRoute`, whose flags are the access model: `requireSector`, `requireAdmin`, `requireCsRole` (CS splits into `comercial`/`operacional` subpanels), and `allowAdmin` for routes shared between a sector and admin (the Lince Docs editor). Admins are force-redirected to `/admin` unless the route opts in. Two routes sit outside the team auth entirely: `/tv` (public wall panel, signs in anonymously, read-only, lazy-loaded) and `/portal*`.

Note the client-side guards are UX only — the real boundary is Firestore rules, which the README's setup step leaves fully open (`allow read, write: if true`).

### Business-time engine

`src/lib/taskTime.js` computes everything in **business time** (Mon–Fri, 09:00–18:48, `BUSINESS_DAY`): per-person time held on a task, execution vs. rework vs. approval, and a deadline clock that *freezes* while a task sits in approval and refunds `pausedMs` if it comes back. Never compute a task duration with raw date math — use `taskTimeStats` / `deadlineState`.

### Client lifecycle

A client moves `staffing → kickoff → onboarding → live`. Until it reaches scheduled onboarding it is written with `active: false` (`useClients.js:69` on create, still `false` when staffing closes at `:373`, flipped to `true` only by `scheduleOnboarding` at `:457`), which is what hides it from every screen — the app filters on `active !== false` rather than checking stages in dozens of places.

Read the stage through `stageOf(client)` (`firebase.js:89`): it derives the effective stage, mapping the old single-call flow (`stage: 'live'` plus `kickoff.pending: true`) onto `onboarding`. Not all code does this yet — `AdminClients.js:178,206`, `AdminDashboard.js:109`, `GenericSectorDashboard.js:131` and `useClients.js:366,490` compare `c.stage === 'staffing'` directly. Those are safe only because `staffing` is never derived, unlike `onboarding`. Prefer `stageOf()` in new code.

The codebase generally tolerates legacy shapes in place of migrating (e.g. `responsibles` may be a string or an array — see `asArray`; `useTasks.js` auto-repairs tasks stuck in approval).

### Lince Docs

`src/lib/docs/` is a catalog-driven document generator for Social Media deliverables, split across four files:

- `catalogo.js` — one object per document: its fields (`secoes`) and slide `render` (`DOCS` `:14`, `docPorId` `:695`, `docsAtivos` `:699`)
- `motor.js` — generic helpers that know no specific document; `montarDeck(doc, dados, opcionais, extras, LAYOUTS)` (`:55`) assembles the deck
- `layouts.js` — the slide layouts (`LAYOUTS` `:12`, `LAYOUT_PADRAO` `:122`), passed *into* `montarDeck` from outside
- `marca.js` — brand tokens (`MARCA` `:21`, `varsDaMarca` `:42`)

Adding a document is one object in `catalogo.js` **provided it reuses an existing layout**; a new layout means editing `layouts.js` as well. Documents persist as a single Firestore record, with a version snapshot per generated PDF (`useDocuments.js:99`). `src/styles/lince-docs.css` styles the print route (`/documentos/:docId/imprimir`).

## Styling

Dark neon theme driven by CSS custom properties in `src/index.css` (`--neon`, `--bg`, `--surface`, `--border`, `--muted`, `--f`/`--fm` fonts). Components style with **inline `style={{}}` objects**, usually collected in a local `const S = {...}` at the bottom of the file; `className` is used only for animations, the spinner, and `TVPanel`. Shared inline style tokens for the funnel panels live in `src/components/commercial/ui.js` (`CARD`, `INP`, `BTN_PRIMARY`, `Overlay`…). Modals render through `ReactDOM.createPortal` into `document.body` — `position: fixed` breaks under the `.fade-up` animation's lingering transform otherwise.

Sector color should come from `SECTORS[sectorId].color`, and theme colors from the CSS vars. Be aware the brand neon `#EE3363` is hardcoded in 29 places outside `firebase.js` (`AdminCharts.js:5`, `AdminPortalClients.js:8`, `ProductFormModal.js:5`, `TaskModal.js:408,543,564,576`, `useDocuments.js:27`, …) — a literal you find there is the existing style, not necessarily a bug. Use the constant in new code.

## Conventions

- After a user-visible change, bump `PATCH_VERSION` and edit `PATCH_NOTES` in `src/components/shared/PatchNotesPopup.js` — collaborators see the popup once on next login. Write the notes in user language, no jargon.
- Desktop notifications are Notification API only (no service worker / FCM): they work only while a tab is open. `NotificationCenter` is mounted once in `App.js` and is the only thing that fires them; `useDesktopNotifications` elsewhere (e.g. `Sidebar`) is used purely as the on/off switch.
- The `/tv` panel shows **operational data only** — no revenue, sales targets, or commercial numbers; it is visible to clients and visitors in the office.
- The Design/Video production-time SLA (`SLA_DAYS`) is deliberately visible in the admin panel only, never to the collaborator.
