import { Dashboard } from "@/components/Dashboard";
import { getDashboardData, getWeekView } from "@/lib/dashboard";

// The store reads/writes the filesystem — never prerender this at build time.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getDashboardData();
  const initialWeek = await getWeekView(data.currentWeek);

  return <Dashboard initial={data} initialWeek={initialWeek} />;
}
