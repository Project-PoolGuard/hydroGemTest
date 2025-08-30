// app/api/analyze/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

type PoolReading = {
  id: string;
  created_at: string;
  ph: number | null;
  chlorine_ppm: number | null;
  temp_c: number | null;
  battery_pct: number | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function isoNowBerlin() {
  return new Date().toISOString();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { hours?: number };
    const hours = typeof body.hours === "number" && body.hours > 0 ? body.hours : 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // 1) fetch latest N hours of readings
    const { data: rows, error } = await supabase
      .from("pool_readings")
      .select("id, created_at, ph, chlorine_ppm, temp_c, battery_pct")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Also fetch the latest row in case table was quiet
    const { data: lastRow } = await supabase
      .from("pool_readings")
      .select("id, created_at, ph, chlorine_ppm, temp_c, battery_pct")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<PoolReading>();

    const latest: PoolReading | null = lastRow ?? null;

    // 2) weather (Open-Meteo, no key)
    const lat = process.env.NEXT_PUBLIC_WEATHER_LAT!;
    const lon = process.env.NEXT_PUBLIC_WEATHER_LON!;
    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
    weatherUrl.searchParams.set("latitude", lat);
    weatherUrl.searchParams.set("longitude", lon);
    weatherUrl.searchParams.set("timezone", "Europe/Berlin");
    weatherUrl.searchParams.set("past_days", "1");
    weatherUrl.searchParams.set("forecast_days", "1");
    weatherUrl.searchParams.set(
      "hourly",
      [
        "temperature_2m",
        "relative_humidity_2m",
        "uv_index",
        "precipitation",
        "windspeed_10m",
      ].join(",")
    );

    const weatherRes = await fetch(weatherUrl.toString(), { cache: "no-store" });
    const weather = await weatherRes.json();

    // 3) prompt
    const prompt = `
You are a pool water quality analyst. Analyze the device samples and local weather to explain likely water status and actions.

Context:
- Device = HydroGem (values are timestamped ISO, Berlin time).
- pH ideal band: 7.2–7.8 (target ~7.4)
- Free chlorine typical: 1–3 ppm for pools (lower for spas if sensitive users)
- Temperature impacts chlorine consumption; sun (UV) + heat degrade chlorine faster.
- Provide concise, actionable advice. Avoid medical claims.

Inputs:
- Analysis window: last ${hours}h (now: ${isoNowBerlin()})
- Latest row (for “current status”): ${latest ? JSON.stringify(latest) : "none"}
- Timeseries rows (oldest→newest, may be empty):
${JSON.stringify(rows ?? [])}

- Weather (Open-Meteo subset):
${JSON.stringify(
      {
        timezone: weather?.timezone,
        start: weather?.hourly?.time?.[0],
        end: weather?.hourly?.time?.slice(-1)?.[0],
        temp: weather?.hourly?.temperature_2m?.slice(-6),
        rh: weather?.hourly?.relative_humidity_2m?.slice(-6),
        uv: weather?.hourly?.uv_index?.slice(-6),
        precip: weather?.hourly?.precipitation?.slice(-6),
        wind: weather?.hourly?.windspeed_10m?.slice(-6),
      },
      null,
      2
    )}

Output:
- 1) Current status (bullet points): pH, chlorine, temp, battery.
- 2) Trends in the last ${hours}h (mention direction + rough magnitude).
- 3) Weather effects (UV/heat/rain) on chlorine/pH and likely near-term impact.
- 4) Clear actions (max 4 bullets): e.g., “add X ppm chlorine,” “adjust pH up/down,” “retest in X h,” “cover recommended.”
- 5) Safety reminders: brief, generic.
Keep it under 180 words.
    `.trim();

    // 4) OpenAI Responses API
    const resp = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
      temperature: 0.3,
    });

    // Typed access (SDK exposes output_text as string | null)
    const analysis: string = resp.output_text ?? "No analysis returned.";

    return NextResponse.json({
      ok: true,
      analysis,
      latest,
      count: rows?.length ?? 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
