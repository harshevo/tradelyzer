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
  planTemplateSchema,
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
  "w-full min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/15 max-[640px]:px-2.5 max-[640px]:text-xs";
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
      const [data, entry, tags, template] = await Promise.all([
        journalDatabase.loadTrades(),
        journalDatabase.journals.get(date),
        journalDatabase.tags.toArray(),
        journalDatabase.templates.get("default"),
      ]);
      return { data, entry, tags, template, error: false };
    } catch {
      return {
        data: null,
        entry: undefined,
        tags: [],
        template: undefined,
        error: true,
      };
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
          initial={stored.entry ?? emptyJournal(date, stored.template)}
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
  const [saved, setSaved] = useState(() => {
    if (hasSaved) {
      return initial;
    }

    return emptyJournal(date);
  });
  const [images, setImages] = useState<Screenshot[] | null>(null);
  const [savedImages, setSavedImages] = useState<Screenshot[] | null>(null);
  const [preparingImages, setPreparingImages] = useState(false);
  const imagesLoaded = useCallback((loaded: Screenshot[]) => {
    setImages((current) => current ?? loaded);
    setSavedImages((current) => current ?? loaded);
  }, []);
  const [saving, setSaving] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateStatus, setTemplateStatus] = useState("");
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(() => {
    if (hasSaved) {
      return "Saved";
    }

    return "";
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
    if (!dirty && !saving && !addingTag && !savingTemplate) return;
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
        savingTemplate ||
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
  }, [dirty, saving, addingTag, savingTemplate]);

  function update<K extends keyof JournalEntry>(
    field: K,
    value: JournalEntry[K],
  ) {
    setEntry((current) => ({ ...current, [field]: value }));
    setStatus("");
    setError("");
    if (["bias", "levels", "maxLoss", "plan"].includes(field))
      setTemplateStatus("");
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
  async function saveTemplate() {
    if (savingRef.current) return;
    const parsed = planTemplateSchema.safeParse(entry);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    savingRef.current = true;
    setSavingTemplate(true);
    setTemplateStatus("");
    setError("");
    try {
      await journalDatabase.savePlanTemplate(parsed.data);
      setTemplateStatus("Default saved");
    } catch {
      setError(
        "Couldn’t save your default plan. Check browser storage and try again.",
      );
    } finally {
      savingRef.current = false;
      setSavingTemplate(false);
    }
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
      setStatus("Saved");
    } catch {
      setError(
        "Couldn’t save your journal. Your changes are still here; check browser storage and try again.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  let saveStatus = status;

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
        <h1 className="text-3xl font-medium tracking-tight max-[640px]:text-xl">
          {day.toFormat("cccc, d MMMM yyyy")}
        </h1>
        <p className="mt-3 text-xs text-muted-foreground max-[640px]:mt-2 max-[640px]:text-[9px]">
          {zone.replaceAll("_", " ")}
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
          <p className="py-6 text-sm text-muted-foreground">No trades.</p>
        )}
      </section>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset
          disabled={saving || addingTag || savingTemplate}
          className="grid min-w-0 grid-cols-2 gap-12 disabled:opacity-70 max-[900px]:grid-cols-1 max-[900px]:gap-10 max-[640px]:gap-6"
        >
          <section
            aria-labelledby="plan-heading"
            className="min-w-0 space-y-5 max-[640px]:space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="plan-heading"
                className="text-lg font-medium max-[640px]:text-base"
              >
                Pre-market plan
              </h2>
              <div className="flex items-center gap-2">
                {templateStatus && (
                  <span
                    role="status"
                    className="text-[11px] text-muted-foreground"
                  >
                    {templateStatus}
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground max-[640px]:text-[10px]"
                  title="Save bias, levels, daily loss limit and plan for new days. Existing journals stay unchanged."
                  onClick={() => void saveTemplate()}
                >
                  {savingTemplate && "Saving…"}
                  {!savingTemplate && "Save as default"}
                </Button>
              </div>
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
                  placeholder="250.00"
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
                value={entry.levels}
                onChange={(event) => update("levels", event.target.value)}
              />
            </label>
            <label className={labelClass}>
              Plan
              <textarea
                className={inputClass}
                rows={4}
                maxLength={10000}
                value={entry.plan}
                onChange={(event) => update("plan", event.target.value)}
              />
            </label>
          </section>
          <section
            aria-labelledby="review-heading"
            className="min-w-0 space-y-5 max-[640px]:space-y-3"
          >
            <div className="flex min-h-7 items-center">
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
                value={entry.mistakes}
                onChange={(event) => update("mistakes", event.target.value)}
              />
            </label>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Mistake tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Button
                    type="button"
                    key={tag}
                    variant={toggleVariant(entry.tags.includes(tag), "ghost")}
                    size="sm"
                    className={cn(
                      "rounded-md text-xs max-[640px]:text-[10px]",
                      !entry.tags.includes(tag) &&
                        "bg-muted text-muted-foreground",
                    )}
                    aria-pressed={entry.tags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
              <div className="mt-3 flex max-w-72 items-center gap-1">
                <input
                  aria-label="Custom mistake tag"
                  className={`${inputClass} h-8 text-xs`}
                  maxLength={60}
                  placeholder="Add a tag…"
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
                  variant="ghost"
                  size="icon"
                  aria-label="Add mistake tag"
                  onClick={() => void addTag()}
                >
                  <Plus />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Mood
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  1 low · 5 great
                </p>
              </div>
              <div
                className="inline-flex gap-1 rounded-lg bg-muted p-1"
                role="group"
                aria-label="Session mood"
              >
                {[1, 2, 3, 4, 5].map((mood) => (
                  <Button
                    type="button"
                    key={mood}
                    size="icon"
                    className="rounded-md text-xs max-[640px]:size-7"
                    variant={toggleVariant(entry.mood === mood, "ghost")}
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
          disabled={saving || savingTemplate}
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
              saving ||
              savingTemplate ||
              addingTag ||
              preparingImages ||
              !images ||
              !dirty
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
