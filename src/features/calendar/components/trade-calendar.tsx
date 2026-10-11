"use client";

import { useId, useMemo, useState } from "react";
import { DateTime } from "luxon";
import {
  ChevronLeft,
  ChevronRight,
  NotebookPen,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { journalDatabase } from "@/lib/db/journal-database";
import { exceedsLossLimit } from "@/features/journal/schemas/journal.schema";
import { Button } from "@/components/ui/button";
import {
  calendarWeeks,
  groupByCloseDay,
} from "@/features/calendar/utils/calendar";
import {
  summarizeTrades,
  type TradeFile,
} from "@/features/trades/schemas/trade-file.schema";
import {
  formatWinRate,
  profitAndLossClass,
  tradeNoun,
} from "@/features/trades/utils/trade-display";
import { formatCompactMoney, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type TradeCalendarProps = { data?: TradeFile | null; timezone?: string };

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TradeCalendar({ data, timezone = "UTC" }: TradeCalendarProps) {
  const titleId = useId();
  const currency = data?.account.currency ?? "USD";
  const displayMoney = (value: bigint, signed = false) =>
    formatMoney(value, signed, currency);
  const journals = useLiveQuery(() => journalDatabase.journals.toArray());
  const entries = new Map(journals?.map((entry) => [entry.date, entry]));
  const today = DateTime.now().setZone(timezone);
  const [month, setMonth] = useState(() => {
    const latest = data?.trades.reduce(
      (last, trade) =>
        Math.max(last, DateTime.fromISO(trade.closedAt).toMillis()),
      Number.NEGATIVE_INFINITY,
    );
    if (latest !== undefined && Number.isFinite(latest)) {
      return DateTime.fromMillis(latest, { zone: timezone }).startOf("month");
    }

    return today.startOf("month");
  });
  const groups = useMemo(
    () => groupByCloseDay(data?.trades ?? [], timezone),
    [data, timezone],
  );
  const weeks = calendarWeeks(month);
  const monthTrades = [...groups.entries()]
    .filter(([date]) => date.startsWith(month.toFormat("yyyy-MM")))
    .flatMap(([, trades]) => trades);
  const summary = summarizeTrades(monthTrades);
  const activeDays = [...groups.keys()].filter((date) =>
    date.startsWith(month.toFormat("yyyy-MM")),
  ).length;
  const changeMonth = (offset: number) => {
    setMonth((value) => value.plus({ months: offset }));
  };

  return (
    <section aria-labelledby={titleId} className="bg-transparent">
      <div className="mb-5 flex items-center justify-between gap-6 @max-[1050px]:mb-6 @max-[1050px]:flex-col @max-[1050px]:items-stretch @max-[1050px]:gap-3 @max-[640px]:mb-4">
        <div className="min-w-0 flex-1 [&_h2]:text-2xl [&_h2]:leading-[1.3] [&_h2]:font-[550] [&_h2]:tracking-[-0.7px] @max-[640px]:[&_h2]:text-xl">
          <h2 id={titleId}>Trade calendar</h2>
          <span
            className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs leading-normal text-muted-foreground @max-[800px]:text-xs"
            title="Trades are grouped by their close date in this timezone"
          >
            {data?.account.name && (
              <span className="min-w-0 max-w-full truncate font-medium">
                {data.account.name}
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span>{timezone.replaceAll("_", " ")}</span>
            <span
              aria-label={`Account currency: ${currency}`}
              className="inline-flex items-center rounded-md border border-primary/15 bg-primary/10 px-2 py-0.5 text-xs font-semibold tracking-wide text-primary"
            >
              {currency}
            </span>
          </span>
        </div>
        <dl className="grid w-[min(60%,540px)] max-w-[540px] shrink-0 grid-cols-4 gap-4 @max-[1050px]:w-full @max-[1050px]:self-end @max-[640px]:grid-cols-[1.5fr_1fr_1fr_1fr] @max-[640px]:gap-2 @max-[640px]:[&_dt]:mb-1 @max-[640px]:[&_dt]:text-[9px] @max-[640px]:[&_dd]:text-[clamp(12px,3cqw,20px)] @max-[640px]:[&_dd]:leading-6 [&_dt]:mb-1 [&_dt]:text-xs [&_dt]:leading-4 [&_dt]:whitespace-nowrap [&_dt]:text-muted-foreground [&_dd]:text-2xl [&_dd]:leading-7 [&_dd]:font-medium [&_dd]:tracking-[-0.65px] [&_dd]:tabular-nums [&_dd]:[overflow-wrap:anywhere]">
          <div>
            <dt>
              Net P&L <span className="sr-only">in {currency}</span>
            </dt>
            <dd className={profitAndLossClass(summary.net)}>
              {displayMoney(summary.net, true)}
            </dd>
          </div>
          <div>
            <dt>Trades</dt>
            <dd>{summary.count.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Win rate</dt>
            <dd>{formatWinRate(summary.wins, summary.count)}</dd>
          </div>
          <div>
            <dt>Trading days</dt>
            <dd>{activeDays}</dd>
          </div>
        </dl>
      </div>
      <div className="min-w-0 rounded-3xl border border-border bg-card p-4 [corner-shape:squircle] @max-[640px]:rounded-[20px] @max-[640px]:px-1 @max-[640px]:py-4">
        <div className="mb-6 @max-[640px]:mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 [&_h3]:text-base @max-[640px]:[&_h3]:text-sm [&_h3]:font-[550]">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft />
            </Button>
            <h3
              aria-live="polite"
              className="min-w-36 text-center @max-[640px]:min-w-28"
            >
              {month.toFormat("MMMM yyyy")}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next month"
              onClick={() => changeMonth(1)}
            >
              <ChevronRight />
            </Button>
          </div>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <Button
              variant="outline"
              onClick={() => setMonth(today.startOf("month"))}
            >
              Today
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse [&_th]:px-[14px] [&_th]:pb-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_th:last-child]:w-[12%] [&_td]:overflow-hidden [&_td]:border [&_td]:border-border [&_td]:align-top @max-[1050px]:[&_th]:px-1 @max-[640px]:[&_th]:text-center @max-[640px]:[&_th]:text-[9px] @max-[640px]:[&_th]:px-0 @max-[640px]:[&_th]:pb-2 @max-[640px]:[&_th:last-child]:w-[16%]">
            <caption className="sr-only">
              {month.toFormat("MMMM yyyy")} closed trade results in {currency}
            </caption>
            <thead>
              <tr>
                {weekdays.map((day) => (
                  <th scope="col" key={day}>
                    {day}
                  </th>
                ))}
                <th
                  scope="col"
                  title="Includes every displayed day, including adjacent months"
                >
                  <span className="@max-[640px]:hidden">Week total</span>
                  <span className="hidden @max-[640px]:inline">Week</span>
                </th>
              </tr>
            </thead>
            {weeks.map((week) => {
              const weekSummary = summarizeTrades(
                week.flatMap((day) => groups.get(day.toISODate()!) ?? []),
              );
              let weekTotal = "—";
              let compactWeekTotal = "—";

              if (weekSummary.count > 0) {
                weekTotal = displayMoney(weekSummary.net, true);
                compactWeekTotal = formatCompactMoney(weekSummary.net);
              }

              return (
                <tbody key={week[0].toISODate()}>
                  <tr>
                    {week.map((day) => {
                      const date = day.toISODate()!;
                      const daySummary = summarizeTrades(
                        groups.get(date) ?? [],
                      );
                      const entry = entries.get(date);
                      const overLimit = exceedsLossLimit(
                        daySummary.net,
                        entry?.maxLoss,
                      );
                      const outside = day.month !== month.month;
                      const isToday = date === today.toISODate();
                      const labelParts = [
                        `${day.toFormat("MMMM d, yyyy")}, ${daySummary.count} trades`,
                      ];
                      let currentDate: "date" | undefined;

                      if (isToday) {
                        currentDate = "date";
                      }

                      if (daySummary.count > 0) {
                        labelParts.push(
                          `${displayMoney(daySummary.net)} net P&L`,
                        );
                      }

                      if (entry) {
                        labelParts.push("journal saved");
                      }

                      if (overLimit) {
                        labelParts.push("daily loss limit exceeded");
                      }

                      return (
                        <td
                          key={date}
                          className={cn(outside && "bg-muted [&_a]:opacity-55")}
                        >
                          <Link
                            href={{ pathname: "/journal/day", query: { date } }}
                            prefetch={false}
                            className="flex h-28 w-full cursor-pointer flex-col items-start px-4 py-3 text-left transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring @max-[1050px]:px-2 @max-[1050px]:py-2 @max-[640px]:h-[76px] @max-[640px]:aspect-auto @max-[640px]:items-center @max-[640px]:px-0.5 @max-[640px]:py-1.5"
                            aria-label={labelParts.join(", ")}
                          >
                            <span
                              className={cn(
                                "-mt-0.5 -ml-1 mb-[7px] grid size-[22px] place-items-center text-xs @max-[640px]:m-0 @max-[640px]:mb-0.5 @max-[640px]:size-4 @max-[640px]:text-[9px]",
                                isToday &&
                                  "rounded-lg bg-foreground text-background [corner-shape:squircle]",
                                !isToday && "text-muted-foreground",
                              )}
                              aria-current={currentDate}
                            >
                              {day.day}
                            </span>
                            {daySummary.count > 0 && (
                              <span className="flex max-w-full min-w-0 flex-col gap-[5px] [&_strong]:text-sm [&_strong]:font-medium [&_strong]:whitespace-nowrap [&_strong]:tabular-nums [&>span]:text-xs [&>span]:text-muted-foreground @max-[1050px]:[&_strong]:text-xs @max-[640px]:gap-0.5 @max-[640px]:leading-tight @max-[480px]:[&>span]:hidden @max-[640px]:[&_strong]:text-[9px] @max-[400px]:[&_strong]:text-[8px] @max-[640px]:[&_strong]:leading-4 @max-[640px]:[&_strong]:truncate @max-[640px]:[&>span]:text-[8px]">
                                <strong
                                  className={profitAndLossClass(daySummary.net)}
                                >
                                  <span className="@max-[640px]:hidden">
                                    {displayMoney(daySummary.net, true)}
                                  </span>
                                  <span
                                    className="hidden @max-[640px]:inline"
                                    title={displayMoney(daySummary.net, true)}
                                  >
                                    {formatCompactMoney(daySummary.net)}
                                  </span>
                                </strong>
                                <span>
                                  {daySummary.count}{" "}
                                  <span className="@max-[640px]:hidden">
                                    {tradeNoun(daySummary.count)}
                                  </span>
                                  <span className="hidden @max-[640px]:inline">
                                    tr.
                                  </span>
                                </span>{" "}
                              </span>
                            )}
                            <span className="mt-auto flex items-center gap-2 shrink-0 @max-[640px]:min-h-2.5 @max-[640px]:gap-1 @max-[640px]:[&_svg]:size-2.5">
                              {entry && (
                                <NotebookPen
                                  size={13}
                                  className="text-muted-foreground"
                                  aria-label="Journal saved"
                                />
                              )}
                              {overLimit && (
                                <AlertTriangle
                                  size={13}
                                  className="text-loss"
                                  aria-label="Daily loss limit exceeded"
                                />
                              )}
                            </span>
                          </Link>
                        </td>
                      );
                    })}
                    <td className="@max-[640px]:px-0.5 @max-[640px]:pt-6 @max-[640px]:pb-1.5 @max-[640px]:text-center @max-[640px]:[&_strong]:text-[8px] @max-[640px]:[&>span]:text-[8px] @max-[1050px]:px-2 @max-[1050px]:pt-9 @max-[1050px]:[&_strong]:text-xs bg-muted px-4 pt-3 pb-2 [&_strong]:text-sm [&_strong]:font-medium [&_strong]:whitespace-nowrap [&_strong]:tabular-nums [&>span]:mt-[5px] [&>span]:block [&>span]:text-xs [&>span]:text-muted-foreground">
                      <strong className={profitAndLossClass(weekSummary.net)}>
                        <span className="@max-[640px]:hidden">{weekTotal}</span>
                        <span
                          className="hidden @max-[640px]:inline"
                          title={displayMoney(weekSummary.net, true)}
                        >
                          {compactWeekTotal}
                        </span>
                      </strong>
                      {weekSummary.count > 0 && (
                        <span>
                          {weekSummary.count}
                          <span className="@max-[640px]:hidden"> trades</span>
                          <span className="hidden @max-[640px]:inline">
                            {" "}
                            tr.
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              );
            })}
          </table>
        </div>
      </div>
    </section>
  );
}
