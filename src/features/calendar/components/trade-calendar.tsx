"use client";

import { useId, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
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
  lossClass,
  profitAndLossClass,
  tradeNoun,
} from "@/features/trades/utils/trade-display";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type TradeCalendarProps = { data?: TradeFile | null; timezone?: string };
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TradeCalendar({ data, timezone = "UTC" }: TradeCalendarProps) {
  const titleId = useId();
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
      <div className="mb-11 flex items-center justify-between gap-12 @max-[1050px]:mb-9 @max-[1050px]:flex-col @max-[1050px]:items-stretch @max-[1050px]:gap-7">
        <div className="min-w-0 flex-1 [&_h2]:text-2xl [&_h2]:leading-[1.3] [&_h2]:font-[550] [&_h2]:tracking-[-0.7px]">
          <h2 id={titleId}>Trade calendar</h2>
          <span
            className="mt-2 block truncate text-[11px] leading-normal text-muted-foreground @max-[800px]:text-[10px]"
            title="Trades are grouped by their close date in this timezone"
          >
            {data?.account.name && <span>{data.account.name} · </span>}
            {timezone.replaceAll("_", " ")}
          </span>
        </div>
        <dl className="grid w-[min(66%,680px)] shrink-0 grid-cols-4 gap-6 @max-[1050px]:w-full @max-[640px]:grid-cols-2 @max-[640px]:gap-x-7 @max-[640px]:gap-y-5 [&_dt]:mb-2 [&_dt]:text-[11px] [&_dt]:leading-4 [&_dt]:whitespace-nowrap [&_dt]:text-muted-foreground [&_dd]:text-2xl [&_dd]:leading-[30px] [&_dd]:font-medium [&_dd]:tracking-[-0.65px] [&_dd]:tabular-nums [&_dd]:[overflow-wrap:anywhere]">
          <div>
            <dt>
              Net P&L <span className="sr-only">in USD</span>
            </dt>
            <dd className={lossClass(summary.net)}>
              {formatMoney(summary.net, true)}
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
      <div className="min-w-0 rounded-3xl border border-border bg-card p-6 [corner-shape:squircle] @max-[640px]:rounded-[20px] @max-[640px]:px-3 @max-[640px]:py-4">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 [&_h3]:mr-1 [&_h3]:text-base [&_h3]:font-[550]">
            <h3 aria-live="polite">{month.toFormat("MMMM yyyy")}</h3>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next month"
              onClick={() => changeMonth(1)}
            >
              <ChevronRight />
            </Button>
          </div>
          <div className="flex items-center gap-5 text-[11px] text-muted-foreground">
            <Button
              variant="outline"
              onClick={() => setMonth(today.startOf("month"))}
            >
              Today
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] table-fixed border-separate border-spacing-[6px] [&_th]:px-[14px] [&_th]:pb-3 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-medium [&_th]:text-muted-foreground [&_th:last-child]:w-[12%] [&_td]:overflow-hidden [&_td]:rounded-[18px] [&_td]:border [&_td]:border-border [&_td]:align-top [&_td]:[corner-shape:squircle]">
            <caption className="sr-only">
              {month.toFormat("MMMM yyyy")} closed trade results in USD
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
                  Week total
                </th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => {
                const weekSummary = summarizeTrades(
                  week.flatMap((day) => groups.get(day.toISODate()!) ?? []),
                );
                let weekTotal = "—";

                if (weekSummary.count > 0) {
                  weekTotal = formatMoney(weekSummary.net, true);
                }

                return (
                  <tr key={week[0].toISODate()}>
                    {week.map((day) => {
                      const date = day.toISODate()!;
                      const daySummary = summarizeTrades(
                        groups.get(date) ?? [],
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
                          `${formatMoney(daySummary.net)} net P&L`,
                        );
                      }

                      return (
                        <td
                          key={date}
                          className={cn(outside && "bg-muted [&_a]:opacity-55")}
                        >
                          <Link
                            href={{ pathname: "/journal/day", query: { date } }}
                            prefetch={false}
                            className="flex h-[116px] w-full cursor-pointer flex-col items-start rounded-[17px] px-4 py-[14px] text-left transition-colors duration-150 [corner-shape:squircle] hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                            aria-label={labelParts.join(", ")}
                          >
                            <span
                              className={cn(
                                "-mt-0.5 -ml-1 mb-[7px] grid size-[22px] place-items-center text-[11px]",
                                isToday &&
                                  "rounded-lg bg-foreground text-background [corner-shape:squircle]",
                                !isToday && "text-muted-foreground",
                              )}
                              aria-current={currentDate}
                            >
                              {day.day}
                            </span>
                            {daySummary.count > 0 && (
                              <span className="flex flex-col gap-[5px] [&_strong]:text-sm [&_strong]:font-medium [&_strong]:whitespace-nowrap [&_strong]:tabular-nums [&>span]:text-[10px] [&>span]:text-muted-foreground">
                                <strong
                                  className={profitAndLossClass(daySummary.net)}
                                >
                                  {formatMoney(daySummary.net, true)}
                                </strong>
                                <span>
                                  {daySummary.count}{" "}
                                  {tradeNoun(daySummary.count)}
                                </span>{" "}
                              </span>
                            )}
                          </Link>
                        </td>
                      );
                    })}
                    <td className="bg-muted px-4 pt-[43px] pb-[14px] [&_strong]:text-sm [&_strong]:font-medium [&_strong]:whitespace-nowrap [&_strong]:tabular-nums [&>span]:mt-[5px] [&>span]:block [&>span]:text-[10px] [&>span]:text-muted-foreground">
                      <strong className={lossClass(weekSummary.net)}>
                        {weekTotal}
                      </strong>
                      {weekSummary.count > 0 && (
                        <span>{weekSummary.count} trades</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
