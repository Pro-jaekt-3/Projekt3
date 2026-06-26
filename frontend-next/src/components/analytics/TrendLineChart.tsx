import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

// Reusable time-series line chart for the analytics trends page. Plots one or
// more series over the backend's date buckets (categorical X axis — each
// returned bucket is one tick, so empty buckets simply don't appear and are NOT
// fabricated). `type="linear"` draws straight segments between REAL points (no
// smoothing/curve-fitting that would imply values the backend didn't return);
// dots mark the actual data points. `connectNulls={false}` leaves honest gaps
// where a series has no value for a bucket.

export interface TrendSeries {
  dataKey: string;
  name: string;
  color: string;
}

export type TrendDatum = Record<string, string | number | null | undefined>;

export function TrendLineChart({
  data,
  series,
  height = 256,
}: {
  data: TrendDatum[];
  series: TrendSeries[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" fontSize={11} interval="preserveStartEnd" minTickGap={24} />
          <YAxis domain={[0, 100]} fontSize={11} unit="%" />
          <Tooltip formatter={(value: number | string) => `${value}%`} />
          {series.length > 1 && <Legend fontSize={11} />}
          {series.map((s) => (
            <Line
              key={s.dataKey}
              type="linear"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
