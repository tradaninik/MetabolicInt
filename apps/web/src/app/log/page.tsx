'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import PostMealFeedback from '@/components/PostMealFeedback';
import RecentMeals from '@/components/RecentMeals';
import DayTagPicker from '@/components/DayTagPicker'; // Phase 2c: day-context tags
import AddCustomFood from '@/components/AddCustomFood'; // C2: F1 form mount
import { blendRecipe } from '@/lib/recipe-blend'; // C3: F3 tray-as-food blend
import type { Food, GlucoseSpike } from '@mi/engine';
import {
  macrosForGrams,
  netCarbsG,
  estimateGlucoseSpike,
  doshaFoodAdvice,
  mealTasteBalance,
  istMinuteOfDay,
  lateMealBanner,
  checkViruddha,
  VIRUDDHA_SEVERITY_META,
  VIRUDDHA_DISCLAIMER,
  RASA_ORDER,
  RASA_META,
  type ViruddhaFinding,
} from '@mi/engine';
import { FOOD_INDEX, REGION_LABELS, tasteOf, viruddhaTagsOf, findViruddhaTagsByName } from '@mi/food-db'; // C2: FOOD_INDEX for the placeholder count
import { classifyMealType } from '@/lib/meal-bits';
import { PLATES, getPlateItems } from '@/lib/plates';
import { enqueueMeals, registerMealSync } from '@/lib/offlineQueue'; // P5-b: offline meal queue

interface TrayItem {
  food: Food;
  portionType: 'serving' | 'katori' | 'grams';
  portionValue: number;
}

interface EntryLite {
  kcal: number;
  carbsG: number;
  loggedAt: string;
}

const CATEGORY_CHIPS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Grains', value: 'cereal' },
  { label: 'Dals & beans', value: 'legume' },
  { label: 'Vegetables', value: 'vegetable' },
  { label: 'Fruits', value: 'fruit' },
  { label: 'Dairy', value: 'dairy' },
  { label: 'Eggs', value: 'egg' },
  { label: 'Meat', value: 'meat' },
  { label: 'Fish', value: 'fish' },
  { label: 'Nuts', value: 'nut' },
  { label: 'Snacks', value: 'snack' },
  { label: 'Sweets', value: 'sweet' },
  { label: 'Drinks', value: 'beverage' },
  { label: 'Fats', value: 'fat' },
];

const WHEN_OPTIONS: { label: string; minutes: number }[] = [
  { label: 'Just now', minutes: 0 },
  { label: '30 min ago', minutes: 30 },
  { label: '1 hr ago', minutes: 60 },
  { label: '2 hrs ago', minutes: 120 },
  { label: '3 hrs ago', minutes: 180 },
];

function itemGrams(it: TrayItem): number {
  if (it.portionType === 'grams') return it.portionValue;
  if (it.portionType === 'katori') return it.portionValue * (it.food.katoriGrams ?? it.food.servingGrams);
  return it.portionValue * it.food.servingGrams;
}

