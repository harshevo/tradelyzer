import Dexie, { type Table } from "dexie";
import {
  validateTradeFile,
  type TradeFile,
} from "../../features/trades/schemas/trade-file.schema";
import {
  journalSchema,
  type JournalEntry,
} from "../../features/journal/schemas/journal.schema";

import {
  validateScreenshot,
  type Screenshot,
} from "../../features/journal/utils/screenshots";

type SavedImport = { id: "active"; data: TradeFile };

export class JournalDatabase extends Dexie {
  imports!: Table<SavedImport, string>;
  journals!: Table<JournalEntry, string>;
  tags!: Table<{ name: string }, string>;
  screenshots!: Table<Screenshot, string>;

  constructor(name = "tradelyzer-journal") {
    super(name);
    this.version(1).stores({ imports: "id" });
    this.version(2).stores({ journals: "date" });
    this.version(3)
      .stores({ tags: "name" })
      .upgrade(async (transaction) => {
        const entries: JournalEntry[] = await transaction
          .table("journals")
          .toArray();
        const names = [...new Set(entries.flatMap((entry) => entry.tags))];
        await transaction
          .table("tags")
          .bulkPut(names.map((name) => ({ name })));
      });
    this.version(4).stores({ screenshots: "id, date" });
  }

  async addScreenshots(date: string, files: File[]): Promise<void> {
    const screenshots = files.map((file) => {
      validateScreenshot(date, file);
      return {
        id: crypto.randomUUID(),
        date,
        name: file.name || "Pasted image",
        image: new Blob([file], { type: file.type }),
      };
    });
    await this.transaction("rw", this.screenshots, () =>
      this.screenshots.bulkAdd(screenshots),
    );
  }

  async saveJournal(
    entry: JournalEntry,
    changes: { added: Screenshot[]; removed: string[] } = {
      added: [],
      removed: [],
    },
  ): Promise<void> {
    const validated = journalSchema.parse(entry);
    for (const screenshot of changes.added) {
      validateScreenshot(screenshot.date, screenshot.image);
      if (screenshot.date !== validated.date)
        throw new Error("Screenshot belongs to another day.");
    }
    await this.transaction(
      "rw",
      this.journals,
      this.tags,
      this.screenshots,
      async () => {
        for (const id of changes.removed) {
          const screenshot = await this.screenshots.get(id);
          if (screenshot && screenshot.date !== validated.date)
            throw new Error("Screenshot belongs to another day.");
        }
        await this.screenshots.bulkDelete(changes.removed);
        await this.screenshots.bulkAdd(changes.added);
        await this.journals.put(validated);
        await this.tags.bulkPut(validated.tags.map((name) => ({ name })));
      },
    );
  }

  async addTag(name: string): Promise<string> {
    const validated = journalSchema.shape.tags.element.parse(name);
    await this.tags.put({ name: validated });
    return validated;
  }

  async loadTrades(): Promise<TradeFile | null> {
    const saved = await this.imports.get("active");
    if (!saved) {
      return null;
    }

    return validateTradeFile(saved.data);
  }

  async saveTrades(data: TradeFile): Promise<void> {
    const validated = validateTradeFile(data);
    await this.imports.put({ id: "active", data: validated });
  }
}

export const journalDatabase = new JournalDatabase();
