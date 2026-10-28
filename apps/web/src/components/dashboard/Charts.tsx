'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine, ComposedChart, Area } from 'recharts';

const tooltipStyle = {
  background: 'rgba(20,20,20,0.92)',
  border: '1px solid #333',
  borderRadius: 8,
  color: '#fff',
  fontSize: 12,
};

export function GlucoseChart({ data }: { data: { t: number; value: number }[] }) {
  const chartData = data.map((d) => ({ ...d, label: new Date(d.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        {/* Target band 70-140 mg/dL */}
        <ReferenceArea y1={70} y2={140} fill="#16b077" fillOpacity={0.08} />
        <ReferenceLine y={140} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.5} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} minTickGap={20} />
        <YAxis domain={[60, 220]} tick={{ fontSize: 11, fill: '#888' }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} mg/dL`, 'Glucose']} />
        <Line type="monotone" dataKey="value" stroke="#16b077" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WeightChart({ data }: { data: { t: number; kg: number }[] }) {
  const chartData = data.map((d) => ({ ...d, label: new Date(d.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} minTickGap={20} />
        <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 11, fill: '#888' }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} kg`, 'Weight']} />
        <Line type="monotone" dataKey="kg" stroke="#3fcb93" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ForecastChart({ data }: { data: { day: number; value: number; low: number; high: number }[] }) {
  const chartData = data.map((d) => ({ ...d, label: d.day === 0 ? 'Now' : `+${d.day}d` }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <ReferenceArea y1="dataMin" y2="dataMax" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} minTickGap={24} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: '#888' }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => v.toFixed(1)} />
        <Line type="monotone" dataKey="high" stroke="#ef4444" strokeWidth={1} strokeOpacity={0.3} dot={false} />
        <Line type="monotone" dataKey="low" stroke="#3fcb93" strokeWidth={1} strokeOpacity={0.3} dot={false} />
        <Line type="monotone" dataKey="value" stroke="#0a8e5f" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Weight & forecast (dashboard revamp v1 layout): the measured weight history
 * as a solid line, the 30-day model projection dashed with its uncertainty
 * band, and a vertical "today" marker where the two meet.
 */
export function WeightForecastChart({
  history, forecast, now,
}: {
  history: { t: number; kg: number }[];
  forecast: { day: number; value: number; low: number; high: number }[];
  now: number;
}) {
  const DAY_MS = 86_400_000;
  const data = [
    ...history.map((h) => ({ t: h.t, kg: h.kg, f: undefined as number | undefined, band: undefined as [number, number] | undefined })),
    ...forecast.map((p) => ({
      t: now + p.day * DAY_MS,
      kg: undefined as number | undefined,
      f: p.value,
      band: [p.low, p.high] as [number, number],
    })),
  ].sort((a, b) => a.t - b.t);
  const fmtDay = (t: number) =>
    new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric' }).format(new Date(t));

  return (
    <ResponsiveContainer width="100%" height={190}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <XAxis
          dataKey="t"
          type="number"
          domain={[data[0]?.t ?? now - 30 * DAY_MS, data[data.length - 1]?.t ?? now + 30 * DAY_MS]}
          tickFormatter={fmtDay}
          tick={{ fontSize: 11, fill: '#888' }}
          minTickGap={28}
        />
        <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 11, fill: '#888' }} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number, name) => (name === 'kg' ? [`${v.toFixed(1)} kg`, 'measured'] : [`${Number(v).toFixed(1)} kg (model)`, 'forecast'])}
        />
        <ReferenceLine x={now} stroke="#999" strokeDasharray="3 3" label={{ value: 'today', position: 'insideTopLeft', fontSize: 10, fill: '#888' }} />
        <Area type="monotone" dataKey="band" stroke="none" fill="#3fcb93" fillOpacity={0.15} isAnimationActive={false} connectNulls={false} />
        <Line type="monotone" dataKey="kg" stroke="#0a8e5f" strokeWidth={2} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
        <Line type="monotone" dataKey="f" stroke="#3fcb93" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
