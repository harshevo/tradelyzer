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

export type TradeImportProps = { onImport: (data: TradeFile) => void };
export function TradeImport({ onImport }: TradeImportProps) {
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const [busy, setBusy] = useState(false);
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
    <section aria-labelledby={titleId} className="import-panel">
      <div className="section-heading">
        <h2 id={titleId}>Import trades</h2>
      </div>
      <div
        className={cn("drop-zone", dragging && "dragging")}
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
          const files = event.dataTransfer.files;
          if (files.length !== 1) {
            setError("Drop one file at a time.");
            return;
          }
          void readFile(files[0]);
        }}
      >
        <div className="upload-icon">
          <Upload size={23} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <div className="upload-copy">
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
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Choose file
          <ArrowRight size={14} />
        </Button>
      </div>
      {filename && (
        <div className="file-status">
          <FileJson size={17} aria-hidden="true" />
          <span>{filename}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Clear selected file"
            onClick={reset}
          >
            <X />
          </Button>
        </div>
      )}
      {error && (
        <div className="import-error" role="alert">
          <strong>Couldn’t load these trades</strong>
          <p>{error}</p>
        </div>
      )}
      {preview && (
        <div className="import-preview">
          <div className="detail-heading">
            <h3>Ready to import</h3>
            <span>
              <Check size={15} aria-hidden="true" />
              Validation passed
            </span>
          </div>
          <p className="supporting-text">
            {preview.account.name} · {preview.trades.length.toLocaleString()}{" "}
            trades · {formatMoney(summarizeTrades(preview.trades).net, true)}{" "}
            net P&L
          </p>
          <div className="table-scroll">
            <table className="preview-table">
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
          <div className="preview-actions">
            <span>
              First {Math.min(5, preview.trades.length)} rows · replaces current
              data
            </span>
            <div>
              <Button
                size="lg"
                onClick={() => {
                  onImport(preview);
                  setSuccess(
                    `${preview.trades.length.toLocaleString()} trades loaded into the calendar.`,
                  );
                  setPreview(null);
                }}
              >
                Load {preview.trades.length.toLocaleString()} trades
                <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      )}
      {success && (
        <p className="import-success" role="status">
          <Check size={16} aria-hidden="true" />
          {success}
        </p>
      )}
    </section>
  );
}
