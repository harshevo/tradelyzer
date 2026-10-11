"use client";

import { useState, useSyncExternalStore } from "react";
import { DateTime } from "luxon";
import { WorkspaceSidebar } from "@/components/layout/workspace-sidebar";
import { TradeCalendar } from "@/features/calendar/components/trade-calendar";
import { ExchangeImport } from "@/features/imports/components/exchange-import";
import { useLiveQuery } from "dexie-react-hooks";
import { journalDatabase } from "@/lib/db/journal-database";
import { Button } from "@/components/ui/button";
import type { TradeFile } from "@/features/trades/schemas/trade-file.schema";

const subscribe = () => () => {};

function calendarKey(data: TradeFile | null): string {
  if (!data) {
    return "empty";
  }

  const latestClose = data.trades.reduce(
    (latest, trade) => Math.max(latest, Date.parse(trade.closedAt)),
    0,
  );

  return JSON.stringify([data.account.name, latestClose]);
}

export function CalendarDashboard() {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [retry, setRetry] = useState(0);
  const stored = useLiveQuery(async () => {
    try {
      return { data: await journalDatabase.loadTrades(), error: null };
    } catch {
      return {
        data: null,
        error:
          "Couldn’t read saved trades. Allow browser storage and try again.",
      };
    }
  }, [retry]);

  function renderCalendar() {
    if (stored?.error) {
      return (
        <div
          role="alert"
          className="rounded-xl border border-danger-border bg-danger-surface p-4 text-sm text-destructive"
        >
          <p>{stored.error}</p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </Button>
        </div>
      );
    }

    if (mounted && stored) {
      return (
        <TradeCalendar
          key={calendarKey(stored.data)}
          data={stored.data}
          timezone={DateTime.local().zoneName}
        />
      );
    }

    return (
      <div
        className="grid min-h-[730px] place-items-center text-[13px] text-muted-foreground"
        role="status"
      >
        Loading calendar…
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-background max-[800px]:flex-col">
      <WorkspaceSidebar />
      <main className="@container min-h-screen min-w-0 flex-1 bg-background font-sans text-foreground [color-scheme:light]">
        <header className="mx-auto flex h-24 max-w-[1400px] items-center justify-end px-16 @max-[800px]:h-18 @max-[800px]:px-4">
          <ExchangeImport
            onImport={(next) => journalDatabase.saveTrades(next)}
          />
        </header>
        <div className="mx-auto mt-10 max-w-[1400px] px-16 pb-16 @max-[800px]:mt-3 @max-[800px]:px-4 @max-[800px]:pb-0">
          {" "}
          {renderCalendar()}
        </div>
      </main>
    </div>
  );
}
