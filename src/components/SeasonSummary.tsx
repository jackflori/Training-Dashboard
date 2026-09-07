"use client";

import type { DashboardData } from "@/lib/dashboard";
import { duration, feet } from "@/lib/format";
import {
  Card,
  ClockIcon,
  FlagIcon,
  MountainIcon,
  RouteIcon,
  StatTile,
} from "./ui";

export function SeasonSummary({ season }: { season: DashboardData["season"] }) {
  const { totals, daysToNationals } = season;
  // The label already says "days till", so the value is just the count —
  // with words for the two cases a bare number would misread.
  const countdown =
    daysToNationals > 0
      ? `${daysToNationals}`
      : daysToNationals === 0
        ? "Today"
        : "Passed";

  return (
    <Card title="Season to date">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Miles"
          value={totals.miles.toFixed(0)}
          icon={<RouteIcon />}
        />
        <StatTile
          label="Time"
          value={duration(totals.movingSeconds)}
          icon={<ClockIcon />}
        />
        <StatTile
          label="Elevation"
          value={feet(totals.elevationGainFeet)}
          icon={<MountainIcon />}
        />
        {/* The one headline number on this view. */}
        <StatTile
          label="Days till nationals"
          value={countdown}
          icon={<FlagIcon />}
          emphasis
        />
      </div>
    </Card>
  );
}
