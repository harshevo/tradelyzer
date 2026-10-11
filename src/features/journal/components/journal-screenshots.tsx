"use client";

import { createId } from "@/lib/id";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ImagePlus, Clipboard, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { journalDatabase } from "@/lib/db/journal-database";
import {
  IMAGE_TYPES,
  validateScreenshot,
  type Screenshot,
} from "@/features/journal/utils/screenshots";

function BlobImage({
  image,
  name,
  className,
}: {
  image: Blob;
  name: string;
  className: string;
}) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(image);
    if (ref.current) ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [image]);
  return (
    <img
      ref={ref}
      loading="lazy"
      decoding="async"
      alt={name}
      className={className}
    />
  );
}

export function JournalScreenshots({
  date,
  images,
  onLoad,
  onChange,
  onBusy,
  disabled,
  hasChanges,
}: {
  date: string;
  images: Screenshot[] | null;
  onLoad: (images: Screenshot[]) => void;
  onChange: (images: Screenshot[]) => void;
  onBusy: (busy: boolean) => void;
  disabled: boolean;
  hasChanges: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const pasteButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Screenshot | null>(null);
  const [retry, setRetry] = useState(0);
  const stored = useLiveQuery(async () => {
    try {
      return {
        images: await journalDatabase.screenshots
          .where("date")
          .equals(date)
          .toArray(),
        error: false,
      };
    } catch {
      return { images: [], error: true };
    }
  }, [date, retry]);

  useEffect(() => {
    if (images === null && stored && !stored.error) onLoad(stored.images);
  }, [images, stored, onLoad]);

  useEffect(() => {
    onBusy(busy);
  }, [busy, onBusy]);

  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);

  const attach = useCallback(
    async (files: File[]) => {
      if (!files.length || busyRef.current || disabled || !images) return;
      busyRef.current = true;
      setBusy(true);
      setError("");
      setMessage("");
      try {
        for (const file of files) {
          validateScreenshot(date, file);
          const url = URL.createObjectURL(file);
          try {
            const image = new Image();
            image.src = url;
            await image.decode();
          } catch {
            throw new Error(
              `Couldn’t read ${file.name || "this image"}. Choose a valid image file.`,
            );
          } finally {
            URL.revokeObjectURL(url);
          }
        }
        onChange([
          ...images,
          ...files.map((file) => ({
            id: createId(),
            date,
            name: file.name || "Pasted image",
            image: new Blob([file], { type: file.type }),
          })),
        ]);
        let screenshotNoun = "Screenshots";

        if (files.length === 1) {
          screenshotNoun = "Screenshot";
        }

        setMessage(`${screenshotNoun} added.`);
      } catch (cause) {
        if (cause instanceof Error && !(cause instanceof DOMException)) {
          setError(cause.message);
        } else {
          setError("Couldn’t prepare screenshots. Try again.");
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [date, images, onChange, disabled],
  );

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("input, textarea, [contenteditable]")
      )
        return;
      const files = Array.from(event.clipboardData?.files ?? []);
      if (!files.length) return;
      event.preventDefault();
      void attach(files);
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  }, [attach]);

  async function pasteImage() {
    if (busyRef.current || disabled || !images) return;
    setError("");
    setMessage("");
    if (!navigator.clipboard?.read) {
      pasteButton.current?.focus();
      setMessage(
        "Press Ctrl/Cmd + V now to paste your screenshot, or choose Add images.",
      );
      return;
    }
    setBusy(true);
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        const type = item.types.find((type) => IMAGE_TYPES.includes(type));
        if (type)
          files.push(
            new File([await item.getType(type)], "Pasted image", { type }),
          );
      }
      if (!files.length) {
        setError("No image in the clipboard. Copy a chart image first.");
        return;
      }
      await attach(files);
    } catch {
      requestAnimationFrame(() => pasteButton.current?.focus());
      setMessage(
        "Your browser blocked clipboard access. Press Ctrl/Cmd + V now, or choose Add images.",
      );
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    if (busyRef.current || disabled || !images) return;
    onChange(images.filter((image) => image.id !== id));
    setError("");
    setMessage("Screenshot removed.");
  }

  return (
    <section aria-labelledby="screenshots-heading" className="pt-2">
      <div className="flex flex-col items-center justify-center gap-3">
        <h2 id="screenshots-heading" className="text-base font-medium">
          Screenshots
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          <input
            ref={input}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            multiple
            className="hidden"
            aria-label="Choose screenshot files"
            onChange={(event) => {
              void attach(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={disabled || busy || !images || stored?.error}
            title="PNG, JPEG, WebP or GIF · Up to 10 MB each"
            onClick={() => input.current?.click()}
          >
            <ImagePlus /> Add images
          </Button>
          <Button
            ref={pasteButton}
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            disabled={disabled || busy || !images || stored?.error}
            title="Paste an image, or use Ctrl/Cmd + V"
            onClick={() => void pasteImage()}
          >
            <Clipboard /> Paste image
          </Button>
        </div>
      </div>
      {stored?.error && (
        <div role="alert" className="mt-4 text-sm text-loss">
          Couldn’t load screenshots.{" "}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRetry(retry + 1)}
          >
            Try again
          </Button>
        </div>
      )}
      {!stored?.error && !images && (
        <p role="status" className="mt-5 text-xs text-muted-foreground">
          Loading screenshots…
        </p>
      )}
      {!stored?.error && images && images.length > 0 && (
        <div className="mt-4 grid grid-cols-4 gap-3 max-[1000px]:grid-cols-3 max-[640px]:grid-cols-2 max-[640px]:gap-3">
          {images.map((screenshot) => (
            <div key={screenshot.id} className="min-w-0">
              <button
                type="button"
                className="block w-full overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Preview ${screenshot.name}`}
                onClick={() => setSelected(screenshot)}
              >
                <BlobImage
                  image={screenshot.image}
                  name={screenshot.name}
                  className="aspect-video w-full object-cover transition-opacity hover:opacity-80"
                />
              </button>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={screenshot.name}
                >
                  {screenshot.name}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled || busy}
                  aria-label={`Delete ${screenshot.name}`}
                  onClick={() => remove(screenshot.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {(busy || (message && (!message.endsWith("added.") || hasChanges))) && (
        <p
          role="status"
          className="mt-2 text-center text-xs text-muted-foreground"
        >
          {busy && "Preparing screenshots…"}
          {!busy && message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-loss">
          {error}
        </p>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="screenshot-preview-title"
        onCancel={() => setSelected(null)}
        onClick={(event) => {
          if (event.target === dialog.current) setSelected(null);
        }}
        className="m-auto max-h-[90dvh] w-[95vw] max-w-5xl rounded-2xl bg-card p-5 text-foreground backdrop:bg-foreground/40"
      >
        {selected && (
          <div onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3
                id="screenshot-preview-title"
                className="truncate text-sm font-medium"
              >
                {selected.name}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close screenshot preview"
                onClick={() => setSelected(null)}
              >
                <X />
              </Button>
            </div>
            <BlobImage
              image={selected.image}
              name={selected.name}
              className="max-h-[75dvh] w-full object-contain"
            />
          </div>
        )}
      </dialog>
    </section>
  );
}
