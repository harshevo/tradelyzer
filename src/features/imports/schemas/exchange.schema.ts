import { z } from "zod";

export const exchanges = {
  binance: {
    name: "Binance",
    market: "Spot & USDT perpetuals",
    example: "BTCUSDT, ETHUSDT",
    docs: "https://www.binance.com/en/my/settings/api-management",
  },
  bybit: {
    name: "Bybit",
    market: "USDT perpetuals",
    example: "BTCUSDT, ETHUSDT",
    docs: "https://www.bybit.com/app/user/api-management",
  },
  coinbase: {
    name: "Coinbase",
    market: "USD spot",
    example: "BTC-USD, ETH-USD",
    docs: "https://portal.cdp.coinbase.com/access/api",
  },
} as const;
export type Exchange = keyof typeof exchanges;
export type Credentials = { apiKey: string; apiSecret: string };
export const exchangeRequest = z.object({
  exchange: z.enum(["binance", "bybit", "coinbase"]),
  action: z.enum(["connect", "import"]),
  market: z.enum(["spot", "perpetual"]).optional(),
  apiKey: z.string().trim().min(8).max(250),
  apiSecret: z.string().trim().min(8).max(4096),
  symbols: z
    .array(z.string().regex(/^[A-Z0-9-]{3,30}$/))
    .min(1)
    .max(10)
    .optional(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  startingBalance: z
    .string()
    .regex(/^\d{1,16}(\.\d{1,2})?$/)
    .default("0.00"),
});
export type ExchangeRequest = z.infer<typeof exchangeRequest>;
