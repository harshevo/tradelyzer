"use client";

import { useId, useRef, useState } from "react";
import { Check, FileJson, Upload, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MAX_FILE_SIZE,
  parseJson,
  summarizeTrades,
  type TradeFile,
} from "@/features/trades/schemas/trade-file.schema";
import { errorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type TradeImportProps = { onImport: (data: TradeFile) => Promise<void> };
export function TradeImport({ onImport }: TradeImportProps) {
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const [busy, setBusy] = useState(false);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [filename, setFilename] = useState("");
  const [preview, setPreview] = useState<TradeFile | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function reset() {
    requestRef.current += 1;
    setBusy(false);
    setFilename("");
    setPreview(null);
    setError("");
    setSuccess("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function readFile(file: File) {
    if (savingRef.current) return;
    reset();
    const request = requestRef.current;
    setFilename(file.name);
    setBusy(true);
    try {
      if (file.size > MAX_FILE_SIZE)
        throw new Error("Choose a file smaller than 10 MB.");
      if (!/\.json$/i.test(file.name)) throw new Error("Choose a .json file.");
      const text = await file.text();
      if (request !== requestRef.current) return;
      setPreview(parseJson(text));
    } catch (cause) {
      if (request === requestRef.current)
        setError(errorMessage(cause, "The file could not be read."));
    } finally {
      if (request === requestRef.current) setBusy(false);
    }
  }

  let dropZoneTitle = "Drop a JSON file";

  if (busy) {
    dropZoneTitle = "Reading your file…";
  }

  return (
    <section
      aria-labelledby={titleId}
      className="mt-16 bg-transparent pb-3 @max-[800px]:mt-10 @max-[800px]:pb-0"
    >
      <div className="flex items-center justify-between gap-6 [&_h2]:text-[21px] [&_h2]:leading-[1.3] [&_h2]:font-[550] [&_h2]:tracking-[-0.5px] @max-[800px]:flex-wrap @max-[800px]:items-start @max-[800px]:gap-[14px]">
        <h2 id={titleId}>Import trades</h2>
      </div>
      <div
        className={cn(
          "mt-6 flex items-center gap-5 rounded-[22px] border border-dashed p-8 [corner-shape:squircle] @max-[800px]:flex-wrap @max-[800px]:gap-3 @max-[800px]:p-5",
          dragging && "border-primary bg-accent",
          !dragging && "border-border-strong bg-muted",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (savingRef.current) return;
          const files = event.dataTransfer.files;
          if (files.length !== 1) {
            setError("Drop one file at a time.");
            return;
          }
          void readFile(files[0]);
        }}
      >
        <div className="grid size-[46px] place-items-center rounded-xl border border-border bg-card text-muted-foreground [corner-shape:squircle]">
          <Upload size={23} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <div className="flex-1 [&_strong]:text-[13px] [&_strong]:font-[550] [&_p]:mt-[5px] [&_p]:text-[11px] [&_p]:text-muted-foreground @max-[800px]:basis-[65%]">
          <strong>{dropZoneTitle}</strong>
          <p>Up to 10 MB</p>
        </div>
        <input
          ref={inputRef}
          id={inputId}
          className="sr-only"
          type="file"
          accept=".json,application/json"
          tabIndex={-1}
          aria-label="Choose trade file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
          }}
        />
        <Button
          variant="outline"
          size="lg"
          disabled={busy || saving}
          onClick={() => inputRef.current?.click()}
        >
          Choose file
          <ArrowRight size={14} />
        </Button>
      </div>
      {filename && (
        <div className="mt-[22px] flex items-center gap-[9px] text-xs [&>span]:[overflow-wrap:anywhere] [&_button]:ml-auto">
          <FileJson size={17} aria-hidden="true" />
          <span>{filename}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Clear selected file"
            disabled={saving}
            onClick={reset}
          >
            <X />
          </Button>
        </div>
      )}
      {error && (
        <div
          className="mt-[15px] rounded-xl border border-danger-border bg-danger-surface p-[14px] text-xs text-destructive [corner-shape:squircle] [&_p]:mt-[5px] [&_p]:leading-[1.8] [&_p]:whitespace-pre-wrap"
          role="alert"
        >
          <strong>Couldn’t load these trades</strong>
          <p>{error}</p>
        </div>
      )}
      {preview && (
        <div className="mt-6 border-t border-border pt-6">
          <div className="flex items-center justify-between gap-[15px] [&_h3]:text-[15px] [&_h3]:font-[550] [&>span]:flex [&>span]:items-center [&>span]:gap-1.5 [&>span]:text-[11px] [&>span]:text-muted-foreground">
            <h3>Ready to import</h3>
            <span>
              <Check size={15} aria-hidden="true" />
              Validation passed
            </span>
          </div>
          <p className="mt-1.5 text-[13px] leading-[1.7] text-muted-foreground">
            {preview.account.name} · {preview.trades.length.toLocaleString()}{" "}
            trades · {formatMoney(summarizeTrades(preview.trades).net, true)}{" "}
            net P&L
          </p>
          <div className="overflow-x-auto">
            <table className="mt-[18px] w-full border-collapse text-left text-xs whitespace-nowrap tabular-nums [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-[10px] [&_th]:font-normal [&_th]:text-muted-foreground [&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-[13px] [&_th:last-child]:text-right [&_td:last-child]:text-right">
              <caption className="sr-only">First five validated trades</caption>
              <thead>
                <tr>
                  <th>Trade ID</th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Close time (as supplied)</th>
                  <th>Net P&L</th>
                </tr>
              </thead>
              <tbody>
                {preview.trades.slice(0, 5).map((trade) => (
                  <tr key={trade.id}>
                    <td>{trade.id}</td>
                    <td>{trade.symbol}</td>
                    <td className="capitalize">{trade.side}</td>
                    <td>{trade.closedAt}</td>
                    <td>{formatMoney(summarizeTrades([trade]).net, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-[18px] flex items-center justify-between gap-4 [&>span]:text-[11px] [&>span]:text-muted-foreground [&>div]:flex [&>div]:gap-2 @max-[800px]:flex-col @max-[800px]:gap-2">
            <span>
              First {Math.min(5, preview.trades.length)} rows · replaces current
              data
            </span>
            <div>
              <Button
                size="lg"
                disabled={saving}
                onClick={async () => {
                  if (savingRef.current) return;
                  savingRef.current = true;
                  setSaving(true);
                  setError("");
                  try {
                    await onImport(preview);
                    setSuccess(
                      `${preview.trades.length.toLocaleString()} trades saved in this browser.`,
                    );
                    setPreview(null);
                  } catch {
                    setError(
                      "Couldn’t save these trades. Check browser storage permissions or available space, then try again. Your previously saved trades are unchanged.",
                    );
                  } finally {
                    savingRef.current = false;
                    setSaving(false);
                  }
                }}
              >
                {saving && "Saving…"}
                {!saving &&
                  `Load ${preview.trades.length.toLocaleString()} trades`}
                <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      )}
      {success && (
        <p className="mt-[18px] flex items-center gap-2 text-xs" role="status">
          <Check size={16} aria-hidden="true" />
          {success}
        </p>
      )}
    </section>
  );
}
