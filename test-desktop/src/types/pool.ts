export type PoolReading = {
  id: string;
  created_at: string;      // timestamptz
  ph: number | null;
  chlorine_ppm: number | null; // free chlorine in ppm (mg/L)
  temp_c: number | null;       // water temperature in °C
  battery_pct: number | null;  // 0–100
};
