# Tradelyzer — Daily Trading Journal

A daily journal for traders: a month calendar of results, and a page per day with the day's trades, a pre-market plan, a post-session review, screenshots and a reusable plan template.

Built with Next.js (App Router), React, TypeScript and Tailwind CSS.

## Setup and running

Requirements: Node.js 20.9 or newer, and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000, choose **Import trades → File upload**, and select the `trades.json` supplied with the assignment. The calendar opens on the month of the most recent trade.

Other commands:

```bash
npm test         # unit and storage tests
npm run lint     # ESLint
npm run build    # production build
npm run start    # serve the production build
```

## What it does

- **Month calendar.** Each day shows net P&L (green for profit, red for loss), the number of trades, and an icon when a journal entry exists. A warning icon appears when the day's loss is bigger than the planned max loss. Every day is clickable, including days without trades. Each week row ends with a weekly total.
- **Day page.** The day's trades (symbol, side, volume, open and close time, net P&L) with a clear "No stop loss" marker, and a summary: net P&L, win rate, number of trades, largest win and largest loss.
- **Pre-market plan.** Market bias, key levels, max loss for the day, and a plan.
- **Post-session review.** What went well, mistakes, mistake tags (FOMO, Moved stop, Overtraded, Revenge trade, plus your own), and mood from 1 to 5.
- **Screenshots.** Attach chart images with the file picker or by pasting from the clipboard. Thumbnails, a large preview and delete.
- **Template.** Save the plan fields as a default template that pre-fills the plan on new days.

## Storage choice and trade-offs

Everything is stored in the browser with **IndexedDB**, through Dexie.

Why IndexedDB over local storage:

- **Images.** Screenshots are stored as binary blobs. Local storage only holds strings, so images would need base64 encoding and would hit its small size limit after a few charts.
- **Complex objects.** Journals, trades and templates are stored as structured records without manual serialising.
- **Indexing.** Screenshots are indexed by day and journals are keyed by date, so a day page reads only what it needs.
- **Transactions.** A journal, its tags and its screenshot changes are saved in one transaction, so a failed save leaves the previous entry intact.

Why not PostgreSQL or another server database:

- It adds a server, a schema, migrations, hosting and authentication, which is extra complexity and resource use for a project of this size.
- The storage code sits behind one module (`src/lib/db/journal-database.ts`), so it can be replaced by a server database later.

Limits of this choice:

- Data lives in one browser profile on one device. There is no sync between devices and no account.
- Clearing site data, private browsing, or the browser evicting storage removes everything.
- Storage is limited by the browser's quota. Screenshots are kept at original size, up to 10 MB each.
- There is no export or backup, so keep the source `trades.json`.

## Decisions about the data

- **Money stays exact.** Money values arrive as strings and are converted to whole cents as `BigInt`. All totals are added in cents and formatted only for display, so there is no floating-point drift.
- **Days use the local time zone.** Times in the file are UTC. They are shown and grouped in the browser's local time zone.
- **A trade belongs to the day it closes.** One trade opens before UTC midnight and closes after it. It is counted on its local close date, because that is when its profit or loss is realised and when it affects the day's result and loss limit.
- **Weeks run Monday to Sunday.** The weekly total covers every day shown in that row, including days from the neighbouring month.
- **The loss warning is strict.** It appears only when the net loss is bigger than the max loss, not when they are equal.

## Assumptions

- One account at a time. Importing a new file replaces the saved trades; journal entries, screenshots and the template are kept.
- Journal entries are keyed by local calendar date. Changing the device time zone can move a trade to a different day.
- A journal entry is saved with the **Save journal** button, not automatically. Leaving with unsaved changes asks for confirmation.
- The template copies only the plan fields. Reviews, tags, mood and screenshots are never copied to a new day.
- Each day allows up to 10 mistake tags. Custom tags are shared across days.

## Tests

`npm test` runs 70 tests covering the logic that matters most:

- money parsing, exact totals and formatting;
- calendar weeks and local-day grouping, including midnight and daylight-saving changes;
- trade file validation;
- journal rules, the loss limit and the plan template;
- IndexedDB storage: reload, replacement, schema upgrades and failed saves.

## Beyond the brief

The import dialog also has an **Exchange** tab that fetches trade history from Binance, Bybit or Coinbase and converts fills into completed trades. The assignment does not ask for this; the supplied file already contains finished trades with their net P&L.

I chose exchange APIs over manual CSV exports for ease of use. With a CSV, the trader has to find the export page on each exchange, download a file, and upload it again every time they want fresh data, and every exchange uses a different file format. With a read-only API key they connect once, pick a date range, and the history arrives in one step. The JSON file upload stays available for traders who prefer not to share a key.

## What I would do next

- **Trade analysis.** Use a decision model to analyse trades and find patterns, for example which setups, sessions or mistake tags go with losing days.
- **More charts.** An equity curve, P&L by symbol and by day of week, and win rate over time.
- **Trade replay.** Step through a trade on its price chart to review the entry and exit.
- **News.** A news endpoint so each day shows the market events that happened around the trades.
- **Server storage.** Move to PostgreSQL with accounts, so journals sync across devices.

## Project structure

```
src/
  app/            routes: calendar (/), day page (/journal/day), API route
  components/     shared UI and layout
  features/
    calendar/     month calendar
    journal/      day page, screenshots, journal schema
    imports/      file and exchange import
    trades/       trade file schema and summaries
  lib/            IndexedDB database, money helpers, ids
tests/            unit and storage tests
```
