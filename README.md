# Tradelyzer Daily Journal

Next.js App Router starter for the trading-journal assignment. The calendar supports validated JSON imports, exact P&L totals, local close-date grouping, and browser-local persistence. Day pages show trades and summaries, with saved pre-market plans and session reviews.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Included

- Next.js App Router, React, TypeScript, ESLint, and Tailwind CSS.
- shadcn/ui initialized with Tailwind v4, theme variables, Lucide icons, the `@/*` alias, and the starter Button primitive.
- `@tanstack/react-table` for headless trade-table behavior.
- `@chenglou/pretext` for text measurement and layout.
- Dexie and dexie-react-hooks for browser IndexedDB access. IndexedDB itself is built into supported browsers; it is not an npm package to install separately.
- Zod for runtime validation and Luxon for timezone-aware date operations.

## State library

Zustand is intentionally not installed. Keep persisted journal data in Dexie, URL state in route/search parameters, and small form drafts in React state. Add Zustand only if independent parts of the UI later need to coordinate substantial transient state.

## Dependencies

Run `npm run build` to compile for production and `npm run start` to serve that build. Use `npx shadcn@latest add <component>` to add shadcn primitives when the UI needs them; the shadcn CLI is not a runtime dependency.

## Storage and data handling

Imported account metadata and completed trades are saved in IndexedDB through Dexie.js in the `tradelyzer-journal` database. Version 2 adds daily journals keyed by local date, while preserving version 1 imports. Version 4 stores screenshot blobs in a separate table indexed by journal date. Screenshot additions and deletions stay in the day draft until Save journal. The journal, selected tags, and screenshot changes are committed in one IndexedDB transaction; failed saves preserve the previous data and keep the draft available to retry. Reloading or leaving without saving discards screenshot changes. Screenshot blobs load separately from the journal and thumbnail decoding is lazy. Attach PNG, JPEG, WebP or GIF files up to 10 MB each, or paste an image outside text fields. The Paste image button requires clipboard access; keyboard paste also works. Stored originals use browser disk space and are lost if site data is cleared. Version 3 adds a shared tag library and migrates tags from existing journals. Custom tags are saved immediately and offered on every day; selecting a tag stays specific to the journal and is persisted with Save journal. One active import is stored as a single record; importing another file replaces that record atomically. Original decimal money strings are preserved, and totals use BigInt cents. Trades belong to their local close date because this is when completed P&L is realized, including overnight trades.

The calendar restores saved data on reload. Imports report success only after the write completes; failed saves preserve the existing import and allow retry. Data stays in the same browser profile and origin, with no server upload or cross-device sync. Clearing site data, private-session cleanup, browser eviction, or storage limits can remove or prevent storage. Keep the source JSON as a backup. Large imports are read as one snapshot; indexed per-trade queries can be added if needed.

## Remaining scope

Default plan templates are not implemented yet. Day journals include bias, key levels, an exact-cent loss limit, plan/review text, custom mistake tags, and mood. Use Save journal to persist edits; navigation warns about unsaved changes. Saved entries and exceeded loss limits are indicated on the calendar. A warning appears only when net loss strictly exceeds the limit, not when equal. Journals belong to local dates and are shared across replacement trade imports; separate accounts and timezone changes are not isolated. Their persistence will be added with those features through versioned Dexie migrations. Settings remains a placeholder.

## Checks

```bash
npm run lint
npm test
npm run build
```

Storage tests use fake-indexeddb to verify reopen/restore, replacement, exact round-trips, and failed-import preservation.

## Reusable color palette

Color tokens live in `src/app/globals.css` and are exposed as Tailwind utilities through `@theme inline`. Component styles use semantic utilities instead of literal colors. The 60–30–10 rule describes the visual hierarchy, not a strict pixel count.

| Role | Token / Tailwind utility | Light color | Usage |
| --- | --- | --- | --- |
| 60% dominant | `bg-background` | `#F8FAFC` | App canvas |
| 60% dominant | `bg-card` | `#FFFFFF` | Calendar, day cells, form surfaces |
| Primary text | `text-foreground` | `#1E293B` | Headings and readable body text |
| 30% supporting | `bg-sidebar` | `#EEF2F6` | Sidebar and mobile header |
| 30% supporting | `bg-muted` / `bg-secondary` | `#F1F5F9` / `#E2E8F0` | Quiet containers and neutral hover states |
| Secondary text | `text-muted-foreground` | `#64748B` | Labels, metadata and supporting text |
| Borders | `border-border` / `border-border-strong` | `#E2E8F0` / `#CBD5E1` | Dividers, outlines, file drop zone |
| 10% brand accent | `bg-primary` / `text-primary` | `#2563EB` | Primary CTA and interactive links |
| Brand hover | `hover:bg-primary-hover` | `#1D4ED8` | Primary button hover |
| Active navigation | `bg-sidebar-accent` / `text-sidebar-accent-foreground` | `#DBEAFE` / `#1D4ED8` | Current navigation item |
| Keyboard focus | `ring-ring` / `outline-ring` | `#2563EB` | Focus indicators |
| Profit | `text-profit` | `#18794E` | Positive P&L |
| Loss/error | `text-loss` / `text-destructive` | `#B42318` | Negative P&L and errors |
| Error surface | `bg-danger-surface` / `border-danger-border` | `#FFF1F2` / `#FECDD3` | Error messages |

Reserve saturated blue for primary actions and active/focused interactions. Keep the logo and date marker neutral. Financial status colors express profit/loss independently of the brand. Use the shared Button component for CTA styling. Equivalent dark tokens are defined for future theme use.
