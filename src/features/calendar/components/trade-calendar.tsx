"use client";

import { useId, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
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
  const selectedTrades = groups.get(selectedDay ?? "") ?? [];
  const changeMonth = (offset: number) => {
    setMonth((value) => value.plus({ months: offset }));
    setSelectedDay(null);
  };

  return (
    <section aria-labelledby={titleId} className="calendar-panel">
      <div className="calendar-overview">
        <div className="calendar-heading">
          <h2 id={titleId}>Trade calendar</h2>
          <span
            className="quiet-label"
            title="Trades are grouped by their close date in this timezone"
          >
            {data?.account.name && <span>{data.account.name} · </span>}
            {timezone.replaceAll("_", " ")}
          </span>
        </div>
        <dl className="calendar-metrics">
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
      <div className="calendar-toolbar">
        <div className="month-navigation">
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
        <div className="calendar-legend">
          <Button
            variant="outline"
            onClick={() => {
              setMonth(today.startOf("month"));
              setSelectedDay(null);
            }}
          >
            Today
          </Button>
        </div>
      </div>
      <div className="calendar-scroll">
        <table className="trade-calendar">
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
                className="week-heading"
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
                    const daySummary = summarizeTrades(groups.get(date) ?? []);
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
                      labelParts.push(`${formatMoney(daySummary.net)} net P&L`);
                    }

                    return (
                      <td key={date} className={cn(outside && "outside-month")}>
                        <button
                          type="button"
                          className={cn(
                            "day-cell",
                            selectedDay === date && "selected-day",
                          )}
                          onClick={() => setSelectedDay(date)}
                          aria-pressed={selectedDay === date}
                          aria-label={labelParts.join(", ")}
                        >
                          <span
                            className={cn(
                              "day-number",
                              isToday && "today-number",
                            )}
                            aria-current={currentDate}
                          >
                            {day.day}
                          </span>
                          {daySummary.count > 0 && (
                            <span className="day-results">
                              <strong
                                className={profitAndLossClass(daySummary.net)}
                              >
                                {formatMoney(daySummary.net, true)}
                              </strong>
                              <span>
                                {daySummary.count} {tradeNoun(daySummary.count)}
                              </span>{" "}
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td className="week-total">
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
      {selectedDay && (
        <div className="day-detail">
          <div className="detail-heading">
            <h3>{DateTime.fromISO(selectedDay).toFormat("EEEE, MMMM d")}</h3>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close day details"
              onClick={() => setSelectedDay(null)}
            >
              <X />
            </Button>
          </div>
          {selectedTrades.length > 0 && (
            <div className="table-scroll">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>Symbol / ID</th>
                    <th>Side</th>
                    <th>Volume</th>
                    <th>Opened</th>
                    <th>Closed</th>
                    <th>Net P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTrades.map((trade) => (
                    <tr key={trade.id}>
                      <td>
                        <strong>{trade.symbol}</strong>
                        <span className="trade-id">{trade.id}</span>
                      </td>
                      <td className="capitalize">{trade.side}</td>
                      <td>{trade.volume}</td>
                      <td>
                        {DateTime.fromISO(trade.openedAt, {
                          zone: timezone,
                        }).toFormat("MMM d, HH:mm")}
                      </td>
                      <td>
                        {DateTime.fromISO(trade.closedAt, {
                          zone: timezone,
                        }).toFormat("MMM d, HH:mm")}
                      </td>
                      <td>{formatMoney(summarizeTrades([trade]).net, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {selectedTrades.length === 0 && (
            <p className="empty-detail">No trades</p>
          )}
        </div>
      )}
    </section>
  );
}
