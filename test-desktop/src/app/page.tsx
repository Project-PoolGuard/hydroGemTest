// app/pool/page.tsx
import { getServerSupabase } from "@/lib/supabase/server";
import LiveReading from "@/components/LiveReading";
import type { PoolReading } from "@/types/pool";

export const revalidate = 0; // always fresh on navigation

export default async function PoolPage() {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("pool_readings")
    .select("id, created_at, ph, chlorine_ppm, temp_c, battery_pct")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PoolReading>();

  if (error) {
    console.error(error);
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 text-white b">
      <h1 className="mb-6 text-2xl font-semibold">Pool Status</h1>
      <LiveReading initial={data ?? null} />
    </main>
  );
}
