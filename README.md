# Tradelyzer Daily Journal

Next.js App Router starter for the trading-journal assignment. This is project setup only; journal screens and application data logic have not been implemented.

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