export default function LogPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [fallback, setFallback] = useState(false);
  const [category, setCategory] = useState('');
  const [region, setRegion] = useState('');
  const [sensitivity, setSensitivity] = useState(1.5);
  const [diabetic, setDiabetic] = useState(false);
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [whenMin, setWhenMin] = useState(0);
  const [notes, setNotes] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [offlineSavedMsg, setOfflineSavedMsg] = useState<string | null>(null); // P5-b
  const [error, setError] = useState<string | null>(null);
  const [postMeal, setPostMeal] = useState<{ loggedAt: number; name: string; dueAt: number } | null>(null);
  // P4c-b / U17: educational banner after saving a meal deep in a low-agni IST window.
  const [agniBanner, setAgniBanner] = useState<{ title: string; body: string } | null>(null);
  // P4c-c / U19: amber pairing notes returned by the meals API after a save
  // (same-meal window - catches cross-tray combos like milk 40 minutes ago + fish now).
  const [viruddhaBanner, setViruddhaBanner] = useState<ViruddhaFinding[] | null>(null);
  const [comboName, setComboName] = useState('');
  const [myCombos, setMyCombos] = useState<{ id: string; name: string; items: { food: Food; portionType: 'serving' | 'katori' | 'grams'; portionValue: number }[] }[]>([]);
  const [comboMsg, setComboMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // C2: custom-foods state - Mine chip, the form mount, portion memory.
  const [mineOnly, setMineOnly] = useState(false);
  const [addFoodPanel, setAddFoodPanel] = useState<{ mode: 'search' | 'recipe'; initial: Record<string, unknown> } | null>(null);
  const [lastPortions, setLastPortions] = useState<Record<string, { portionType: 'serving' | 'katori' | 'grams'; portionValue: number }>>({});
  const [portionHint, setPortionHint] = useState<string | null>(null);

  // Load user's saved combos.
  useEffect(() => {
    fetch('/api/combos')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.combos) setMyCombos(d.combos); })
      .catch(() => {});
  }, []);

  // Load user sensitivity for the live preview.
  useEffect(() => {
    fetch('/api/me/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setSensitivity(d.sensitivity ?? 1.5);
          setDiabetic(!!d.diabetic);
          if (d.region) setRegion(d.region);
        }
      })
      .catch(() => {});
  }, []);

  // C2 (F7 portion memory): the last portion used per food becomes the
  // default when adding it again ("last time: 2 katori") - a default,
  // never a demand. Entries arrive newest-first, so the first sighting of
  // a foodId is its most recent portion.
  useEffect(() => {
    fetch('/api/meals')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const entries = (d?.entries ?? []) as { foodId: string; portionType: 'serving' | 'katori' | 'grams'; portionValue: number }[];
        const map: Record<string, { portionType: 'serving' | 'katori' | 'grams'; portionValue: number }> = {};
        for (const e of entries) {
          if (!map[e.foodId]) map[e.foodId] = { portionType: e.portionType, portionValue: e.portionValue };
        }
        setLastPortions(map);
      })
      .catch(() => {});
  }, []);

  // Debounced search / browse. Empty query + a category chip = browse that category.
  useEffect(() => {
    if (!query.trim() && !category && !mineOnly) {
      setResults([]);
      setFallback(false);
      return;
    }
    const t = setTimeout(async () => {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (region) params.set('region', region);
      if (category) params.set('category', category);
      if (mineOnly) params.set('mine', '1'); // C2 (F6): the Mine chip
      const res = await fetch(`/api/foods?${params.toString()}`);
      if (res.ok) {
        const j = await res.json();
        if (j.foods.length === 0 && region && !mineOnly) {
          const p2 = new URLSearchParams();
          if (query.trim()) p2.set('q', query.trim());
          if (category) p2.set('category', category);
          if (mineOnly) p2.set('mine', '1');
          const res2 = await fetch(`/api/foods?${p2.toString()}`);
          if (res2.ok) {
            const j2 = await res2.json();
            setResults(j2.foods);
            setFallback(true);
            return;
          }
        }
        setResults(j.foods);
        setFallback(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, region, category, mineOnly]);

  const whenMs = useMemo(() => Date.now() - whenMin * 60_000, [whenMin]);

  const items = useMemo(
    () =>
      tray.map((it) => {
        const grams = itemGrams(it);
        const macros = macrosForGrams(it.food, grams);
        const nc = netCarbsG(macros.carbsG, macros.fiberG);
        return { it, grams, macros, nc };
      }),
    [tray],
  );

  const totals = useMemo(() => {
    let kcal = 0;
    let carbs = 0;
    let protein = 0;
    let fat = 0;
    let nc = 0;
    let giW = 0;
    let giWt = 0;
    for (const x of items) {
      kcal += x.macros.kcal;
      carbs += x.macros.carbsG;
      protein += x.macros.proteinG;
      fat += x.macros.fatG;
      nc += x.nc;
      const w = Math.max(x.nc, 1);
      giW += x.it.food.gi * w;
      giWt += w;
    }
    return { kcal, carbs, protein, fat, nc, gi: giWt > 0 ? giW / giWt : 0 };
  }, [items]);

  const previewSpike: GlucoseSpike | null =
    items.length > 0
      ? estimateGlucoseSpike({ carbsG: totals.nc, gi: totals.gi, sensitivity, mealAt: whenMs })
      : null;

  const band = previewSpike
    ? previewSpike.deltaMgDl <= (diabetic ? 30 : 20)
      ? 'green'
      : previewSpike.deltaMgDl <= (diabetic ? 60 : 40)
        ? 'yellow'
        : 'red'
    : null;

  const mealType = items.length > 0 ? classifyMealType(whenMs, totals.nc) : null;

  // P4c-b / U16: "Tastes in this meal" - the Ayurveda lens over the current tray.
  // Items without classical taste data (custom foods) count toward totals only.
  const tasteBalance = useMemo(
    () => mealTasteBalance(items.map((x) => tasteOf(x.it.food.id) ?? {})),
    [items],
  );

  // P4c-c / U19: classical pairing check (viruddha ahara) over the current tray -
  // the same check the saved-combo path flows through, since loading a combo fills
  // this tray. Curated foods resolve by id; customs by exact name/alias match.
  // Clean trays show nothing; findings render amber with both lenses, never red.
  const viruddhaFindings = useMemo(
    () =>
      checkViruddha(
        items.map((x) => ({
          key: x.it.food.id,
          label: x.it.food.name,
          tags:
            viruddhaTagsOf(x.it.food.id) ??
            findViruddhaTagsByName(x.it.food.name, x.it.food.aliases ?? []) ??
            [],
        })),
      ),
    [items],
  );

  // What-if 1: halve the top-carb item (macros are linear in grams, so nc/2 is exact).
  const halfPortion = useMemo(() => {
    if (items.length === 0) return null;
    let topIdx = -1;
    let topNc = -1;
    items.forEach((x, i) => {
      if (x.nc > topNc) {
        topNc = x.nc;
        topIdx = i;
      }
    });
    if (topIdx < 0 || tray[topIdx].portionValue / 2 < 0.5) return null;
    let nc = 0;
    let giW = 0;
    let giWt = 0;
    items.forEach((x, i) => {
      const effNc = i === topIdx ? x.nc / 2 : x.nc;
      nc += effNc;
      const w = Math.max(effNc, 1);
      giW += x.it.food.gi * w;
      giWt += w;
    });
    return {
      idx: topIdx,
      name: tray[topIdx].food.name,
      spike: estimateGlucoseSpike({ carbsG: nc, gi: giWt > 0 ? giW / giWt : 0, sensitivity, mealAt: whenMs }),
    };
  }, [items, tray, sensitivity, whenMs]);

  // What-if 2: a 15-minute walk after the meal (the engine applies its own adjustment).
  const walkSpike: GlucoseSpike | null =
    items.length > 0
      ? estimateGlucoseSpike({ carbsG: totals.nc, gi: totals.gi, sensitivity, mealAt: whenMs, activityAfterMin: 15 })
      : null;

  function trayLabel(): string {
    if (tray.length === 0) return 'meal';
    if (tray.length === 1) return tray[0].food.name;
    const two = tray.slice(0, 2).map((t) => t.food.name).join(' + ');
    return tray.length > 2 ? `${two} +${tray.length - 2} more` : two;
  }

  async function saveCombo() {
    if (tray.length === 0) return;
    const nm = comboName.trim();
    if (!nm) { setComboMsg('Give your combo a name first.'); return; }
    try {
      const res = await fetch('/api/combos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nm, items: tray.map((x) => ({ food: x.food, portionType: x.portionType, portionValue: x.portionValue })) }),
      });
      if (!res.ok) throw new Error();
      const j = await res.json();
      setMyCombos((prev) => [j.combo, ...prev].slice(0, 30));
      setComboName('');
      setComboMsg('Saved. One tap re-logs this meal.');
    } catch {
      setComboMsg('Could not save the combo. Please try again.');
    }
  }

  function loadComboIntoTray(i: number) {
    const c = myCombos[i];
    if (!c || c.items.length === 0) return;
    setTray(c.items.map((x) => ({ food: x.food, portionType: x.portionType, portionValue: x.portionValue })));
    setSavedMsg(null);
    setError(null);
  }

  async function removeCombo(id: string) {
    try {
      const res = await fetch('/api/combos?id=' + encodeURIComponent(id), { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setMyCombos((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // removal is a convenience - silent failure is fine
    }
  }

  function addPlate(plateId: string) {
    const plate = PLATES.find((x) => x.id === plateId);
    if (!plate) return;
    const items = getPlateItems(plate);
    if (items.length === 0) return;
    setTray(items.map((x) => ({ food: x.food, portionType: x.portionType, portionValue: x.portionValue })));
    setSavedMsg(null);
    setError(null);
  }

  function addFood(f: Food) {
    setSavedMsg(null);
    setError(null);
    // C2 (F7): default to this food's last-used portion when it still
    // applies (katori only exists for foods that define one).
    const last = lastPortions[f.id];
    const applies = last !== undefined && (last.portionType !== 'katori' || f.katoriGrams != null);
    if (applies && last) {
      const unit = last.portionType === 'grams' ? 'g' : last.portionType + (last.portionValue === 1 ? '' : 's');
      setPortionHint(`${f.name}: last time was ${last.portionValue} ${unit} - change it below if this time is different.`);
    } else {
      setPortionHint(null);
    }
    setTray((t) => {
      const existing = t.findIndex((x) => x.food.id === f.id);
      if (existing >= 0) {
        const copy = [...t];
        copy[existing] = { ...copy[existing], portionValue: copy[existing].portionValue + 1 };
        return copy;
      }
      return [...t, {
        food: f,
        portionType: applies && last ? last.portionType : 'serving',
        portionValue: applies && last ? last.portionValue : 1,
      }];
    });
  }

  // C3 (F3): turn the current tray into ONE blended food. Macros are
  // gram-weighted per 100g, GI is net-carb weighted exactly like the tray
  // preview (lib/recipe-blend), servingGrams defaults to the tray total,
  // and kcal stays blank so the server applies its Atwater rule.
  function saveTrayAsFood() {
    if (items.length === 0) return;
    const b = blendRecipe(items.map((x) => ({
      grams: x.grams, netCarbsG: x.nc, gi: x.it.food.gi,
      carbsPer100g: x.it.food.carbsPer100g, proteinPer100g: x.it.food.proteinPer100g,
      fatPer100g: x.it.food.fatPer100g, fiberPer100g: x.it.food.fiberPer100g,
    })));
    setAddFoodPanel({ mode: 'recipe', initial: { name: trayLabel(), ...b } });
  }
  function updateItem(i: number, patch: Partial<TrayItem>) {
    setTray((t) => t.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function removeItem(i: number) {
    setTray((t) => t.filter((_, idx) => idx !== i));
  }

  async function handlePhoto(file: File) {
    if (file.size > 4_000_000) {
      setError('Photo is large (>4MB). Using a smaller image is recommended.');
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoPath(reader.result as string);
    reader.readAsDataURL(file);
    setSavedMsg(null);
  }

  async function save() {
    if (items.length === 0) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    setOfflineSavedMsg(null);
    setAgniBanner(null);
    setViruddhaBanner(null);
    const label = trayLabel();
    const loggedAt = whenMs;
    let lastCheckIn: { label?: string; dueAt: number } | null = null;
    let savedCount = 0;
    // P4c-c / U19: pairing notes returned by the meals API across the save loop,
    // deduplicated by pair id so a tray of milk + fish + curd shows each row once.
    const seenPairIds = new Set<string>();
    const collectedViruddha: ViruddhaFinding[] = [];
    try {
      for (let i = 0; i < tray.length; i++) {
        const it = tray[i];
        const res = await fetch('/api/meals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            foodId: it.food.id,
            portionType: it.portionType,
            portionValue: it.portionValue,
            ...(i === 0 ? { photoPath, notes } : {}),
            loggedAt,
          }),
        });
        if (!res.ok) throw new Error(`could not save ${it.food.name}`);
        const j = await res.json();
        if (j.checkIn) lastCheckIn = j.checkIn as { label?: string; dueAt: number };
        if (Array.isArray(j.viruddha?.findings)) {
          for (const f of j.viruddha.findings as ViruddhaFinding[]) {
            if (f?.pairId && !seenPairIds.has(f.pairId)) {
              seenPairIds.add(f.pairId);
              collectedViruddha.push(f);
            }
          }
        }
        savedCount++;
      }

      // Instant feedback: day so far vs the user's recent usual day. Optional - a
      // failure here never blocks the save message.
      let dayNote = '';
      try {
        const r2 = await fetch('/api/meals');
        if (r2.ok) {
          const { entries } = (await r2.json()) as { entries: EntryLite[] };
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const today = entries.filter((e) => new Date(e.loggedAt) >= todayStart);
          const kcal = Math.round(today.reduce((s, e) => s + e.kcal, 0));
          const carbs = Math.round(today.reduce((s, e) => s + e.carbsG, 0));
          const perDay = new Map<string, { kcal: number }>();
          for (const e of entries) {
            const d = new Date(e.loggedAt);
            if (d < todayStart) {
              const k = d.toDateString();
              const v = perDay.get(k) ?? { kcal: 0 };
              v.kcal += e.kcal;
              perDay.set(k, v);
            }
          }
          dayNote =
            perDay.size >= 2
              ? ` Today so far: ${kcal} kcal, ${carbs} g carbs (your usual day is around ${Math.round([...perDay.values()].reduce((s, v) => s + v.kcal, 0) / perDay.size)} kcal).`
              : ` Today so far: ${kcal} kcal, ${carbs} g carbs.`;
        }
      } catch {
        // summary is a bonus, never a blocker
      }

      const spike = previewSpike?.deltaMgDl ?? 0;
      setSavedMsg(`Logged ${label} (${mealType}). Predicted glucose rise about ${Math.round(spike)} mg/dL.${dayNote}`);
      // P4c-b / U17: the meal landed deep in a low-agni window (20:30-06:00 IST) ->
      // gentle educational banner. Normal breakfast/dinner times never trigger it.
      const banner = lateMealBanner(istMinuteOfDay(loggedAt));
      if (banner) setAgniBanner({ title: banner.title, body: banner.body });
      // P4c-c / U19: amber pairing notes from the same-meal window check.
      if (collectedViruddha.length > 0) setViruddhaBanner(collectedViruddha);
      if (lastCheckIn) {
        setPostMeal({ loggedAt, name: lastCheckIn.label ?? label, dueAt: lastCheckIn.dueAt });
      }
      setTray([]);
      setQuery('');
      setResults([]);
      setPhotoPath(null);
      setNotes('');
      setWhenMin(0);
      if (fileRef.current) fileRef.current.value = '';
      window.dispatchEvent(new Event('meals-updated'));
    } catch (err) {
      // P5-b: a network-level failure (fetch TypeError - offline, flaky
      // mobile data) queues the unsaved items on-device and replays them
      // automatically. A server rejection (bad data, auth) is NOT offline -
      // queueing it would retry a meal the server already refused.
      const remaining = tray.slice(savedCount);
      const isNetworkFailure = err instanceof TypeError;
      if (isNetworkFailure && remaining.length > 0) {
        try {
          const n = await enqueueMeals(
            remaining.map((it, idx) => ({
              foodName: it.food.name,
              body: {
                foodId: it.food.id,
                portionType: it.portionType,
                portionValue: it.portionValue,
                // photo/notes ride the first item only - same as the online path.
                ...(savedCount === 0 && idx === 0 ? { photoPath, notes } : {}),
                loggedAt,
              },
            })),
          );
          setOfflineSavedMsg(
            `Offline - saved ${n} item${n === 1 ? '' : 's'} on this phone. ${n === 1 ? 'It' : 'They'} will sync automatically once you're back online.`,
          );
          setTray([]);
          setQuery('');
          setResults([]);
          setPhotoPath(null);
          setNotes('');
          setWhenMin(0);
          if (fileRef.current) fileRef.current.value = '';
          window.dispatchEvent(new Event('mi-queue-changed'));
          await registerMealSync(); // best-effort; online-event/launch flushes also cover it
          return;
        } catch {
          // Queueing itself failed (private mode / storage full) - fall through
          // to the honest error below.
        }
      }
      setTray((t) => t.slice(savedCount));
      setError(`Saved ${savedCount} of ${tray.length} items. Could not save the rest - please try again.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Log a meal</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Add each item to your tray, set portions, and see the combined prediction for the whole meal.
        </p>

        {/* Photo capture (kept from v1) */}
        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])}
              className="text-xs"
            />
            {photoPath && <img src={photoPath} alt="meal" className="h-16 w-16 rounded-lg object-cover" />}
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">
            Photo is stored locally for now. Automatic food recognition is a later upgrade - for now, add items below.
          </p>
        </div>

        <p className="mt-6 text-xs font-medium text-neutral-500">Plates - one tap loads a full meal:</p>
        <div className="mt-2 -mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex gap-2">
            {PLATES.map((pl) => (
              <button
                key={pl.id}
                onClick={() => addPlate(pl.id)}
                title={pl.description}
                className="shrink-0 rounded-full border border-brand-200 bg-brand-50/50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-300"
              >
                {pl.name}
              </button>
            ))}
          </div>
        </div>

        {myCombos.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-medium text-neutral-500">My combos - saved by you:</p>
            <div className="mt-2 -mx-1 overflow-x-auto px-1 pb-1">
              <div className="flex gap-2">
                {myCombos.map((c, i) => (
                  <span key={c.id} className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <button type="button" onClick={() => loadComboIntoTray(i)} title={c.items.length + ' items'} className="hover:underline">{c.name}</button>
                    <button type="button" onClick={() => removeCombo(c.id)} aria-label="remove combo" className="text-neutral-400 hover:text-red-500">x</button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Category chips */}
        <div className="mt-6 -mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex gap-2">
            {CATEGORY_CHIPS.map((c) => (
              <button
                key={c.value || 'all'}
                onClick={() => setCategory(c.value)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
                  category === c.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/40 dark:text-brand-300'
                    : 'border-neutral-200 text-neutral-600 hover:border-brand-300 dark:border-neutral-800 dark:text-neutral-400'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="mt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={category ? `Search within ${CATEGORY_CHIPS.find((c) => c.value === category)?.label ?? 'category'}...` : `Search ${Object.keys(FOOD_INDEX).length} foods - dosa, biryani, chapati, pizza...`}
            className="w-full rounded-lg border border-neutral-300 bg-transparent px-4 py-3 outline-none focus:border-brand-500 dark:border-neutral-700"
          />
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-neutral-500">Region:</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
            >
              <option value="">All regions</option>
              {Object.entries(REGION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <label className="ml-2 flex cursor-pointer items-center gap-1 text-neutral-600 dark:text-neutral-400">
              <input
                type="checkbox"
                checked={mineOnly}
                onChange={(e) => setMineOnly(e.target.checked)}
                className="accent-brand-600"
              />
              Mine only
            </label>
          </div>

          {fallback && results.length > 0 && (
            <p className='mt-2 text-xs text-neutral-500'>
              No {(REGION_LABELS as Record<string, string | undefined>)[region] ?? 'regional'} matches for &quot;{query}&quot; - showing matches from all regions.
            </p>
          )}

          {results.length > 0 && (
            <ul className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              {results.map((f) => {
                // P4c-b / U16: classical taste + dosha overlay on curated foods.
                // Custom foods show nothing - honest coverage, no guessing.
                const taste = tasteOf(f.id);
                const advice = taste ? doshaFoodAdvice(taste) : null;
                return (
                  <li key={f.id}>
                    <button
                      onClick={() => addFood(f)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    >
                      <span>
                        <span className="font-medium">{f.name}</span>
                        {f.id.startsWith('custom-') && (
                          <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                            yours
                          </span>
                        )}
                        <span className="ml-2 text-xs text-neutral-400">{REGION_LABELS[f.region]} - GI {f.gi}</span>
                        {taste && advice && (
                          <span className="ml-2 inline-flex flex-wrap items-center gap-1 align-middle">
                            <span
                              title={`Classical tastes: ${taste.rasa.map((r) => RASA_META[r].label).join(', ')}${taste.virya ? ` (${taste.virya})` : ''} - educational approximation`}
                              className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                            >
                              {taste.rasa.join(' \u00b7 ')}
                            </span>
                            <span
                              title={advice.label}
                              className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300"
                            >
                              {advice.badge}
                            </span>
                          </span>
                        )}
                      </span>
                      <span className="text-xs font-medium text-brand-600">+ Add</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* C2 (F6): search-miss empty state - the quiet door into the form,
              name prefilled from the failed query (journey J1). */}
          {query.trim() && results.length === 0 && !mineOnly && (
            <div className="mt-3 rounded-lg border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Can&apos;t find &quot;{query.trim()}&quot;? You&apos;re one field away from logging it anyway.
              </p>
              <button
                type="button"
                onClick={() => { setAddFoodPanel({ mode: 'search', initial: { name: query.trim() } }); }}
                className="mt-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                Add your own food - only the name is required
              </button>
            </div>
          )}

          {mineOnly && results.length === 0 && (
            <p className="mt-3 text-sm text-neutral-500">
              Nothing here yet - foods you create show up in search with a &quot;yours&quot; badge.
            </p>
          )}

          {/* C2 (F1): the creation form. On save, the new food drops straight
              into the tray - creating should feel like logging (spec 3.2). */}
          {addFoodPanel && (
            <div className="mt-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
              <h2 className="text-lg font-semibold">{addFoodPanel.mode === 'recipe' ? 'Save this tray as one food' : 'Add your own food'}</h2>
              
              <AddCustomFood
                initial={addFoodPanel.initial}
                onCreated={(f) => {
                  const mode = addFoodPanel.mode;
                  setAddFoodPanel(null);
                  if (mode === 'recipe') {
                    // The blend replaces the tray: one plate, one item (J3).
                    setTray([{ food: f as unknown as Food, portionType: 'serving', portionValue: 1 }]);
                  } else {
                    addFood(f as unknown as Food);
                  }
                }}
                onCancel={() => setAddFoodPanel(null)}
              />
            </div>
          )}
        </div>

        {/* Tray */}
        {items.length > 0 && (
          <div className="mt-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your tray ({items.length})</h2>
              <button
                onClick={() => setTray([])}
                className="text-xs text-neutral-500 hover:underline"
              >
                Clear all
              </button>
            </div>
            {portionHint && <p className="mt-1 text-xs text-neutral-500">{portionHint}</p>}

            <ul className="mt-3 space-y-3">
              {items.map((x, i) => (
                <li key={x.it.food.id} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-sm font-medium">{x.it.food.name}</span>
                      <span className="ml-2 text-xs text-neutral-400">GI {x.it.food.gi} - {Math.round(x.nc)} g net carbs</span>
                    </div>
                    <button onClick={() => removeItem(i)} className="text-xs text-neutral-400 hover:text-red-500" aria-label="remove">
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={x.it.portionType}
                      onChange={(e) => updateItem(i, { portionType: e.target.value as TrayItem['portionType'] })}
                      className="rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
                    >
                      <option value="serving">{x.it.food.katoriGrams ? 'Serving' : 'Count (1 = one ' + x.it.food.name.toLowerCase() + ')'}</option>
                      {x.it.food.katoriGrams && <option value="katori">Katori</option>}
                      <option value="grams">Grams</option>
                    </select>
                    <input
                      type="number"
                      min={0.5} step={0.5}
                      value={x.it.portionValue}
                      onChange={(e) => updateItem(i, { portionValue: Math.max(0.5, Number(e.target.value) || 1) })}
                      className="w-20 rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
                    />
                    <span className="text-xs text-neutral-500">= {Math.round(x.grams)} g</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Calories" value={`${Math.round(totals.kcal)}`} unit="kcal" />
              <MiniStat label="Carbs" value={`${Math.round(totals.carbs)}`} unit="g" />
              <MiniStat label="Protein" value={`${Math.round(totals.protein)}`} unit="g" />
              <MiniStat label="Fat" value={`${Math.round(totals.fat)}`} unit="g" />
            </div>

            {/* P4c-b / U16: Tastes in this meal - the Ayurveda lens over the tray. */}
            {tasteBalance.coverage.known > 0 && (
              <div className="mt-4 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-neutral-500">Tastes in this meal:</span>
                  {RASA_ORDER.filter((r) => tasteBalance.counts[r] > 0).map((r) => (
                    <span
                      key={r}
                      title={RASA_META[r].hint}
                      className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                    >
                      {r}
                      {tasteBalance.counts[r] > 1 ? ` \u00d7${tasteBalance.counts[r]}` : ''}
                    </span>
                  ))}
                  {tasteBalance.dosha.badge && (
                    <span
                      title={tasteBalance.dosha.label}
                      className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300"
                    >
                      {tasteBalance.dosha.badge}
                    </span>
                  )}
                  <span className="text-[11px] text-neutral-400">
                    {tasteBalance.virya.heating > 0 || tasteBalance.virya.cooling > 0
                      ? `${tasteBalance.virya.heating} heating / ${tasteBalance.virya.cooling} cooling`
                      : ''}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-neutral-500">{tasteBalance.summary}</p>
                <p className="mt-1 text-[10px] text-neutral-400">
                  Rasa assignments are classical educational approximations - not medical advice.
                  {' '}<Link href="/healing-foods" className="underline hover:text-neutral-500">Food as Medicine →</Link>
                </p>
              </div>
            )}

            {/* P4c-c / U19: classical pairing check (viruddha ahara) over the tray.
                Amber, never red: educational tradition with both lenses shown. */}
            {viruddhaFindings.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-amber-900 dark:text-amber-200">Classical pairing check (viruddha ahara):</span>
                  <span className="rounded-full border border-amber-300 bg-amber-100/60 px-2 py-0.5 text-[10px] text-amber-800 dark:border-amber-700 dark:text-amber-300">
                    educational - amber by design, not a safety alarm
                  </span>
                </div>
                <ViruddhaNotes findings={viruddhaFindings} />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="text-xs text-neutral-500">
                When did you eat?{' '}<span suppressHydrationWarning className='text-neutral-400'>({fmtWhen(whenMs)})</span>
                <select
                  value={whenMin}
                  onChange={(e) => setWhenMin(Number(e.target.value))}
                  className="ml-2 rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
                >
                  {WHEN_OPTIONS.map((o) => (
                    <option key={o.minutes} value={o.minutes}>{o.label}</option>
                  ))}
                </select>
              </label>
              {mealType && (
                <span className="text-xs text-neutral-500">This counts as your <strong>{mealType}</strong> (about {Math.round(totals.nc)} g net carbs).</span>
              )}
            </div>

            {previewSpike && band && (
              <div className="mt-4 rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
                <div className="flex items-center justify-between">
                  <p>
                    Predicted rise for this {mealType}: <strong>+{Math.round(previewSpike.deltaMgDl)} mg/dL</strong> peaking ~{previewSpike.timeToPeakMin} min after eating.
                  </p>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${bandColor(band)}`}>
                    {band.toUpperCase()}
                  </span>
                </div>
                {band !== 'green' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {halfPortion && halfPortion.spike.deltaMgDl < previewSpike.deltaMgDl - 3 && (
                      <button
                        onClick={() =>
                          setTray((t) =>
                            t.map((x, i) =>
                              i === halfPortion.idx ? { ...x, portionValue: +(x.portionValue / 2).toFixed(2) } : x,
                            ),
                          )
                        }
                        className="rounded-full border border-brand-300 bg-brand-50 px-3 py-1 text-xs text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300"
                      >
                        One option: half portion of {halfPortion.name} - rise about +{Math.round(halfPortion.spike.deltaMgDl)} mg/dL
                      </button>
                    )}
                    {walkSpike && walkSpike.deltaMgDl < previewSpike.deltaMgDl - 3 && (
                      <span className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                        Or: a 15-min walk after - rise about +{Math.round(walkSpike.deltaMgDl)} mg/dL
                      </span>
                    )}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-neutral-500">
                  Educational estimate from your model, not medical advice.
                </p>
              </div>
            )}

            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes for this meal (optional)..."
              className="mt-4 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input
                value={comboName}
                onChange={(e) => setComboName(e.target.value)}
                placeholder="Name this combo (e.g. My Lunch Plate)"
                className="w-56 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-xs dark:border-neutral-700"
              />
              <button onClick={saveCombo} disabled={tray.length === 0}
                className="rounded-lg border border-emerald-300 px-4 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40">
                Save as combo
              </button>
              <button onClick={saveTrayAsFood} disabled={tray.length === 0}
                className="rounded-lg border border-brand-300 px-4 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/40"
              >
                Save as food
              </button>              {comboMsg && <span className="text-xs text-neutral-500">{comboMsg}</span>}
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-4 flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : `Log this meal (${items.length} item${items.length > 1 ? 's' : ''})`}
              </button>
              <button
                onClick={() => setTray([])}
                className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm dark:border-neutral-700"
              >
                Clear tray
              </button>
            </div>
          </div>
        )}

        {postMeal && <PostMealFeedback meal={postMeal} onDismiss={() => setPostMeal(null)} />}

        <DayTagPicker />
        <RecentMeals />

        {savedMsg && (
          <div className="mt-4 rounded-lg border border-brand-300 bg-brand-50 p-4 text-sm text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
            {savedMsg}{' '}
            <Link href="/dashboard" className="ml-1 font-medium underline">View dashboard</Link>
          </div>
        )}

        {/* P5-b: meals queued on-device by an offline save; sync badge lives in AppShell. */}
        {offlineSavedMsg && (
          <div
            role="status"
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            {offlineSavedMsg}
          </div>
        )}

        {/* P4c-b / U17: gentle educational banner when the meal landed in a low-agni window. */}
        {agniBanner && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-medium">{agniBanner.title}</p>
            <p className="mt-1">{agniBanner.body}</p>
            <Link href="/healing-foods" className="mt-1 inline-block text-xs font-medium underline">
              Food as Medicine: an early, light dinner →
            </Link>
          </div>
        )}

        {/* P4c-c / U19: amber pairing notes from the same-meal window after a save. */}
        {viruddhaBanner && viruddhaBanner.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-medium">Classical pairing note for what you just logged</p>
            <ViruddhaNotes findings={viruddhaBanner} />
          </div>
        )}
      </div>
    </AppShell>
  );
}

function fmtWhen(t: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(t));
}

