"use client";

import { formatWeekRange, type IsoDate } from "@/lib/dates";
import { Button } from "./ui";

export function WeekNav({
  weekStart,
  weeks,
  currentWeek,
  onSelect,
}: {
  weekStart: IsoDate;
  weeks: IsoDate[];
  currentWeek: IsoDate;
  onSelect: (weekStart: IsoDate) => void;
}) {
  const index = weeks.indexOf(weekStart);
  const canPrev = index > 0;
  const canNext = index >= 0 && index < weeks.length - 1;
  const weeksOut = index >= 0 ? weeks.indexOf(weekStart) - weeks.indexOf(currentWeek) : 0;

  return (
    <div className="flex items-center justify-between gap-3">
      <Button
        onClick={() => canPrev && onSelect(weeks[index - 1]!)}
        disabled={!canPrev}
        aria-label="Previous week"
      >
        ←
      </Button>

      <div className="text-center">
        <div className="text-base font-semibold text-ink">
          {formatWeekRange(weekStart)}
        </div>
        <button
          type="button"
          onClick={() => onSelect(currentWeek)}
          className="text-xs text-ink-muted transition hover:text-accent"
        >
          {weeksOut === 0
            ? "This week"
            : weeksOut > 0
              ? `${weeksOut} week${weeksOut === 1 ? "" : "s"} out · jump to this week`
              : `${-weeksOut} week${weeksOut === -1 ? "" : "s"} ago · jump to this week`}
        </button>
      </div>

      <Button
        onClick={() => canNext && onSelect(weeks[index + 1]!)}
        disabled={!canNext}
        aria-label="Next week"
      >
        →
      </Button>
    </div>
  );
}
