"use client";

import { useState, useSyncExternalStore } from "react";
import { DateTime } from "luxon";
import Link from "next/link";
import { TradeCalendar } from "@/features/calendar/components/trade-calendar";
import { TradeImport } from "@/features/imports/components/trade-import";
import type { TradeFile } from "@/features/trades/schemas/trade-file.schema";

const subscribe = () => () => {};

export function CalendarDashboard() {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [data, setData] = useState<TradeFile | null>(null);
  const [revision, setRevision] = useState(0);

  return (
    <main className="component-workspace">
      <header className="workspace-header">
        <Link href="/" className="wordmark">
          <span aria-hidden="true" className="brand-mark">
            t.
          </span>
          tradelyzer
        </Link>
        <span className="test-badge" title="Temporary data; clears on refresh">
          Preview
        </span>
      </header>
      <div className="workspace-content">
        {mounted && (
          <TradeCalendar
            key={revision}
            data={data}
            timezone={DateTime.local().zoneName}
          />
        )}
        {!mounted && (
          <div className="calendar-loading" role="status">
            Loading calendar…
          </div>
        )}
        <TradeImport
          onImport={(next) => {
            setData(next);
            setRevision((value) => value + 1);
          }}
        />
      </div>
    </main>
  );
}
