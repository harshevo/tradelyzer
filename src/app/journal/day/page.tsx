import { Suspense } from "react";
import { DayJournal } from "@/features/journal/components/day-journal";
import { DayJournalPageSkeleton } from "@/features/journal/components/day-journal-skeleton";

async function SelectedDay({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  let selectedDate = "";

  if (typeof date === "string") {
    selectedDate = date;
  }

  return <DayJournal key={String(date)} date={selectedDate} />;
}

export default function Page(props: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<DayJournalPageSkeleton />}>
      <SelectedDay {...props} />
    </Suspense>
  );
}
