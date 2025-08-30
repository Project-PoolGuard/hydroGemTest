"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { PoolReading } from "@/types/pool";

function formatTs(ts?: string) {
  if (!ts) return "—";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Berlin",
      hour12: false,
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

function StatCard({
  label,
  value,
  unit,
  timestamp,
  icon,
}: {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  timestamp?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-white/0 p-5 shadow-inner backdrop-blur">
      <div className="flex items-center gap-2 text-sm text-white/60">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">
        {value ?? "—"}
        {unit ? (
          <span className="ml-1 text-base text-white/60">{unit}</span>
        ) : null}
      </div>
      <div className="mt-3 text-xs text-white/50">
        Updated: {formatTs(timestamp)}
      </div>
    </div>
  );
}

export default function LiveReading({
  initial,
}: {
  initial: PoolReading | null;
}) {
  const [reading, setReading] = useState<PoolReading | null>(initial);
  // "Last refresh" = when the UI last successfully fetched or received data (client time)
  const [refreshTs, setRefreshTs] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const fetchLatest = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabaseBrowser
      .from("pool_readings")
      .select("id, created_at, ph, chlorine_ppm, temp_c, battery_pct")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<PoolReading>();

    if (!error && data) {
      setReading((prev) => {
        // only replace if newer; guarantees "latest" even if SSR was older
        if (!prev || new Date(data.created_at) > new Date(prev.created_at)) {
          return data;
        }
        return prev;
      });
      setRefreshTs(new Date().toISOString());
    } else if (!error && !data) {
      // table empty
      setReading(null);
      setRefreshTs(new Date().toISOString());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // On mount, do a client fetch to ensure we have the latest row
    fetchLatest();

    // Realtime: replace with incoming inserts if newer and stamp refresh time
    const channel = supabaseBrowser
      .channel("pool_readings_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pool_readings" },
        (payload) => {
          const row = payload.new as PoolReading;
          setReading((prev) => {
            if (!prev || new Date(row.created_at) > new Date(prev.created_at)) {
              return row;
            }
            return prev;
          });
          setRefreshTs(new Date().toISOString());
        }
      )
      .subscribe();

    // keyboard shortcut: press "r" to refresh
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        fetchLatest();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      supabaseBrowser.removeChannel(channel);
      window.removeEventListener("keydown", onKey);
    };
  }, [fetchLatest]);

  const cards = useMemo(
    () => [
      {
        label: "pH",
        value: reading?.ph?.toFixed?.(2),
        unit: undefined,
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            className="opacity-70"
          >
            <path
              fill="currentColor"
              d="M3 3h2v10H3zm4 0h2v6H7zm4 0h2v14h-2zm4 0h2v8h-2zm4 0h2v12h-2z"
            />
          </svg>
        ),
      },
      {
        label: "Chlorine",
        value: reading?.chlorine_ppm?.toFixed?.(2),
        unit: "ppm",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            className="opacity-70"
          >
            <path
              fill="currentColor"
              d="M12 2l7 12H5L12 2zm0 4.5L8.5 12h7L12 6.5zM5 18h14v2H5z"
            />
          </svg>
        ),
      },
      {
        label: "Water Temp",
        value:
          typeof reading?.temp_c === "number"
            ? reading!.temp_c.toFixed(1)
            : undefined,
        unit: "°C",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            className="opacity-70"
          >
            <path
              fill="currentColor"
              d="M15 14.76V5a3 3 0 10-6 0v9.76a5 5 0 106 0zM12 3a2 2 0 00-2 2v9.93l-.3.3a3.5 3.5 0 104.6 0l-.3-.3V5a2 2 0 00-2-2z"
            />
          </svg>
        ),
      },
      {
        label: "Battery",
        value:
          typeof reading?.battery_pct === "number"
            ? Math.round(reading!.battery_pct)
            : undefined,
        unit: "%",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            className="opacity-70"
          >
            <path
              fill="currentColor"
              d="M16 7H4a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2zm5 3h-1v4h1a1 1 0 001-1v-2a1 1 0 00-1-1z"
            />
          </svg>
        ),
      },
    ],
    [reading]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium">HydroGem — Pool Dashboard</div>
          <div className="flex items-center gap-3">
            <div className="text-xs">
              Last refresh:{" "}
              <span className="font-semibold" suppressHydrationWarning>
                {formatTs(refreshTs)}
              </span>
            </div>
            <button
              onClick={fetchLatest}
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/15"
              aria-label="Refresh latest reading"
              title="Refresh (R)"
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={c.value}
            unit={c.unit}
            timestamp={reading?.created_at} // ← per-card: row timestamp from Supabase
            icon={c.icon}
          />
        ))}
      </div>

      {!reading && (
        <div className="text-center text-sm text-white/60">
          No readings yet. Insert a row into{" "}
          <code className="px-1 rounded bg-white/10">pool_readings</code> to see
          live updates.
        </div>
      )}
    </div>
  );
}
