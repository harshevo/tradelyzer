import { isJournalDate } from "@/features/journal/schemas/journal.schema";

export type Screenshot = {
  id: string;
  date: string;
  name: string;
  image: Blob;
};
export const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

export function validateScreenshot(date: string, image: Blob) {
  if (!isJournalDate(date)) throw new Error("Choose a valid journal date.");
  if (!IMAGE_TYPES.includes(image.type))
    throw new Error("Choose PNG, JPEG, WebP or GIF images.");
  if (!image.size || image.size > 10 * 1024 * 1024)
    throw new Error("Each image must be between 1 byte and 10 MB.");
}
