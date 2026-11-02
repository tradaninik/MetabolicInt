"use client";

// Photo meal logging — the fastest logging path: snap a picture of the plate,
// let vision detect the foods and estimate portions, the user confirms
// ("portion check"), and everything lands in the tray in one tap.
//
// The component is production-shaped: `onScan` is the real integration point
// (your vision API, file in → DetectedFood[] out). The preview screen passes a
// simulated scanner with sample results — see sample-data.ts / README.
//
// Mobile-first: on phones the picker opens the rear camera directly
// (capture="environment"); on desktop it is a click-to-browse / drag-and-drop
// zone. Every estimate carries a confidence chip — honest about what the
// model is sure of, and what it guessed.

import { useEffect, useMemo, useRef, useState } from "react";

import { ConfidenceChip } from "./InsightList";
import type { DetectedFood } from "./types";

export interface PhotoMealLogProps {
  /** Analyze a photo and return detected foods (your vision API at integration). */
  onScan: (file: File) => Promise<DetectedFood[]>;
  /** Called with the confirmed items — feed these into the tray. */
  onAddToTray: (items: DetectedFood[]) => void;
}

type Phase = "idle" | "scanning" | "results" | "added";

export function PhotoMealLog({ onScan, onAddToTray }: PhotoMealLogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [items, setItems] = useState<DetectedFood[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Release the object URL when the card unmounts.
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const setPreview = (url: string | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
    setPreviewUrl(url);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file isn’t an image — pick a photo of your meal.");
      return;
    }
    setError(null);
    setPreview(URL.createObjectURL(file));
    setItems([]);
    setPhase("scanning");

    onScan(file)
      .then((detected) => {
        setItems(detected);
        setPhase("results");
      })
      .catch(() => {
        setError("Couldn’t analyze the photo — try again, or log the meal manually.");
        setPhase("idle");
      });
  };

  const adjust = (id: string, delta: number) =>
    setItems((prev) =>
      prev.map((d) =>
        d.food.id === id ? { ...d, qty: Math.max(0.5, d.qty + delta) } : d,
      ),
    );

  const remove = (id: string) => setItems((prev) => prev.filter((d) => d.food.id !== id));

  const confirm = () => {
    onAddToTray(items);
    setPhase("added");
  };

  const reset = () => {
    setPreview(null);
    setItems([]);
    setError(null);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  };

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, d) => ({
          kcal: acc.kcal + d.food.kcal * d.qty,
          carbs: acc.carbs + d.food.carbs * d.qty,
          protein: acc.protein + d.food.protein * d.qty,
          fat: acc.fat + d.food.fat * d.qty,
        }),
        { kcal: 0, carbs: 0, protein: 0, fat: 0 },
      ),
    [items],
  );

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-neutral-900">Log from a photo</h3>
      <p className="mt-0.5 text-xs text-neutral-500">
        Snap the plate — we detect the foods and estimate portions, you confirm.
      </p>

      {error ? (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      ) : null}

      {/* ── Idle: camera / drop zone ─────────────────────────── */}
      {phase === "idle" ? (
        <label
          className="relative mt-3 flex cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border-2 border-dashed border-neutral-300 bg-white px-4 py-8 text-center transition-colors hover:border-[#0a8e5f]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0]);
          }}
        >
          <span className="text-2xl leading-none" aria-hidden="true">
            📷
          </span>
          <span className="mt-1 text-sm font-medium text-neutral-900">
            Snap or upload a meal photo
          </span>
          <span className="text-xs text-neutral-500">
            Foods and portions detected for you — confirm before logging.
          </span>
          <span className="mt-0.5 text-[11px] text-neutral-400">
            On your phone this opens the camera · drag &amp; drop works here too
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Snap or upload a meal photo"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
            }}
          />
        </label>
      ) : null}

      {/* ── Scanning ─────────────────────────────────────────── */}
      {phase === "scanning" && previewUrl ? (
        <div className="mt-3 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
          <img
            src={previewUrl}
            alt="Meal photo being analyzed"
            className="h-20 w-20 shrink-0 animate-pulse rounded-lg border border-neutral-200 object-cover"
          />
          <div>
            <p className="text-sm font-medium text-neutral-900">Scanning photo…</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Detecting foods and estimating portions.
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Results: the portion check ───────────────────────── */}
      {phase === "results" ? (
        <div className="mt-3">
          <div className="flex items-center gap-3">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL
              <img
                src={previewUrl}
                alt="Your meal photo"
                className="h-14 w-14 shrink-0 rounded-lg border border-neutral-200 object-cover"
              />
            ) : null}
            <p className="text-xs text-neutral-500">
              Detected <span className="font-medium text-neutral-900">{items.length}</span>{" "}
              {items.length === 1 ? "food" : "foods"} — check the portions look right, then add.
            </p>
          </div>

          <ul className="mt-2">
            {items.map((d) => (
              <li
                key={d.food.id}
                className="flex items-start gap-3 border-b border-neutral-100 py-3 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-medium text-neutral-900">{d.food.name}</p>
                    <ConfidenceChip level={d.confidence} />
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {d.note ?? `Detected portion: ${d.qty} × ${d.food.serving}`}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {Math.round(d.food.kcal * d.qty)} kcal · {Math.round(d.food.carbs * d.qty)} g
                    carbs · {Math.round(d.food.protein * d.qty)} g protein ·{" "}
                    {Math.round(d.food.fat * d.qty)} g fat
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Reduce ${d.food.name}`}
                    onClick={() => adjust(d.food.id, -0.5)}
                    className="h-10 w-10 rounded-lg border border-neutral-300 text-base text-neutral-600 hover:bg-neutral-50"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm tabular-nums text-neutral-900">
                    {Number.isInteger(d.qty) ? d.qty : d.qty.toFixed(1)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase ${d.food.name}`}
                    onClick={() => adjust(d.food.id, 0.5)}
                    className="h-10 w-10 rounded-lg border border-neutral-300 text-base text-neutral-600 hover:bg-neutral-50"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${d.food.name}`}
                    onClick={() => remove(d.food.id)}
                    className="ml-1 h-10 w-8 text-neutral-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-2 rounded-lg bg-neutral-50 px-3 py-2">
            <p className="text-xs text-neutral-600">
              <span className="font-medium text-neutral-900">Detected total:</span>{" "}
              {Math.round(totals.kcal)} kcal · {Math.round(totals.carbs)} g carbs ·{" "}
              {Math.round(totals.protein)} g protein · {Math.round(totals.fat)} g fat
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-400">
              Estimates from the photo — values may vary. Adjust anything above before logging.
            </p>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={confirm}
              disabled={items.length === 0}
              className="h-10 w-full rounded-lg bg-[#0a8e5f] px-5 text-sm font-medium text-white hover:bg-[#07724c] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              Portions look right — add to tray
            </button>
            <button
              type="button"
              onClick={reset}
              className="h-10 w-full rounded-lg border border-neutral-300 px-4 text-sm text-neutral-700 hover:bg-neutral-50 sm:w-auto"
            >
              Use a different photo
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Added ────────────────────────────────────────────── */}
      {phase === "added" ? (
        <div className="mt-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0a8e5f]/10">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3.5 8.5 6.5 11.5 12.5 5"
                  stroke="#0a8e5f"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900">Added to your tray</p>
              <p className="text-xs text-neutral-500">
                Review the totals below and log when ready — you can still adjust portions there.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-3 h-10 rounded-lg border border-neutral-300 px-4 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Scan another photo
          </button>
        </div>
      ) : null}
    </div>
  );
}
