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

Frontend deploys to Vercel (`vercel.json`: SPA rewrite of everything to `/`, output `build/`). All eight `REACT_APP_*` env vars must exist in Vercel or the app renders a blank screen. `functions/` deploys separately through the Firebase CLI — it is not part of the Vercel build.

## Language

Code, comments, UI copy, and Firestore field semantics are in **Portuguese (pt-BR)**. Existing comments are long, explanatory, and explain *why* a rule exists (often referencing an agency decision or a legacy data shape). Match that: write new comments in Portuguese in the same register.

## Architecture

Create React App (JavaScript, no TypeScript, no state library, no CSS framework). Firebase is the entire backend: Firestore for data, Auth for the team login, Storage for portal product photos, one Cloud Function.

### Domain constants live in one file

`src/lib/firebase.js` is the single source of truth for the whole domain, not just the SDK init: sector identities (color/emoji/logo), client lifecycle stages, kanban columns, priorities, SLA tables, service catalogs, portal enums. **Change a sector color or add a status there, and the whole app follows.** Always check this file before hardcoding a label, color, or status string anywhere else.

### Data layer = hooks with live listeners

`src/hooks/use*.js` are the only place Firestore is touched for reads. Each opens an `onSnapshot` on a collection, maps `{ id, ...data }` into state, and exposes CRUD closures. There is no cache, no normalization, no global store — components subscribe by calling the hook, and every open tab updates in real time. Firestore collections: `clients`, `collaborators`, `tasks`, `requests`, `documents` (+ `versions` subcollection), `portal_clients`, `portal_products`, `userIndex`, and the singleton `app_config/general`.

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

A client moves `staffing → kickoff → onboarding → live`. Until it reaches scheduled onboarding it is written with `active: false`, which is what hides it from every screen — the app filters on `active !== false` rather than checking stages in dozens of places. Legacy clients lack `stage`; **always read the stage through `stageOf(client)`**, which derives it and maps the old single-call flow onto the new one. The codebase generally tolerates legacy shapes in place of migrating (e.g. `responsibles` may be a string or an array — see `asArray`; `useTasks.js` auto-repairs tasks stuck in approval).

### Lince Docs

`src/lib/docs/` is a catalog-driven document generator for Social Media deliverables. `catalogo.js` declares each document's fields and its slide `render`; `motor.js` holds only generic helpers. **Adding a document means adding one object to `catalogo.js` and touching nothing else.** Documents persist as a single Firestore record, with a version snapshot per generated PDF. `src/styles/lince-docs.css` styles the print route (`/documentos/:docId/imprimir`).

## Styling

Dark neon theme driven by CSS custom properties in `src/index.css` (`--neon`, `--bg`, `--surface`, `--border`, `--muted`, `--f`/`--fm` fonts). Components style with **inline `style={{}}` objects**, usually collected in a local `const S = {...}` at the bottom of the file; `className` is used only for animations, the spinner, and `TVPanel`. Shared inline style tokens for the funnel panels live in `src/components/commercial/ui.js` (`CARD`, `INP`, `BTN_PRIMARY`, `Overlay`…). Modals render through `ReactDOM.createPortal` into `document.body` — `position: fixed` breaks under the `.fade-up` animation's lingering transform otherwise.

Sector color always comes from `SECTORS[sectorId].color`, never a literal.

## Conventions

- After a user-visible change, bump `PATCH_VERSION` and edit `PATCH_NOTES` in `src/components/shared/PatchNotesPopup.js` — collaborators see the popup once on next login. Write the notes in user language, no jargon.
- Desktop notifications are Notification API only (no service worker / FCM): they work only while a tab is open. `NotificationCenter` is mounted once in `App.js` and is the only thing that fires them; `useDesktopNotifications` elsewhere (e.g. `Sidebar`) is used purely as the on/off switch.
- The `/tv` panel shows **operational data only** — no revenue, sales targets, or commercial numbers; it is visible to clients and visitors in the office.
- The Design/Video production-time SLA (`SLA_DAYS`) is deliberately visible in the admin panel only, never to the collaborator.
