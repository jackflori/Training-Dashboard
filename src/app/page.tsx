import { Dashboard } from "@/components/Dashboard";
import { canEdit } from "@/lib/auth";
import { getDashboardData, getWeekView } from "@/lib/dashboard";

// Reads the store (and the session cookie) — never prerender at build time.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getDashboardData();
  const initialWeek = await getWeekView(data.currentWeek);

  return (
    <Dashboard initial={data} initialWeek={initialWeek} canEdit={canEdit()} />
  );
}
