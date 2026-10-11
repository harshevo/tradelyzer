"use client";

import { useRef, useState, type ClipboardEvent } from "react";
import { ArrowRight, Check, Upload, X } from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { Tabs } from "@base-ui/react/tabs";
import { Button } from "@/components/ui/button";
import {
  exchanges,
  type Credentials,
  type Exchange,
} from "@/features/imports/schemas/exchange.schema";
import {
  summarizeTrades,
  validateTradeFile,
  type TradeFile,
} from "@/features/trades/schemas/trade-file.schema";
import { errorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { TradeImport } from "./trade-import";

type Market = "spot" | "perpetual";
type ImportAction = "connect" | "import" | "sample" | "save";
type Preview = {
  data: TradeFile | null;
  warnings: string[];
  fills: number;
  sample?: boolean;
};

const DAY_IN_MILLISECONDS = 86_400_000;
const fieldClass =
  "mt-2 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
const labelClass = "block text-xs text-muted-foreground";
const importSources = [
  ["exchange", "Exchange"],
  ["file", "File upload"],
];
const exchangeNames = Object.keys(exchanges) as Exchange[];

function dateFromToday(offsetInDays: number): string {
  return new Date(Date.now() + offsetInDays * DAY_IN_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
}

function previewTitle(preview: Preview): string {
  if (preview.sample) {
    return "Sample preview";
  }

  if (preview.data) {
    return "Import preview";
  }

  return "No completed trades";
}

function previewSummary(preview: Preview): string {
  if (!preview.data) {
    return `${preview.fills.toLocaleString()} fills`;
  }

  const net = formatMoney(
    summarizeTrades(preview.data.trades).net,
    true,
    preview.data.account.currency,
  );

  return `${preview.data.trades.length.toLocaleString()} trades · ${net} net`;
}

function saveLabel(preview: Preview, tradeCount: number, isSaving: boolean) {
  if (isSaving) {
    return "Saving…";
  }

  if (preview.sample) {
    return "Import sample trades";
  }

  return `Import ${tradeCount.toLocaleString()} trades`;
}

export function ExchangeImport({
  onImport,
}: {
  onImport: (data: TradeFile) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("exchange");
  const credentials = useRef<Partial<Record<Exchange, Credentials>>>({});
  const [connected, setConnected] = useState<Exchange[]>([]);
  const [selected, setSelected] = useState<Exchange>("binance");
  const [binanceMarket, setBinanceMarket] = useState<Market>("spot");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [symbols, setSymbols] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [today, setToday] = useState("");
  const [balance, setBalance] = useState("0.00");
  const [busy, setBusy] = useState("");
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const exchangeInfo = exchanges[selected];
  const isConnected = connected.includes(selected);
  const isBusy = busy !== "";
  const isCoinbase = selected === "coinbase";
  let marketValue: Market = "spot";
  let quoteCurrency = "USDT";
  let keyLabel = "API key";
  let keyPlaceholder = "Paste API key";
  let secretLabel = "API secret";
  let secretPlaceholder = "Paste API secret";
  let connectLabel = `Connect ${exchangeInfo.name}`;
  let previewLabel = "Preview history";
  let sampleLabel = "Try sample history";
  let replaceNotice = "Importing this history";

  if (selected === "binance") {
    marketValue = binanceMarket;
  } else if (selected === "bybit") {
    marketValue = "perpetual";
  }

  if (isCoinbase) {
    quoteCurrency = "USD";
    keyLabel = "API key name";
    keyPlaceholder = "organizations/…/apiKeys/…";
    secretLabel = "Private key (ECDSA PEM)";
    secretPlaceholder = "Paste full PEM key";
  }

  if (busy === "connect") {
    connectLabel = "Connecting…";
  }

  if (busy === "import") {
    previewLabel = "Fetching history…";
  }

  if (busy === "sample") {
    sampleLabel = "Loading sample…";
  }

  if (preview?.sample) {
    replaceNotice = "Importing sample history";
  }

  function clearPreview() {
    setPreview(null);
    setError("");
    setStatus("");
  }

  function selectExchange(exchange: Exchange) {
    if (busyRef.current) {
      return;
    }

    setSelected(exchange);
    setApiKey("");
    setApiSecret("");
    setSymbols("");
    clearPreview();
  }

  function disconnect(exchange: Exchange) {
    delete credentials.current[exchange];
    setConnected((current) => current.filter((item) => item !== exchange));
    clearPreview();
  }

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      setToday(dateFromToday(0));

      if (!start) {
        setStart(dateFromToday(-30));
      }

      if (!end) {
        setEnd(dateFromToday(0));
      }
    } else {
      setApiKey("");
      setApiSecret("");
      setStatus("");
    }
  }

  function pasteSecret(event: ClipboardEvent<HTMLInputElement>) {
    if (!isCoinbase) {
      return;
    }

    event.preventDefault();
    setApiSecret(event.clipboardData.getData("text").replace(/\r?\n/g, "\\n"));
  }

  async function savePreview() {
    if (!preview?.data) {
      return;
    }

    await onImport(preview.data);
    setStatus(
      `${preview.data.trades.length.toLocaleString()} trades imported into your calendar.`,
    );
    setPreview(null);
  }

  async function requestExchange(action: "connect" | "import" | "sample") {
    let keys: Credentials | undefined;
    let importFields = {};

    setPreview(null);

    if (action === "connect") {
      keys = { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() };
    } else if (action === "import") {
      keys = credentials.current[selected];
    }

    if (!keys && action !== "sample") {
      throw new Error("Connect this exchange first.");
    }

    if (action === "import") {
      const endOfRange =
        Date.parse(`${end}T00:00:00.000Z`) + DAY_IN_MILLISECONDS;

      importFields = {
        symbols: symbols
          .toUpperCase()
          .split(/[\s,]+/)
          .filter(Boolean),
        start: `${start}T00:00:00.000Z`,
        end: new Date(endOfRange).toISOString(),
        startingBalance: balance,
      };
    }

    const response = await fetch("/api/exchanges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exchange: selected,
        market: binanceMarket,
        action,
        ...keys,
        ...importFields,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Couldn’t connect to the exchange.");
    }

    if (action === "connect" && keys) {
      if (result.connected !== true) {
        throw new Error("Connection could not be verified.");
      }

      credentials.current[selected] = keys;
      setConnected((current) => [...new Set([...current, selected])]);
      setApiKey("");
      setApiSecret("");
      setStatus("");
      return;
    }

    let data: TradeFile | null = null;

    if (result.data) {
      data = validateTradeFile(result.data);
    }

    setPreview({ ...result, data });
  }

  async function run(action: ImportAction) {
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    setBusy(action);
    setError("");
    setStatus("");

    try {
      if (action === "save") {
        await savePreview();
      } else {
        await requestExchange(action);
      }
    } catch (cause) {
      setError(
        errorMessage(
          cause,
          "Couldn’t complete the import. Your saved trades are unchanged.",
        ),
      );
    } finally {
      busyRef.current = false;
      setBusy("");
    }
  }

  const marketField = (
    <label className={labelClass}>
      Market
      <select
        aria-label="Market"
        className={`${fieldClass} min-w-0 text-foreground`}
        disabled={isBusy || selected !== "binance"}
        value={marketValue}
        onChange={(event) => {
          setBinanceMarket(event.target.value as Market);
          disconnect("binance");
        }}
      >
        {selected !== "bybit" && <option value="spot">Spot</option>}
        {!isCoinbase && <option value="perpetual">USDT perpetuals</option>}
      </select>
    </label>
  );

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger render={<Button size="sm" className="h-9 gap-2 px-3" />}>
        <Upload size={16} aria-hidden="true" /> Import trades
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-[3px]" />
        <Dialog.Popup className="@container fixed top-1/2 left-1/2 z-50 h-[640px] max-h-[calc(100dvh_-_32px)] w-[calc(100%_-_32px)] max-w-[720px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-3xl bg-card p-8 text-foreground shadow-xl outline-none max-[600px]:rounded-2xl max-[600px]:p-5">
          <div className="relative flex justify-center text-center">
            <div>
              <Dialog.Title className="text-xl font-medium tracking-tight">
                Import trades
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-xs text-muted-foreground">
                From an exchange or JSON file
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-0 right-0"
                  aria-label="Close import trades"
                />
              }
            >
              <X aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Tabs.Root
            value={source}
            onValueChange={(value) => {
              if (!busyRef.current) {
                setSource(String(value));
              }
            }}
            className="mt-7"
          >
            <Tabs.List
              aria-label="Import source"
              className="mx-auto grid max-w-[320px] grid-cols-2 gap-1 rounded-xl bg-muted p-1"
            >
              {importSources.map(([value, name]) => (
                <Tabs.Tab
                  key={value}
                  value={value}
                  disabled={isBusy && value !== source}
                  className="min-h-9 rounded-lg px-4 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active]:bg-card data-[active]:text-foreground data-[active]:shadow-sm"
                >
                  {name}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            <Tabs.Panel
              value="exchange"
              keepMounted
              className="outline-none data-[hidden]:hidden"
            >
              <div
                className="mt-7 grid grid-cols-3 gap-2 rounded-xl bg-muted p-1"
                role="group"
                aria-label="Exchanges"
              >
                {exchangeNames.map((exchange) => (
                  <button
                    key={exchange}
                    type="button"
                    aria-pressed={selected === exchange}
                    disabled={isBusy}
                    onClick={() => selectExchange(exchange)}
                    className={cn(
                      "flex min-h-9 items-center justify-center gap-2 rounded-lg px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60",
                      selected === exchange &&
                        "bg-card font-medium text-foreground shadow-sm",
                      selected !== exchange &&
                        "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {exchanges[exchange].name}
                    {connected.includes(exchange) && (
                      <Check
                        size={13}
                        className="text-profit"
                        aria-label="Connected"
                      />
                    )}
                  </button>
                ))}
              </div>
              <div
                className={cn(
                  "mt-5 flex flex-wrap items-end gap-4",
                  isConnected && "justify-end",
                  !isConnected && "justify-between",
                )}
              >
                {!isConnected && marketField}
                {isConnected && (
                  <Button
                    variant="ghost"
                    className="text-xs text-muted-foreground"
                    disabled={isBusy}
                    onClick={() => disconnect(selected)}
                  >
                    Disconnect
                  </Button>
                )}
                {!isConnected && (
                  <a
                    href={exchangeInfo.docs}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    Get API key ↗
                  </a>
                )}
              </div>
              {!isConnected && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run("connect");
                  }}
                  className="mt-6"
                >
                  <div className="grid gap-5 @min-[550px]:grid-cols-2">
                    <label className={labelClass}>
                      {keyLabel}
                      <input
                        className={fieldClass}
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        required
                        minLength={8}
                        maxLength={250}
                        disabled={isBusy}
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        placeholder={keyPlaceholder}
                      />
                    </label>
                    <label className={labelClass}>
                      {secretLabel}
                      <input
                        className={fieldClass}
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        required
                        minLength={8}
                        maxLength={4096}
                        disabled={isBusy}
                        value={apiSecret}
                        onChange={(event) => setApiSecret(event.target.value)}
                        placeholder={secretPlaceholder}
                        onPaste={pasteSecret}
                      />
                    </label>
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    className="mx-auto mt-6 flex h-9 px-4"
                    disabled={isBusy}
                  >
                    {connectLabel}
                    <ArrowRight size={16} />
                  </Button>
                </form>
              )}
              {isConnected && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run("import");
                  }}
                  className="mt-6"
                >
                  <div className="grid grid-cols-[120px_minmax(0,1fr)] items-start gap-4 @max-[280px]:grid-cols-1 @min-[550px]:grid-cols-[160px_minmax(0,1fr)]">
                    {marketField}
                    <label className={`${labelClass} min-w-0`}>
                      Symbols
                      <input
                        className={fieldClass}
                        required
                        disabled={isBusy}
                        value={symbols}
                        onChange={(event) => {
                          setSymbols(event.target.value);
                          clearPreview();
                        }}
                        placeholder={exchangeInfo.example}
                      />
                    </label>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-5 @max-[320px]:grid-cols-1 @min-[550px]:grid-cols-3">
                    <label className={labelClass}>
                      From (UTC)
                      <input
                        className={`${fieldClass} min-w-0`}
                        type="date"
                        required
                        max={end}
                        disabled={isBusy}
                        value={start}
                        onChange={(event) => {
                          setStart(event.target.value);
                          clearPreview();
                        }}
                      />
                    </label>
                    <label className={labelClass}>
                      Through (UTC)
                      <input
                        className={`${fieldClass} min-w-0`}
                        type="date"
                        required
                        min={start}
                        max={today}
                        disabled={isBusy}
                        value={end}
                        onChange={(event) => {
                          setEnd(event.target.value);
                          clearPreview();
                        }}
                      />
                    </label>
                    <label
                      className={`${labelClass} col-span-2 @max-[320px]:col-span-1 @min-[550px]:col-span-1`}
                    >
                      Starting balance ({quoteCurrency})
                      <input
                        className={fieldClass}
                        inputMode="decimal"
                        required
                        pattern="\d{1,16}(\.\d{1,2})?"
                        disabled={isBusy}
                        value={balance}
                        onChange={(event) => {
                          setBalance(event.target.value);
                          clearPreview();
                        }}
                      />
                    </label>
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    className="mx-auto mt-6 flex h-9 px-4"
                    disabled={isBusy}
                  >
                    {previewLabel}
                    <ArrowRight size={16} />
                  </Button>
                </form>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="mx-auto mt-2 flex text-xs text-muted-foreground"
                disabled={isBusy}
                onClick={() => void run("sample")}
              >
                {sampleLabel}
              </Button>
              {error && (
                <p
                  role="alert"
                  className="mt-5 text-sm leading-6 text-destructive"
                >
                  {error}
                </p>
              )}
              {status && (
                <p role="status" className="mt-5 text-xs text-profit">
                  {status}
                </p>
              )}
              {preview && (
                <div className="mt-7 border-t border-border pt-6">
                  <h3 className="text-base font-medium">
                    {previewTitle(preview)}
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {previewSummary(preview)}
                  </p>
                  {preview.warnings.length > 0 && (
                    <ul
                      aria-label="Import limitations"
                      className="mt-4 list-disc space-y-1 pl-4 text-xs leading-5 text-muted-foreground"
                    >
                      {preview.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  )}
                  {preview.data && (
                    <>
                      <p className="mt-4 text-xs leading-5 text-muted-foreground">
                        {replaceNotice} replaces all trades currently saved in
                        this browser. Your journal notes and screenshots stay
                        saved.
                      </p>
                      <div className="mt-5 overflow-x-auto">
                        <table className="w-full text-left text-xs whitespace-nowrap tabular-nums [&_th]:pb-3 [&_th]:font-normal [&_th]:text-muted-foreground [&_td]:border-t [&_td]:border-border [&_td]:py-3 [&_th]:pr-5 [&_td]:pr-5">
                          <caption className="sr-only">
                            First five matched trades
                          </caption>
                          <thead>
                            <tr>
                              <th>Symbol</th>
                              <th>Side</th>
                              <th>Volume</th>
                              <th>Entry</th>
                              <th>Exit</th>
                              <th>Net P&L</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.data.trades.slice(0, 5).map((trade) => (
                              <tr key={trade.id}>
                                <td>{trade.symbol}</td>
                                <td className="capitalize">{trade.side}</td>
                                <td>{trade.volume}</td>
                                <td>{trade.entryPrice}</td>
                                <td>{trade.exitPrice}</td>
                                <td>{trade.netPnl}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <Button
                        size="sm"
                        className="mx-auto mt-5 flex h-9 px-4"
                        disabled={isBusy}
                        onClick={() => void run("save")}
                      >
                        {saveLabel(
                          preview,
                          preview.data.trades.length,
                          busy === "save",
                        )}
                        <ArrowRight size={16} />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Tabs.Panel>
            <Tabs.Panel
              value="file"
              keepMounted
              className="outline-none data-[hidden]:hidden"
            >
              <TradeImport onImport={onImport} />
            </Tabs.Panel>
          </Tabs.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
