import Dexie, { type Table } from "dexie";
import {
  validateTradeFile,
  type TradeFile,
} from "../../features/trades/schemas/trade-file.schema";

type SavedImport = { id: "active"; data: TradeFile };

export class JournalDatabase extends Dexie {
  imports!: Table<SavedImport, string>;

  constructor(name = "tradelyzer-journal") {
    super(name);
    this.version(1).stores({ imports: "id" });
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
