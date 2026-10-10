"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DateTime } from "luxon";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { WorkspaceSidebar } from "@/components/layout/workspace-sidebar";
import { Button } from "@/components/ui/button";
import { journalDatabase } from "@/lib/db/journal-database";
import { groupByCloseDay } from "@/features/calendar/utils/calendar";
import {
  emptyJournal,
  exceedsLossLimit,
  isJournalDate,
  journalSchema,
  type JournalEntry,
} from "@/features/journal/schemas/journal.schema";
import {
  summarizeTrades,
  type Trade,
} from "@/features/trades/schemas/trade-file.schema";
import {
  formatWinRate,
  profitAndLossClass,
} from "@/features/trades/utils/trade-display";
import { formatMoney, toCents } from "@/lib/money";
import { cn } from "@/lib/utils";

import type { Screenshot } from "@/features/journal/utils/screenshots";
import { JournalScreenshots } from "./journal-screenshots";

const inputClass =
  "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/15 max-[640px]:min-w-0 max-[640px]:px-2.5 max-[640px]:py-2 max-[640px]:text-xs";
const labelClass =
  "flex flex-col gap-2 text-xs font-medium text-muted-foreground max-[640px]:text-[10px]";
const defaultTags = ["FOMO", "Moved stop", "Overtraded", "Revenge trade"];

const dayNavigation = [
  { offset: -1, label: "Previous day", Icon: ChevronLeft },
  { offset: 1, label: "Next day", Icon: ChevronRight },
];

function toggleVariant(
  isSelected: boolean,
  unselectedVariant: "outline" | "ghost",
) {
  if (isSelected) {
    return "default";
  }

  return unselectedVariant;
}

export function DayJournal({ date }: { date: string }) {
  const [retry, setRetry] = useState(0);
  const valid = isJournalDate(date);
  const stored = useLiveQuery(async () => {
    if (!valid) return null;
    try {
      const [data, entry, tags] = await Promise.all([
        journalDatabase.loadTrades(),
        journalDatabase.journals.get(date),
        journalDatabase.tags.toArray(),
      ]);
      return { data, entry, tags, error: false };
    } catch {
      return { data: null, entry: undefined, tags: [], error: true };
    }
  }, [date, valid, retry]);

  function renderJournal() {
    if (!valid) {
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-medium">Choose a valid journal date</h1>
          <Link href="/" className="text-sm text-primary">
            Back to calendar
          </Link>
        </div>
      );
    }

    if (stored?.error) {
      return (
        <div role="alert" className="space-y-4">
          <p>
            Couldn’t read your saved journal. Check browser storage and try
            again.
          </p>
          <Button onClick={() => setRetry(retry + 1)}>Try again</Button>
        </div>
      );
    }

    if (stored) {
      return (
        <JournalEditor
          key={date}
          date={date}
          trades={
            groupByCloseDay(
              stored.data?.trades ?? [],
              DateTime.local().zoneName,
            ).get(date) ?? []
          }
          initial={stored.entry ?? emptyJournal(date)}
          hasSaved={!!stored.entry}
          sharedTags={stored.tags.map((tag) => tag.name)}
        />
      );
    }

    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading journal…
      </p>
    );
  }

  return (
    <div className="flex min-h-dvh bg-background text-foreground max-[800px]:flex-col">
      <WorkspaceSidebar />
      <main className="mx-auto w-full min-w-0 max-w-[1400px] flex-1 px-16 py-12 max-[800px]:px-4 max-[800px]:py-5">
        {" "}
        {renderJournal()}
      </main>
    </div>
  );
}

