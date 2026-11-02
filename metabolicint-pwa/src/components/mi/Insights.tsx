"use client";

import { Droplets, FlaskConical, Moon, Target, ChevronLeft, ChevronRight } from "lucide-react";
import { useLog, type TrendRange } from "@/lib/store";
import {
  DAY_MARKERS, DAYS90_LIST, DIWALI_INDICES, MONTHS, SUNDAY_READINGS, WEEK,
  dayTir, fastingAvg, mean, monthSeries, timeOfDayAvg, weekAvg, weekPeak, weekTir,
} from "@/lib/data";
import { ChartCard, DayChart, HBars, MonthBars, ThreeMonthCurve, VBars, WeekChart } from "./Charts";
import { ForYou, StatCard } from "./shared";

const RANGES: TrendRange[] = ["Day", "Week", "Month", "3M"];
const TIR_OF = (r: number[]) => dayTir(r);

function RangeNav({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="mt-2 flex items-center gap-2.5">
      <button onClick={onPrev} aria-label="Previous"
        className="tap flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-[0_1px_2px_rgba(28,43,51,.05),0_2px_8px_rgba(28,43,51,.04)]">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="num flex-1 text-center text-base font-bold tracking-tight">{label}</span>
      <button onClick={onNext} aria-label="Next"
        className="tap flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-[0_1px_2px_rgba(28,43,51,.05),0_2px_8px_rgba(28,43,51,.04)]">
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

export default function Insights() {
  const { trend, setTrend } = useLog();
  const { range, day, month } = trend;
  const dayData = WEEK[day];
  const isSunday = day === 3;
  const monthData = MONTHS[month];

  const dayReadings = isSunday
    ? SUNDAY_READINGS.map((r) => ({ t: parseT(r.t), label: r.label, value: r.value, time: r.t }))
    : [
        { t: 7.5, label: "Fasting", value: dayData.readings[0], time: "7:30 AM" },
        { t: 11.08, label: "After breakfast", value: dayData.readings[1], time: "11:05 AM" },
        { t: 15.17, label: "After lunch", value: dayData.readings[2], time: "3:10 PM" },
        { t: 22.5, label: "After dinner", value: dayData.readings[3], time: "10:30 PM" },
      ];
  const dayAvg = Math.round(mean(dayReadings.map((r) => r.value)));
  const dayPeak = dayReadings.reduce((a, b) => (b.value > a.value ? b : a));

  const series = monthSeries(month);
  const mAvg = Math.round(mean(series));
  const onTrack = series.filter((v) => v <= 155).length;
  const mDiwali = month === 2 ? DIWALI_INDICES : [];
  const wkStarts = [0, 7, 14, 21, 28].filter((i) => i < series.length - 3);
  const wkBuckets = wkStarts.map((i) => ({
    label: `Week ${i / 7 + 1} · ${i + 1}–${Math.min(i + 7, series.length)}`,
    value: Math.round(mean(series.slice(i, i + 7))),
  }));

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-28 pt-2 lg:max-w-2xl lg:px-8">
      <header className="px-0.5 pb-1 pt-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Glucose trends</h1>
      </header>

      {range === "Day" && (
        <RangeNav label={`${dayName(day)}, ${dayData.date}`}
          onPrev={() => setTrend({ day: (day + 6) % 7 })}
          onNext={() => setTrend({ day: (day + 1) % 7 })} />
      )}
      {range === "Month" && (
        <RangeNav label={monthData.name}
          onPrev={() => setTrend({ month: (month + 2) % 3 })}
          onNext={() => setTrend({ month: (month + 1) % 3 })} />
      )}

      {/* segmented range control */}
      <nav className="mt-3 flex gap-1 rounded-full bg-track p-1" aria-label="Choose range">
        {RANGES.map((r) => (
          <button key={r} onClick={() => setTrend({ range: r })} aria-pressed={range === r}
            className={`tap min-h-12 flex-1 rounded-full text-sm font-semibold ${
              range === r ? "bg-card font-bold text-teal-950 shadow-[0_1px_2px_rgba(28,43,51,.05),0_2px_8px_rgba(28,43,51,.04)]" : "text-ink-2"
            }`}>
            {r}
          </button>
        ))}
      </nav>

      <div className="mt-3 grid gap-3 lg:grid-cols-2 lg:items-start">
        <div className="grid grid-cols-3 gap-2 lg:col-span-2 lg:grid-cols-3">
          {range === "Day" && (
            <>
              <StatCard icon={<Droplets className="h-5 w-5" />} value={String(dayAvg)}
                label="Average glucose" sub={`${dayReadings.length} readings`} />
              <StatCard icon={<Target className="h-5 w-5" />} value={String(dayPeak.value)}
                label={`Peak · ${dayPeak.time}`} sub={`after ${(dayPeak.label.match(/breakfast|lunch|dinner|walk/) ?? ["meal"])[0]}`} />
              <StatCard icon={<Moon className="h-5 w-5" />} value={String(dayData.readings[0])}
                label="Fasting" sub="7:30 AM" />
            </>
          )}
          {range === "Week" && (
            <>
              <StatCard icon={<Droplets className="h-5 w-5" />} value={String(weekAvg)}
                label="Avg glucose" sub="−6 vs last week" />
              <StatCard icon={<Target className="h-5 w-5" />} value={`${weekTir}%`}
                label="Time in range" sub="+8 vs last week" />
              <StatCard icon={<Moon className="h-5 w-5" />} value={String(fastingAvg)}
                label="Fasting avg" sub="−4 vs last week" />
            </>
          )}
          {range === "Month" && (
            <>
              <StatCard icon={<Droplets className="h-5 w-5" />} value={String(mAvg)}
                label="Avg glucose" sub={month === 0 ? "baseline month" : `vs ${MONTHS[month - 1].avg} in ${MONTHS[month - 1].label}`} />
              <StatCard icon={<Target className="h-5 w-5" />} value={`${monthData.tir}%`}
                label="Time in range" sub={month === 0 ? "baseline" : `up from ${MONTHS[month - 1].tir}%`} />
              <StatCard icon={<Target className="h-5 w-5" />} value={`${onTrack} of ${series.length}`}
                label="Days on track" sub="avg under 155 mg/dL" />
            </>
          )}
          {range === "3M" && (
            <>
              <StatCard icon={<Droplets className="h-5 w-5" />} value={String(MONTHS[2].avg)}
                label="Avg glucose · Oct" sub={`−${MONTHS[0].avg - MONTHS[2].avg} vs August`} />
              <StatCard icon={<Target className="h-5 w-5" />} value={`${MONTHS[2].tir}%`}
                label="Time in range · Oct" sub={`up from ${MONTHS[0].tir}% in Aug`} />
              <StatCard icon={<FlaskConical className="h-5 w-5" />} value={`${MONTHS[2].a1c}%`}
                label="Est. HbA1c" sub={`${MONTHS[0].a1c}% in August`} />
            </>
          )}
        </div>

        {range === "Day" && (
          <>
            <ChartCard title={`Glucose on ${dayName(day)}`} pill={<span className="pill pill-teal num">Glucometer</span>}
              note={`Target 70–180 mg/dL · dashed: day average ${dayAvg}`}>
              <DayChart readings={dayReadings} markers={DAY_MARKERS} avg={dayAvg} />
            </ChartCard>
            <section>
              <div className="mb-2 mt-1 flex items-center justify-between px-0.5">
                <h2 className="text-[1.0625rem] font-bold tracking-tight">All readings</h2>
                <span className="pill pill-teal num">{dayReadings.length} readings</span>
              </div>
              <div className="mi-card px-4 py-1">
                {dayReadings.map((r) => (
                  <div key={r.time} className="flex items-center gap-3 border-b border-[#F0F6F2] py-2.5 last:border-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
                      <Droplets className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <b className="num block text-[.9375rem] font-semibold">{r.time}</b>
                      <span className="block text-[.8125rem] text-ink-2">{r.label}</span>
                    </div>
                    <b className="num text-base font-extrabold">{r.value}</b>
                    <span className={`pill num ${r.value > 180 ? "pill-rose" : "pill-ok"}`}>
                      {r.value > 180 ? "High" : "In range"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {range === "Week" && (
          <>
            <ChartCard title="Glucose this week" pill={<span className="pill pill-teal num">4 checks a day</span>}
              note={`Target 70–180 mg/dL · dashed: week average ${weekAvg} · peak ${weekPeak} after Sunday pongal`}>
              <WeekChart week={WEEK} />
            </ChartCard>
            <ChartCard title="Time in range by day" pill={<span className="pill pill-ok num">{weekTir}% week</span>}
              note="Share of readings in 70–180 mg/dL · Sunday was your lowest day">
              <VBars data={WEEK.map((d) => ({ label: d.label, pct: TIR_OF(d.readings) }))} />
            </ChartCard>
            <ChartCard title="By time of day" pill={<span className="pill pill-teal num">mg/dL average</span>}
              note="After dinner runs highest on most days this week">
              <HBars data={timeOfDayAvg} />
            </ChartCard>
            <ForYou note="From your last 7 days">
              After-dinner is your highest reading most days — {timeOfDayAvg[3].value} mg/dL on average this
              week. On Thursday and Tuesday, a 15-minute walk after dinner kept it under 165.
            </ForYou>
          </>
        )}

        {range === "Month" && (
          <>
            <ChartCard title={`Daily averages · ${monthData.label}`}
              pill={<span className="pill pill-teal num">1–{series.length} {monthData.label.toLowerCase()}</span>}
              note={`Target 70–180 mg/dL · dashed: month average ${mAvg} mg/dL${month === 2 ? " · coral: Diwali sweets" : ""}`}>
              <MonthBars values={series} diwali={mDiwali} avg={mAvg} nDays={series.length} />
            </ChartCard>
            <ChartCard title="Weekly averages" pill={<span className="pill pill-teal num">mg/dL</span>}
              note={month === 2 ? "Week 3 includes Diwali · back to your usual range in Week 4" : "Steady week over week"}>
              <HBars data={wkBuckets} />
            </ChartCard>
            {month === 2 ? (
              <ForYou note="From October 2025">
                Your steadiest month so far — average {MONTHS[2].avg} mg/dL with {MONTHS[2].tir}% time in
                range. Even Diwali only lifted you for two days; you were back to your usual range the very
                next week.
              </ForYou>
            ) : (
              <ForYou note={`From ${monthData.name.toLowerCase()}`}>
                Average {mAvg} mg/dL with {monthData.tir}% time in range — a solid month that set up the
                improvement that followed.
              </ForYou>
            )}
          </>
        )}

        {range === "3M" && (
          <>
            <ChartCard title="Daily average glucose" pill={<span className="pill pill-teal num">1 Aug – 29 Oct</span>}
              note={`Target 70–180 mg/dL · monthly averages: Aug ${MONTHS[0].avg}, Sep ${MONTHS[1].avg}, Oct ${MONTHS[2].avg} mg/dL`}>
              <ThreeMonthCurve values={DAYS90_LIST} diwali={DIWALI_INDICES[0]} />
            </ChartCard>
            <ChartCard title="Time in range by month" pill={<span className="pill pill-ok num">Oct {MONTHS[2].tir}%</span>}
              note="Share of readings in 70–180 mg/dL · October still in progress">
              <VBars big data={MONTHS.map((m) => ({ label: m.label, pct: m.tir }))} />
            </ChartCard>
            <ForYou note="From your last 90 days">
              Your average glucose is {MONTHS[0].avg - MONTHS[2].avg} mg/dL lower than August, and time in
              range improved from {MONTHS[0].tir}% to {MONTHS[2].tir}%. Morning walks and earlier dinners
              are working — keep it up.
            </ForYou>
          </>
        )}
      </div>
    </main>
  );
}

function dayName(i: number) {
  return ["Thursday", "Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"][i];
}

function parseT(t: string) {
  const [hm, ap] = [t.slice(0, -3), t.slice(-2)];
  const [h, m] = hm.split(":").map(Number);
  return (ap === "PM" && h !== 12 ? h + 12 : ap === "AM" && h === 12 ? 0 : h) + m / 60;
}
