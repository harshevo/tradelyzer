const ZERO_CENTS = BigInt(0);
const CENTS_PER_UNIT = BigInt(100);

export function toCents(value: string): bigint {
  const isNegative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const cents =
    BigInt(whole) * CENTS_PER_UNIT + BigInt(fraction.padEnd(2, "0"));

  if (isNegative) {
    return -cents;
  }

  return cents;
}

function absoluteCents(cents: bigint): bigint {
  if (cents < ZERO_CENTS) {
    return -cents;
  }

  return cents;
}

function signPrefix(cents: bigint, signed: boolean): string {
  if (cents < ZERO_CENTS) {
    return "−";
  }

  if (signed && cents > ZERO_CENTS) {
    return "+";
  }

  return "";
}

export function formatMoney(cents: bigint, signed = false): string {
  const absolute = absoluteCents(cents);
  const sign = signPrefix(cents, signed);
  const units = (absolute / CENTS_PER_UNIT).toLocaleString("en-US");
  const fraction = (absolute % CENTS_PER_UNIT).toString().padStart(2, "0");

  return `${sign}$${units}.${fraction}`;
}

export function largerCents(left: bigint, right: bigint): bigint {
  if (right > left) {
    return right;
  }

  return left;
}

export function smallerCents(left: bigint, right: bigint): bigint {
  if (right < left) {
    return right;
  }

  return left;
}
