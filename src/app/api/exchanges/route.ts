import { z } from "zod";
import { exchangeRequest } from "@/features/imports/schemas/exchange.schema";
import { sampleHistory } from "@/features/imports/server/exchange-sample";
import { exchangeOperation } from "@/features/imports/server/exchange-service";

const MAX_REQUEST_LENGTH = 12_000;
const INVALID_DATA_MESSAGE =
  "The exchange returned invalid data. Check your inputs and try again.";

const sampleRequest = exchangeRequest
  .pick({ exchange: true, market: true })
  .extend({ action: z.literal("sample") })
  .strict();

function isSameOrigin(request: Request): boolean {
  try {
    const origin = request.headers.get("origin");

    if (!origin || origin === "null") {
      return false;
    }

    const source = new URL(origin);

    if (
      source.origin !== origin ||
      !["http:", "https:"].includes(source.protocol)
    ) {
      return false;
    }

    const host = request.headers.get("host") ?? new URL(request.url).host;
    const protocol =
      request.headers.get("x-forwarded-proto") ??
      new URL(request.url).protocol.slice(0, -1);

    return (
      source.host === host &&
      source.protocol === `${protocol}:` &&
      request.headers.get("sec-fetch-site") !== "cross-site"
    );
  } catch {
    return false;
  }
}

function reply(data: object, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function failureMessage(error: unknown): string {
  if (
    error instanceof Error &&
    !(error instanceof SyntaxError) &&
    error.name !== "ZodError"
  ) {
    return error.message;
  }

  return INVALID_DATA_MESSAGE;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return reply(
      { error: "Use the exchange connection form in this app." },
      403,
    );
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return reply({ error: "Expected JSON." }, 415);
  }

  try {
    const text = await request.text();

    if (text.length > MAX_REQUEST_LENGTH) {
      return reply({ error: "Request is too large." }, 413);
    }

    const body = JSON.parse(text);

    if (body?.action === "sample") {
      const sample = sampleRequest.safeParse(body);

      if (!sample.success) {
        return reply({ error: "Choose a supported sample exchange." }, 400);
      }

      return reply(
        await sampleHistory(sample.data.exchange, sample.data.market),
      );
    }

    const parsed = exchangeRequest.safeParse(body);

    if (!parsed.success) {
      return reply({ error: "Check the credentials and import fields." }, 400);
    }

    return reply(await exchangeOperation(parsed.data));
  } catch (error) {
    return reply({ error: failureMessage(error) }, 400);
  }
}
