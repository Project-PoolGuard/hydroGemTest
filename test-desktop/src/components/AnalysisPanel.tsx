"use client";
import { useState } from "react";

export default function AnalysisPanel() {
  const [hours, setHours] = useState(24);
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  async function run() {
    setLoading(true);
    setErr("");
    setText("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setText(json.analysis);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setErr(e.message ?? "Something went wrong");
      } else {
        setErr("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80 space-y-3 h-96 flex flex-col">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="font-medium">AI Water Analysis</div>
        <div className="flex items-center gap-2">
          <label className="text-xs opacity-80" htmlFor="hours">
            Window (h)
          </label>
          <input
            id="hours"
            type="number"
            min={1}
            max={168}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="w-20 rounded-md bg-white/10 px-2 py-1 text-xs outline-none"
          />
          <button
            onClick={run}
            disabled={loading}
            className="rounded-md border border-white/15 bg-white/10 px-3 py-1 text-xs hover:bg-white/15"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </div>

      {err && <div className="text-red-300 text-xs shrink-0">{err}</div>}

      {/* Scrollable text area */}
      <div className="flex-1 overflow-y-auto rounded-lg bg-black/30 p-3 leading-relaxed whitespace-pre-wrap">
        {loading && <div className="text-xs text-white/60">Analyzing…</div>}
        {!loading && text && text}
        {!loading && !text && !err && (
          <div className="text-xs text-white/60">
            Run an analysis to see insights based on recent readings and
            weather.
          </div>
        )}
      </div>
    </div>
  );
}
