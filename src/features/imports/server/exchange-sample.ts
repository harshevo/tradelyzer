import { generateKeyPairSync } from "node:crypto";
import {
  exchanges,
  type Exchange,
} from "@/features/imports/schemas/exchange.schema";
import { exchangeOperation } from "./exchange-service";

const DAY_IN_MILLISECONDS = 86_400_000;
const HOUR_IN_MILLISECONDS = 3_600_000;

const sampleFills = [
  { side: "SELL", price: "100", qty: "1", fee: "1", closed: "1" },
  { side: "BUY", price: "100", qty: "2", fee: "2", closed: "0" },
  { side: "SELL", price: "120", qty: "1", fee: "1", closed: "1" },
  { side: "SELL", price: "90", qty: "1", fee: "1", closed: "1" },
  { side: "BUY", price: "150", qty: "1", fee: "1", closed: "0" },
];

function sampleSymbol(exchange: Exchange): string {
  if (exchange === "coinbase") {
    return "BTC-USD";
  }

  return "BTCUSDT";
}

function sampleSecret(exchange: Exchange): string {
  if (exchange === "coinbase") {
    return generateKeyPairSync("ec", { namedCurve: "prime256v1" })
      .privateKey.export({ type: "sec1", format: "pem" })
      .toString();
  }

  return "sample-secret";
}

function sampleRealizedPnl(fillId: string): string {
  if (fillId === "3") {
    return "20";
  }

  if (fillId === "4") {
    return "-10";
  }

  return "0";
}

function bybitSide(side: string): string {
  if (side === "BUY") {
    return "Buy";
  }

  return "Sell";
}

export async function sampleHistory(
  exchange: Exchange,
  market: "spot" | "perpetual" = "spot",
) {
  const start =
    Math.floor(Date.now() / DAY_IN_MILLISECONDS) * DAY_IN_MILLISECONDS -
    2 * DAY_IN_MILLISECONDS;
  const symbol = sampleSymbol(exchange);
  const fills = sampleFills.map((fill, index) => {
    let dayOffset = 0;

    if (index >= 3) {
      dayOffset = DAY_IN_MILLISECONDS;
    }

    return {
      ...fill,
      id: String(index + 1),
      time: start + dayOffset + (index + 1) * HOUR_IN_MILLISECONDS,
    };
  });

  const transport: typeof fetch = async (input) => {
    const url = new URL(String(input));
    const query = url.searchParams;

    if (exchange === "binance" && url.pathname === "/fapi/v2/positionRisk") {
      return Response.json([
        {
          symbol,
          positionSide: "LONG",
          positionAmt: "1",
          updateTime: fills.at(-1)!.time,
        },
      ]);
    }

    if (
      exchange === "binance" &&
      ["/api/v3/myTrades", "/fapi/v1/userTrades"].includes(url.pathname)
    ) {
      const startTime = Number(query.get("startTime"));
      const endTime = Number(query.get("endTime"));

      return Response.json(
        fills
          .filter((fill) => fill.time >= startTime && fill.time <= endTime)
          .map((fill) => ({
            id: Number(fill.id),
            symbol,
            side: fill.side,
            isBuyer: fill.side === "BUY",
            time: fill.time,
            price: fill.price,
            qty: fill.qty,
            commission: fill.fee,
            commissionAsset: "USDT",
            positionSide: "LONG",
            realizedPnl: sampleRealizedPnl(fill.id),
          })),
      );
    }

    let page = fills.slice(0, 2);
    let cursor = "sample-page-2";

    if (query.get("cursor")) {
      page = fills.slice(2);
      cursor = "";
    }

    if (exchange === "bybit" && url.pathname === "/v5/execution/list") {
      return Response.json({
        retCode: 0,
        result: {
          nextPageCursor: cursor,
          list: page.map((fill) => ({
            execId: fill.id,
            symbol,
            side: bybitSide(fill.side),
            execTime: String(fill.time),
            execPrice: fill.price,
            execQty: fill.qty,
            execFee: fill.fee,
            closedSize: fill.closed,
            seq: fill.id,
          })),
        },
      });
    }

    if (
      exchange === "coinbase" &&
      url.pathname === "/api/v3/brokerage/orders/historical/fills"
    ) {
      return Response.json({
        cursor,
        fills: page.map((fill) => ({
          entry_id: fill.id,
          product_id: symbol,
          side: fill.side,
          trade_time: new Date(fill.time).toISOString(),
          price: fill.price,
          size: fill.qty,
          size_in_quote: false,
          commission: fill.fee,
        })),
      });
    }

    throw new Error("Unexpected sample API request.");
  };

  const result = await exchangeOperation(
    {
      exchange,
      market,
      action: "import",
      apiKey: "sample-account",
      apiSecret: sampleSecret(exchange),
      symbols: [symbol],
      start: new Date(start).toISOString(),
      end: new Date(start + 2 * DAY_IN_MILLISECONDS).toISOString(),
      startingBalance: "1000.00",
    },
    transport,
  );

  if (!("data" in result) || !result.data) {
    throw new Error("Sample history is unavailable.");
  }

  result.data.account.name = `${exchanges[exchange].name} · Sample`;

  return { ...result, data: result.data, sample: true };
}