function JournalEditor({
  date,
  trades,
  initial,
  hasSaved,
  sharedTags,
}: {
  date: string;
  trades: Trade[];
  initial: JournalEntry;
  hasSaved: boolean;
  sharedTags: string[];
}) {
  const [entry, setEntry] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [images, setImages] = useState<Screenshot[] | null>(null);
  const [savedImages, setSavedImages] = useState<Screenshot[] | null>(null);
  const [preparingImages, setPreparingImages] = useState(false);
  const imagesLoaded = useCallback((loaded: Screenshot[]) => {
    setImages((current) => current ?? loaded);
    setSavedImages((current) => current ?? loaded);
  }, []);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(() => {
    if (hasSaved) {
      return "Saved in this browser";
    }

    return "No journal saved yet";
  });
  const [customTag, setCustomTag] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const attachmentsChanged = useCallback((draft: Screenshot[]) => {
    setImages(draft);
    setStatus("");
  }, []);
  const day = DateTime.fromISO(date);
  const zone = DateTime.local().zoneName;
  const summary = summarizeTrades(trades);
  let largestWin = "—";
  let largestLoss = "—";

  if (summary.largestWin) {
    largestWin = formatMoney(summary.largestWin, true);
  }

  if (summary.largestLoss) {
    largestLoss = formatMoney(summary.largestLoss);
  }

  const screenshotsChanged =
    JSON.stringify(images?.map((image) => image.id)) !==
    JSON.stringify(savedImages?.map((image) => image.id));
  const dirty =
    JSON.stringify(entry) !== JSON.stringify(saved) || screenshotsChanged;
  const validLoss = journalSchema.shape.maxLoss.safeParse(
    entry.maxLoss,
  ).success;
  const overLimit = validLoss && exceedsLossLimit(summary.net, entry.maxLoss);
  const tags = [...new Set([...defaultTags, ...sharedTags, ...entry.tags])];

  useEffect(() => {
    if (!dirty && !saving && !addingTag) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const beforeNavigate = (event: MouseEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest("a[href]")
      )
        return;
      if (
        saving ||
        addingTag ||
        !window.confirm("Leave this day without saving your changes?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeNavigate, true);
    };
  }, [dirty, saving, addingTag]);

  function update<K extends keyof JournalEntry>(
    field: K,
    value: JournalEntry[K],
  ) {
    setEntry((current) => ({ ...current, [field]: value }));
    setStatus("");
    setError("");
  }
  function toggleMood(mood: number) {
    if (entry.mood === mood) {
      update("mood", null);
      return;
    }

    update("mood", mood);
  }

  function toggleTag(tag: string) {
    if (entry.tags.includes(tag)) {
      update(
        "tags",
        entry.tags.filter((value) => value !== tag),
      );
      return;
    }

    update("tags", [...entry.tags, tag]);
  }
  async function addTag() {
    if (savingRef.current) return;
    const tag = customTag.trim();
    if (!tag) return;
    if (entry.tags.length >= 30 && !entry.tags.includes(tag)) {
      setError("Choose up to 30 mistake tags.");
      return;
    }
    savingRef.current = true;
    setAddingTag(true);
    setError("");
    try {
      const name = await journalDatabase.addTag(tag);
      if (!entry.tags.includes(name)) update("tags", [...entry.tags, name]);
      setCustomTag("");
    } catch {
      setError("Couldn’t save this tag. Check browser storage and try again.");
    } finally {
      savingRef.current = false;
      setAddingTag(false);
    }
  }
  async function save() {
    if (savingRef.current || preparingImages || !images || !savedImages) return;
    const parsed = journalSchema.safeParse(entry);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await journalDatabase.saveJournal(parsed.data, {
        added: images.filter(
          (image) => !savedImages.some((saved) => saved.id === image.id),
        ),
        removed: savedImages
          .filter((saved) => !images.some((image) => image.id === saved.id))
          .map((image) => image.id),
      });
      setSaved(parsed.data);
      setSavedImages(images);
      setEntry(parsed.data);
      setStatus("Saved in this browser");
    } catch {
      setError(
        "Couldn’t save your journal. Your changes are still here; check browser storage and try again.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  let saveStatus = status || "No unsaved changes";

  if (saving) {
    saveStatus = "Saving…";
  } else if (dirty) {
    saveStatus = "Unsaved changes";
  }

  return (
    <>
      {" "}
      <div className="mb-10 flex items-center justify-between max-[640px]:mb-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft size={15} /> Calendar
        </Link>
        <div className="flex gap-1">
          {dayNavigation.map(({ offset, label, Icon }) => (
            <Link
              key={offset}
              href={{
                pathname: "/journal/day",
                query: { date: day.plus({ days: offset }).toISODate() },
              }}
              aria-label={label}
              className="grid size-9 place-items-center rounded-xl hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Icon size={18} />
            </Link>
          ))}
        </div>
      </div>
      <header className="mb-10 max-[640px]:mb-5">
        <p className="mb-2 text-xs text-muted-foreground">
          Daily journal · {day.toFormat("yyyy")}
        </p>
        <h1 className="text-3xl font-medium tracking-tight max-[640px]:text-xl">
          {day.toFormat("cccc, d MMMM")}
        </h1>
        <p className="mt-3 text-xs text-muted-foreground max-[640px]:mt-2 max-[640px]:text-[9px]">
          {zone.replaceAll("_", " ")} · Trades grouped by local close date
        </p>
      </header>
      <dl className="mb-10 grid grid-cols-5 gap-6 py-6 text-center max-[640px]:mb-6 max-[640px]:py-3 max-[800px]:gap-2 max-[800px]:[&_dt]:text-[8px] max-[800px]:[&_dd]:text-[clamp(11px,2.6vw,18px)] [&_dt]:mb-2 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:text-2xl [&_dd]:font-medium [&_dd]:tabular-nums">
        {[
          [
            "Net P&L",
            formatMoney(summary.net, true),
            profitAndLossClass(summary.net),
          ],
          ["Win rate", formatWinRate(summary.wins, summary.count), ""],
          ["Trades", String(summary.count), ""],
          ["Largest win", largestWin, "text-profit"],
          ["Largest loss", largestLoss, "text-loss"],
        ].map(([label, value, color]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={color}>{value}</dd>
          </div>
        ))}
      </dl>
      {overLimit && (
        <div
          role="alert"
          className="mb-8 flex items-center gap-3 max-[640px]:mb-5 max-[640px]:p-3 max-[640px]:text-xs rounded-xl border border-danger-border bg-danger-surface p-4 text-sm text-destructive"
        >
          <AlertTriangle size={18} className="shrink-0" /> Your net loss exceeds
          your {formatMoney(toCents(entry.maxLoss))} daily limit.
        </div>
      )}
      <section aria-labelledby="day-trades" className="mb-12 max-[640px]:mb-7">
        <h2
          id="day-trades"
          className="mb-5 max-[640px]:mb-3 text-lg font-medium max-[640px]:text-base"
        >
          Trades
        </h2>
        {trades.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[760px] max-[640px]:min-w-0 max-[640px]:table-fixed max-[640px]:text-[9px] max-[640px]:[&_th]:px-1 max-[640px]:[&_th]:py-2 max-[640px]:[&_td]:px-1 max-[640px]:[&_td]:py-2.5 max-[640px]:[&_td]:[overflow-wrap:anywhere] text-left text-xs [&_th]:bg-muted [&_th]:px-4 [&_th]:py-3 [&_th]:font-normal [&_th]:text-muted-foreground [&_td]:border-t [&_td]:border-border [&_td]:px-4 [&_td]:py-4 [&_td]:tabular-nums">
              <caption className="sr-only">
                Completed trades for {date}; times in {zone}
              </caption>
              <thead>
                <tr>
                  {[
                    "Symbol",
                    "Side",
                    "Lots",
                    "Opened",
                    "Closed",
                    "Stop loss",
                    "Net P&L",
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className={cn(label === "Net P&L" && "text-right")}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade.id}>
                    <td className="font-medium">{trade.symbol}</td>
                    <td className="capitalize">{trade.side}</td>
                    <td>{trade.volume}</td>
                    {[trade.openedAt, trade.closedAt].map((instant, index) => (
                      <td key={index}>
                        <time
                          dateTime={instant}
                          title={DateTime.fromISO(instant, { zone }).toFormat(
                            "dd MMM yyyy, HH:mm",
                          )}
                        >
                          <span className="max-[640px]:hidden">
                            {DateTime.fromISO(instant, { zone }).toFormat(
                              "dd MMM, HH:mm",
                            )}
                          </span>
                          <span className="hidden max-[640px]:block">
                            {DateTime.fromISO(instant, { zone }).toFormat(
                              "d MMM",
                            )}
                            <span className="block text-muted-foreground">
                              {DateTime.fromISO(instant, { zone }).toFormat(
                                "HH:mm",
                              )}
                            </span>
                          </span>
                        </time>
                      </td>
                    ))}
                    <td>
                      {trade.stopLoss === null && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-danger-surface px-2 py-1 text-loss max-[640px]:gap-0.5 max-[640px]:px-1 max-[640px]:[&_svg]:size-2">
                          <AlertTriangle size={12} />
                          <span className="max-[640px]:hidden">
                            No stop loss
                          </span>
                          <span
                            className="hidden max-[640px]:inline"
                            aria-label="No stop loss"
                          >
                            None
                          </span>
                        </span>
                      )}
                      {trade.stopLoss}
                    </td>
                    <td
                      className={cn(
                        "text-right font-medium",
                        profitAndLossClass(toCents(trade.netPnl)),
                      )}
                    >
                      {formatMoney(toCents(trade.netPnl), true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {trades.length === 0 && (
          <p className="py-6 text-sm text-muted-foreground">
            No completed trades for this day. You can still write a plan and
            review.
          </p>
        )}
      </section>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset
          disabled={saving || addingTag}
          className="grid min-w-0 grid-cols-2 gap-12 disabled:opacity-70 max-[900px]:grid-cols-1 max-[900px]:gap-10 max-[640px]:gap-6"
        >
          <section
            aria-labelledby="plan-heading"
            className="min-w-0 space-y-5 max-[640px]:space-y-3"
          >
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">
                BEFORE THE SESSION
              </p>
              <h2
                id="plan-heading"
                className="text-lg font-medium max-[640px]:text-base"
              >
                Pre-market plan
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className={labelClass}>
                Market bias
                <select
                  className={inputClass}
                  value={entry.bias}
                  onChange={(event) =>
                    update("bias", event.target.value as JournalEntry["bias"])
                  }
                >
                  <option value="neutral">Neutral</option>
                  <option value="bullish">Bullish</option>
                  <option value="bearish">Bearish</option>
                </select>
              </label>
              <label className={labelClass}>
                Max daily loss ($)
                <input
                  className={inputClass}
                  inputMode="decimal"
                  placeholder="e.g. 250.00"
                  value={entry.maxLoss}
                  aria-invalid={!validLoss}
                  onChange={(event) => update("maxLoss", event.target.value)}
                />
              </label>
            </div>
            <label className={labelClass}>
              Key levels
              <textarea
                className={inputClass}
                rows={3}
                maxLength={10000}
                placeholder="Support, resistance, levels to watch…"
                value={entry.levels}
                onChange={(event) => update("levels", event.target.value)}
              />
            </label>
            <label className={labelClass}>
              The plan
              <textarea
                className={inputClass}
                rows={6}
                maxLength={10000}
                placeholder="What setups are you looking for? When will you stay out?"
                value={entry.plan}
                onChange={(event) => update("plan", event.target.value)}
              />
            </label>
          </section>
          <section
            aria-labelledby="review-heading"
            className="min-w-0 space-y-5 max-[640px]:space-y-3"
          >
            <div>
              <p className="mb-1 text-[11px] text-muted-foreground">
                AFTER THE SESSION
              </p>
              <h2
                id="review-heading"
                className="text-lg font-medium max-[640px]:text-base"
              >
                Session review
              </h2>
            </div>
            <label className={labelClass}>
              What went well
              <textarea
                className={inputClass}
                rows={3}
                maxLength={10000}
                placeholder="Good decisions worth repeating…"
                value={entry.wentWell}
                onChange={(event) => update("wentWell", event.target.value)}
              />
            </label>
            <label className={labelClass}>
              Mistakes & lessons
              <textarea
                className={inputClass}
                rows={3}
                maxLength={10000}
                placeholder="What would you do differently?"
                value={entry.mistakes}
                onChange={(event) => update("mistakes", event.target.value)}
              />
            </label>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Mistake tags
              </p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Button
                    type="button"
                    key={tag}
                    variant={toggleVariant(entry.tags.includes(tag), "outline")}
                    size="sm"
                    className="max-[640px]:text-[10px]"
                    aria-pressed={entry.tags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  aria-label="Custom mistake tag"
                  className={inputClass}
                  maxLength={60}
                  placeholder="Add your own tag"
                  value={customTag}
                  onChange={(event) => setCustomTag(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void addTag();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  aria-label="Add mistake tag"
                  onClick={() => void addTag()}
                >
                  <Plus />
                </Button>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Mood · 1 low, 5 great
              </p>
              <div
                className="flex gap-2"
                role="group"
                aria-label="Session mood"
              >
                {[1, 2, 3, 4, 5].map((mood) => (
                  <Button
                    type="button"
                    key={mood}
                    size="icon"
                    className="max-[640px]:size-7 max-[640px]:text-xs"
                    variant={toggleVariant(entry.mood === mood, "outline")}
                    aria-label={`Mood ${mood}`}
                    aria-pressed={entry.mood === mood}
                    onClick={() => toggleMood(mood)}
                  >
                    {mood}
                  </Button>
                ))}
              </div>
            </div>
          </section>
        </fieldset>
        <JournalScreenshots
          date={date}
          images={images}
          onLoad={imagesLoaded}
          onChange={attachmentsChanged}
          onBusy={setPreparingImages}
          disabled={saving}
          hasChanges={screenshotsChanged}
        />
        <div className="sticky bottom-0 max-[640px]:static mt-10 flex items-center justify-between gap-4 bg-background py-5 max-[640px]:mt-6 max-[640px]:py-3">
          <div className="text-xs text-muted-foreground">
            <p role="status"> {saveStatus}</p>
            {error && (
              <p role="alert" className="mt-2 text-loss">
                {error}
              </p>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={
              saving || addingTag || preparingImages || !images || !dirty
            }
          >
            {saving && "Saving…"}
            {!saving && "Save journal"}
          </Button>
        </div>
      </form>
    </>
  );
}
