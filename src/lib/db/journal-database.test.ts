import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JournalDatabase } from "./journal-database";
import { parseJson } from "../../features/trades/schemas/trade-file.schema";

const fixture = parseJson(
  readFileSync(new URL("../../../../trades.json", import.meta.url), "utf8"),
);
const databases: JournalDatabase[] = [];
function open(name = crypto.randomUUID()) {
  const db = new JournalDatabase(name);
  databases.push(db);
  return db;
}
afterEach(async () => {
  vi.restoreAllMocks();
  for (const db of databases.splice(0)) await db.delete();
});

describe("persistent trade imports", () => {
  it("starts empty and restores exact trades after reopening", async () => {
    const db = open();
    expect(await db.loadTrades()).toBeNull();
    await db.saveTrades(fixture);
    db.close();
    const reopened = open(db.name);
    expect(await reopened.loadTrades()).toEqual(fixture);
  });

  it("replaces the active import without leaving old trades", async () => {
    const db = open();
    await db.saveTrades(fixture);
    const replacement = { ...fixture, trades: [fixture.trades[0]] };
    await db.saveTrades(replacement);
    expect(await db.loadTrades()).toEqual(replacement);
    expect(await db.imports.count()).toBe(1);
  });

  it("preserves the previous import when validation or storage fails", async () => {
    const db = open();
    await db.saveTrades(fixture);
    await expect(db.saveTrades({ ...fixture, trades: [] })).rejects.toThrow();
    vi.spyOn(db.imports, "put").mockRejectedValueOnce(
      new DOMException("Storage full", "QuotaExceededError"),
    );
    await expect(db.saveTrades(fixture)).rejects.toThrow("Storage full");
    expect(await db.loadTrades()).toEqual(fixture);
  });
});
