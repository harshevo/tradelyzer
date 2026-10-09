const ZERO_CENTS = BigInt(0);

export function lossClass(cents: bigint): string {
  if (cents < ZERO_CENTS) {
    return "negative";
  }

  return "";
}

export function profitAndLossClass(cents: bigint): string {
  if (cents < ZERO_CENTS) {
    return "negative";
  }

  if (cents > ZERO_CENTS) {
    return "positive";
  }

  return "";
}

export function formatWinRate(wins: number, count: number): string {
  if (count === 0) {
    return "—";
  }

  return `${Math.round((wins / count) * 100)}%`;
}

export function tradeNoun(count: number): string {
  if (count === 1) {
    return "trade";
  }

  return "trades";
}
