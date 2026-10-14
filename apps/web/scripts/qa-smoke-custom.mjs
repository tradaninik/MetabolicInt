// Custom foods v2 - spec section 7, checks 13-21.
// Usage (dev): cd apps\web ; npm run dev ; node scripts\qa-smoke-custom.mjs
// Usage (live): node scripts\qa-smoke-custom.mjs https://<vercel-url>
// Auth mirrors qa-smoke.mjs (NextAuth credentials). Checks 14-16 need the
// /api/foods search edit (workstream E1) and stay red until it lands.
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
const EMAIL = process.env.QA_EMAIL || 'demo@metabolic.dev';
const PASSWORD = process.env.QA_PASSWORD || 'demo1234';
// SEAM: priya's seeded credentials - if her login fails, set QA_EMAIL2/QA_PASSWORD2.
const EMAIL2 = process.env.QA_EMAIL2 || 'priya@metabolic.dev';
const PASSWORD2 = process.env.QA_PASSWORD2 || 'demo1234';

function makeSession() {
  const jar = new Map();
  const absorb = (res) => {
    for (const c of (typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [])) {
      const p = c.split(';')[0]; const eq = p.indexOf('=');
      if (eq > 0) jar.set(p.slice(0, eq).trim(), p.slice(eq + 1).trim());
    }
  };
  const req = async (path, init = {}) => {
    const res = await fetch(base + path, {
      ...init, redirect: 'manual',
      headers: { ...(init.headers || {}), ...(jar.size ? { cookie: [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ') } : {}) },
    });
    absorb(res); return res;
  };
  const login = async (email, password) => {
    const csrf = await (await req('/api/auth/csrf')).json();
    await req('/api/auth/callback/credentials', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email, password, csrfToken: csrf.csrfToken, callbackUrl: base + '/dashboard', json: 'true' }).toString(),
    });
    return (await req('/api/me/profile')).status === 200;
  };
  return { req, login };
}

const results = [];
function check(n, name, ok, detail) {
  results.push({ n, ok });
  console.log((ok ? 'PASS' : 'FAIL') + '  #' + n + ' ' + name + (detail ? '  -- ' + detail : ''));
}
function skip(n, name, why) { console.log('SKIP  #' + n + ' ' + name + '  -- ' + why); }

async function main() {
  console.log('Custom-foods smoke against:', base);
  const demo = makeSession();
  if (!(await demo.login(EMAIL, PASSWORD))) { console.log('demo login failed - aborting'); process.exitCode = 1; return; }
  const priya = makeSession();
  const priyaOk = await priya.login(EMAIL2, PASSWORD2);
  if (!priyaOk) console.log('WARNING: second-user login failed (set QA_EMAIL2/QA_PASSWORD2)');

  const json = { 'content-type': 'application/json' };
  const suffix = Date.now().toString(36);
  const name = 'Smoke Batter ' + suffix;

  // 13. demo creates it
  let res = await demo.req('/api/foods/custom', { method: 'POST', headers: json, body: JSON.stringify({ name, carbsPer100g: 40, gi: 60, servingGrams: 100 }) });
  const created = await res.json().catch(() => ({}));
  check(13, 'demo creates Smoke Batter (200, custom- id)', res.status === 200 && String(created.food?.id || '').startsWith('custom-'), 'status ' + res.status);
  const id = created.food?.id;
  if (!id) return finish();

  const q = encodeURIComponent(name);
  // 14. demo search finds it (needs E1)
  const demoHit = await (await demo.req('/api/foods?q=' + q)).json().catch(() => ({}));
  check(14, 'demo search finds it', (demoHit.foods || []).some((f) => f.id === id));
  // 15. priya does NOT find it - the load-bearing privacy check
  if (priyaOk) {
    const priyaHit = await (await priya.req('/api/foods?q=' + q)).json().catch(() => ({}));
    check(15, "priya's search does NOT find it", !(priyaHit.foods || []).some((f) => f.id === id));
  } else skip(15, "priya's search does NOT find it", 'no second user');
  // 16. mine=1 (needs E1)
  const mine = await (await demo.req('/api/foods?mine=1')).json().catch(() => ({}));
  check(16, 'mine=1 lists it, only customs', (mine.foods || []).some((f) => f.id === id) && (mine.foods || []).every((f) => String(f.id).startsWith('custom-')));

  // 17. log a back-timed meal with it - real /api/meals shape
  const loggedAt = Date.now() - 30 * 60_000;
  res = await demo.req('/api/meals', { method: 'POST', headers: json, body: JSON.stringify({ foodId: id, portionType: 'serving', portionValue: 1, loggedAt }) });
  const meal = await res.json().catch(() => ({}));
  const entryId = meal.entry?.id;
  const carbs = meal.entry?.carbs ?? meal.entry?.carbsG ?? meal.entry?.totalCarbs;
  check(17, 'logged as a meal; carbs = 40 x 1 serving', res.status === 200 && !!entryId && (carbs === undefined || Math.abs(carbs - 40) < 0.01), 'status ' + res.status + (carbs !== undefined ? ' carbs ' + carbs : ''));

  // 18. PATCH, list reflects it
  res = await demo.req('/api/foods/custom', { method: 'PATCH', headers: json, body: JSON.stringify({ id, gi: 45 }) });
  const listed = await (await demo.req('/api/foods/custom')).json().catch(() => ({}));
  check(18, 'PATCH gi=45 reflected in list', res.status === 200 && (listed.foods || []).find((f) => f.id === id)?.gi === 45, 'status ' + res.status);

  // 19. DELETE blocked with counts (the meal from 17 is the reference)
  res = await demo.req('/api/foods/custom?id=' + encodeURIComponent(id), { method: 'DELETE' });
  const blocked = await res.json().catch(() => ({}));
  check(19, 'DELETE returns 409 with counts', res.status === 409 && blocked.entryCount === 1, JSON.stringify(blocked).slice(0, 120));

  // 20. remove the entry, then the food; search confirms gone
  await demo.req('/api/meals?id=' + encodeURIComponent(entryId), { method: 'DELETE' });
  res = await demo.req('/api/foods/custom?id=' + encodeURIComponent(id), { method: 'DELETE' });
  const gone = await (await demo.req('/api/foods?q=' + q)).json().catch(() => ({}));
  check(20, 'entry then food deleted; search clean', res.status === 200 && !(gone.foods || []).some((f) => f.id === id));

  // 21. second create with recipe-computed numbers; search; delete
  res = await demo.req('/api/foods/custom', { method: 'POST', headers: json, body: JSON.stringify({ name: 'Smoke Thali ' + suffix, carbsPer100g: 55, proteinPer100g: 9, fatPer100g: 8, gi: 58, servingGrams: 450 }) });
  const second = await res.json().catch(() => ({}));
  const q2 = encodeURIComponent('Smoke Thali ' + suffix);
  const found2 = await (await demo.req('/api/foods?q=' + q2)).json().catch(() => ({}));
  check(21, 'recipe-numbers food created + found', res.status === 200 && (found2.foods || []).some((f) => f.id === second.food?.id));
  await demo.req('/api/foods/custom?id=' + encodeURIComponent(second.food?.id), { method: 'DELETE' });
  finish();
}

function finish() {
  const fails = results.filter((r) => !r.ok);
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' checks passed.');
  for (const r of fails) console.log('  - #' + r.n);
  if (fails.length) process.exitCode = 1;
}
main().catch((e) => { console.error('QA script error:', e); process.exitCode = 1; });