function bandColor(band: string) {
  return band === 'green'
    ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
    : band === 'yellow'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
      : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300';
}

function MiniStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-0.5 font-semibold">{value} {unit && <span className="text-xs font-normal text-neutral-400">{unit}</span>}</div>
    </div>
  );
}

// P4c-c / U19: shared renderer for viruddha findings - used by the live tray strip
// and the post-save banner. Every finding shows the items, the severity chip, the
// classical rationale AND the modern note, so neither lens speaks alone.
function ViruddhaNotes({ findings }: { findings: ViruddhaFinding[] }) {
  return (
    <ul className="mt-2 space-y-2">
      {findings.map((f) => (
        <li key={f.pairId} className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
          <span className="font-medium">{f.items.map((i) => i.label).join(' + ')}:</span>{' '}
          <span
            title={VIRUDDHA_SEVERITY_META[f.severity].note}
            className="rounded-full border border-amber-300 bg-amber-100/70 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          >
            {VIRUDDHA_SEVERITY_META[f.severity].label}
          </span>
          <br />
          <span>Classical: {f.classical}</span>
          <br />
          <span className="text-amber-800/90 dark:text-amber-300/90">Modern lens: {f.modern}</span>
        </li>
      ))}
      <li className="pt-1 text-[10px] text-amber-700/80 dark:text-amber-400/80">
        {VIRUDDHA_DISCLAIMER}{' '}
        <Link href="/healing-foods" className="underline hover:text-amber-900 dark:hover:text-amber-200">Food as Medicine →</Link>
      </li>
    </ul>
  );
}