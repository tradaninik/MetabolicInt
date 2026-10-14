// F2: paste a packet nutrition line, get per-100g macros. Pure arithmetic
// on a user-supplied string - never interprets, recommends, diagnoses.
export interface ParsedLabel {
  carbsPer100g?: number; proteinPer100g?: number; fatPer100g?: number;
  fiberPer100g?: number; kcalPer100g?: number;
  notes: string[];
}
const r1 = (n: number) => Math.round(n * 10) / 10;

export function parseNutritionLabel(text: string): ParsedLabel {
  const notes: string[] = [];
  const out: ParsedLabel = { notes };
  if (!text || !text.trim()) { notes.push('Nothing to parse - paste the nutrition line from the packet.'); return out; }
  const t = text.toLowerCase().replace(/,/g, ' ');

  // Basis: "per 30g", "per serving (30g)", or a bare "100g".
  let basis = 100;
  const basisMatch = t.match(/per\s+(?:serving\b[^0-9]{0,5})?(\d+(?:\.\d+)?)\s*g/);
  if (basisMatch) {
    basis = parseFloat(basisMatch[1]);
    if (basis <= 0) { basis = 100; notes.push('Unusable "per Xg" on the label - assumed per 100g.'); }
  } else if (!/(^|\s)100\s*g/.test(t)) {
    notes.push('No "per Xg" found - assumed the numbers are already per 100g.');
  }
  if (basis !== 100) notes.push(`Rescaled from per ${basis}g to per 100g.`);

  const scale = (v: number) => (v * 100) / basis;
  const grab = (re: RegExp): number | undefined => {
    const m = t.match(re);
    return m ? scale(parseFloat(m[1])) : undefined;
  };
  const put = (key: 'carbsPer100g' | 'proteinPer100g' | 'fatPer100g' | 'fiberPer100g', v: number | undefined) => {
    if (v === undefined) return;
    if (v > 100) { v = 100; notes.push(`${key} capped at 100g per 100g (label implied more).`); }
    out[key] = r1(Math.max(0, v));
  };

  put('carbsPer100g',   grab(/carbohydrates?\D{0,10}?(\d+(?:\.\d+)?)\s*g\b/));
  put('proteinPer100g', grab(/protein\D{0,10}?(\d+(?:\.\d+)?)\s*g\b/));
  put('fatPer100g',     grab(/(?:total\s+)?fat\D{0,10}?(\d+(?:\.\d+)?)\s*g\b/));
  put('fiberPer100g',   grab(/fib(?:re|er)\D{0,10}?(\d+(?:\.\d+)?)\s*g\b/));

  // Energy: prefer kcal when present; convert kJ otherwise.
  const kcal = t.match(/(\d+(?:\.\d+)?)\s*(?:kcal|calories|cal)\b/);
  const kj = t.match(/(\d+(?:\.\d+)?)\s*kj\b/);
  if (kcal) out.kcalPer100g = r1(Math.min(900, scale(parseFloat(kcal[1]))));
  else if (kj) { out.kcalPer100g = r1(Math.min(900, scale(parseFloat(kj[1])) / 4.184)); notes.push('Energy converted from kJ.'); }
  return out;
}