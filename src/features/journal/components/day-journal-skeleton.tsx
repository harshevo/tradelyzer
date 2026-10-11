import { WorkspaceSidebar } from "@/components/layout/workspace-sidebar";
import { cn } from "@/lib/utils";

const statistics = ["net", "win-rate", "trades", "largest-win", "largest-loss"];
const tradeRows = ["first", "second", "third"];
const tabs = ["plan", "review", "screenshots"];

function SkeletonBlock({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block animate-pulse rounded-lg bg-muted", className)}
    />
  );
}

export function DayJournalSkeleton() {
  return (
    <div role="status" aria-label="Loading journal">
      <header className="relative mb-6 pt-8 max-[640px]:mb-5 max-[640px]:pt-10">
        <SkeletonBlock className="absolute top-0 left-0 h-5 w-20" />
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <SkeletonBlock className="size-8" />
            <SkeletonBlock className="h-8 w-72 max-w-full max-[640px]:h-6 max-[640px]:w-52" />
            <SkeletonBlock className="size-8" />
          </div>
          <SkeletonBlock className="mt-2.5 h-3 w-24" />
        </div>
      </header>
      <div className="mb-10 grid grid-cols-5 gap-6 py-6 max-[800px]:gap-2 max-[640px]:mb-6 max-[640px]:py-3">
        {statistics.map((statistic) => (
          <div key={statistic} className="flex flex-col items-center gap-2">
            <SkeletonBlock className="h-3 w-16 max-w-full" />
            <SkeletonBlock className="h-8 w-24 max-w-full max-[640px]:h-5" />
          </div>
        ))}
      </div>
      <section className="mb-12 max-[640px]:mb-7">
        <SkeletonBlock className="mb-5 h-6 w-20 max-[640px]:mb-3" />
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <SkeletonBlock className="h-10 w-full rounded-none" />
          {tradeRows.map((row) => (
            <div
              key={row}
              className="flex items-center gap-6 border-t border-border px-4 py-4 max-[640px]:gap-2 max-[640px]:px-2"
            >
              <SkeletonBlock className="h-4 w-20" />
              <SkeletonBlock className="h-4 w-12" />
              <SkeletonBlock className="h-4 flex-1" />
              <SkeletonBlock className="h-4 w-20" />
            </div>
          ))}
        </div>
      </section>
      <div className="mx-auto w-full max-w-[640px]">
        <div className="mx-auto mb-5 grid max-w-[420px] grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {tabs.map((tab) => (
            <span
              key={tab}
              aria-hidden="true"
              className="block h-9 animate-pulse rounded-lg bg-card"
            />
          ))}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <SkeletonBlock className="h-14" />
            <SkeletonBlock className="h-14" />
          </div>
          <SkeletonBlock className="h-20" />
          <SkeletonBlock className="h-24" />
        </div>
        <div className="mt-6 flex justify-center border-t border-border pt-3">
          <SkeletonBlock className="h-9 w-28" />
        </div>
      </div>
    </div>
  );
}

export function DayJournalPageSkeleton() {
  return (
    <div className="flex min-h-dvh bg-background text-foreground max-[800px]:flex-col">
      <WorkspaceSidebar />
      <main className="mx-auto w-full min-w-0 max-w-[1400px] flex-1 px-16 py-12 max-[800px]:px-4 max-[800px]:py-5">
        <DayJournalSkeleton />
      </main>
    </div>
  );
}
