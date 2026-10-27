// P8 Day-3 smoke: /api/recipes/catalog (browse/search/pagination/errors) +
// /api/recipes/from-catalog (idempotent save) + the /recipes page, against a
// LIVE build. Run: node scripts/p8-catalog-smoke.mjs [baseUrl] (from apps/web).
// Auth: NextAuth credentials flow (demo account), same as qa-smoke.mjs.
// Self-cleaning: deletes the copied user recipe afterwards via /api/recipes.
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
const EMAIL = process.env.QA_EMAIL || 'demo@metabolic.dev';
const PASSWORD = process.env.QA_PASSWORD || 'demo1234';

const jar = new Map();
function absorb(res) {
  const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const c of cookies) {
    const pair = c.split(';')[0];
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ');
}
async function req(path, init = {}) {
  const res = await fetch(base + path, {
    ...init,
    redirect: 'manual',
    headers: { ...(init.headers || {}), ...(jar.size ? { cookie: cookieHeader() } : {}) },
  });
  absorb(res);
  return res;
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  -- ' + detail : ''));
}

async function main() {
  console.log('P8 catalog smoke against:', base);

  // --- login (credentials flow) ---
  const csrfRes = await req('/api/auth/csrf');
  const csrf = await csrfRes.json();
  const loginBody = new URLSearchParams({
    email: EMAIL, password: PASSWORD, csrfToken: csrf.csrfToken,
    callbackUrl: base + '/dashboard', json: 'true',
  });
  await req('/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: loginBody.toString(),
  });
  const profileRes = await req('/api/me/profile');
  check('login (credentials flow)', profileRes.status === 200, 'status ' + profileRes.status);

  // --- GET /api/recipes/catalog: defaults ---
  let res = await req('/api/recipes/catalog');
  let json = await res.json();
  check('catalog default: 200', res.status === 200);
  check('catalog default: 24 rows', json.recipes?.length === 24, String(json.recipes?.length));
  check('catalog default: total 300', json.total === 300, String(json.total));
  const first = json.recipes?.[0];
  check('catalog row shape (fields present)', first && typeof first.id === 'string' &&
    typeof first.name === 'string' && Array.isArray(first.steps) && Array.isArray(first.tags) &&
    Array.isArray(first.items) && typeof first.carbTier === 'string' &&
    typeof first.items[0]?.foodName === 'string',
  first ? first.name : 'no row');
  const names = (json.recipes || []).map((r) => r.name);
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  check('catalog default: name ASC order', JSON.stringify(names) === JSON.stringify(sorted));

  // --- single filters ---
  res = await req('/api/recipes/catalog?mealType=breakfast');
  json = await res.json();
  check('filter mealType=breakfast: total 50', json.total === 50, String(json.total));
  check('filter mealType=breakfast: all rows breakfast', (json.recipes || []).every((r) => r.mealType === 'breakfast'));

  res = await req('/api/recipes/catalog?carbTier=LOW&mealType=snack');
  json = await res.json();
  check('filter carbTier=LOW + snack: every row LOW snack', (json.recipes || []).every((r) => r.carbTier === 'LOW' && r.mealType === 'snack'));
  // 48 of 50 snacks compute LOW; 2 land MODERATE (within the catalog
  // invariant: <= 6 non-LOW across snack/drink/side bands).
  check('filter carbTier=LOW + snack: total 48', json.total === 48, String(json.total));

  res = await req('/api/recipes/catalog?tag=high-fiber');
  json = await res.json();
  check('filter tag=high-fiber: total 74', json.total === 74, String(json.total));
  check('filter tag=high-fiber: rows carry the tag', (json.recipes || []).every((r) => r.tags.includes('high-fiber')));

  res = await req('/api/recipes/catalog?cuisine=hyderabadi');
  json = await res.json();
  check('filter cuisine=hyderabadi: >=30', json.total >= 30, String(json.total));

  // --- search q (case-insensitive, name + nameTe) ---
  res = await req('/api/recipes/catalog?q=PANEER');
  json = await res.json();
  check('search q=PANEER (case-insensitive): matches > 0', json.total > 0, String(json.total));
  check('search q=PANEER: every row mentions paneer', (json.recipes || []).every((r) =>
    r.name.toLowerCase().includes('paneer') || (r.nameTe || '').toLowerCase().includes('paneer')));

  // --- combined filters ---
  res = await req('/api/recipes/catalog?mealType=dinner&carbTier=LOW&tag=vegan');
  json = await res.json();
  check('combined dinner+LOW+vegan: every row matches all three', (json.recipes || []).every((r) =>
    r.mealType === 'dinner' && r.carbTier === 'LOW' && r.tags.includes('vegan')));

  // --- pagination ---
  res = await req('/api/recipes/catalog?take=5&skip=0');
  json = await res.json();
  const page1 = (json.recipes || []).map((r) => r.id);
  check('pagination take=5: 5 rows', page1.length === 5);
  res = await req('/api/recipes/catalog?take=5&skip=5');
  json = await res.json();
  const page2 = (json.recipes || []).map((r) => r.id);
  check('pagination skip=5: no overlap with page 1', page1.every((id) => !page2.includes(id)));

  // --- validation errors ---
  res = await req('/api/recipes/catalog?mealType=brunch');
  json = await res.json();
  check('bad mealType: 400 with plain-language error', res.status === 400 && /breakfast/i.test(json.error || ''), json.error || '');

  res = await req('/api/recipes/catalog?take=61');
  check('bad take=61: 400', res.status === 400);
  res = await req('/api/recipes/catalog?tag=sweet');
  check('bad tag: 400', res.status === 400);

  // --- unauth ---
  const unauth = await fetch(base + '/api/recipes/catalog');
  check('unauth: 401', unauth.status === 401, 'status ' + unauth.status);

  // --- POST /api/recipes/from-catalog (idempotent save) ---
  // Pick a deterministic target: first catalog row. Clean up any leftover
  // copy from a previous (possibly interrupted) smoke run first, so the
  // "201 created" assertion is stable across re-runs.
  res = await req('/api/recipes/catalog?take=1');
  json = await res.json();
  const target = json.recipes?.[0];

  const existingList = await (await req('/api/recipes')).json();
  for (const prev of (existingList.recipes || []).filter((r) => r.name === target.name)) {
    await req('/api/recipes?id=' + encodeURIComponent(prev.id), { method: 'DELETE' });
  }

  res = await req('/api/recipes/from-catalog', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ catalogId: target.id }),
  });
  json = await res.json();
  check('save to my recipes: 201 created', res.status === 201 && json.existing === false, 'status ' + res.status);
  check('saved recipe: decorated shape', json.recipe && Array.isArray(json.recipe.items) &&
    typeof json.recipe.nutrition?.kcal === 'number' && typeof json.recipe.servings === 'number',
  json.recipe?.name || '');
  const savedId = json.recipe?.id;

  res = await req('/api/recipes/from-catalog', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ catalogId: target.id }),
  });
  json = await res.json();
  check('save again: 200 existing:true (idempotent)', res.status === 200 && json.existing === true, 'status ' + res.status);

  // The copied recipe is visible in the user's recipes list.
  res = await req('/api/recipes');
  json = await res.json();
  check('copied recipe appears in /api/recipes', (json.recipes || []).some((r) => r.id === savedId));

  res = await req('/api/recipes/from-catalog', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ catalogId: 'no-such-recipe' }),
  });
  check('unknown catalogId: 404', res.status === 404);

  // --- cleanup: remove the copied recipe so re-runs stay green ---
  if (savedId) {
    const del = await req('/api/recipes?id=' + encodeURIComponent(savedId), { method: 'DELETE' });
    check('cleanup: copied recipe deleted', del.status === 200);
  }

  // --- the /recipes page renders ---
  res = await req('/recipes');
  const html = await res.text();
  check('/recipes page: 200', res.status === 200);
  check('/recipes page: catalog UI hydrated shell', /RecipeCatalog|recipes/i.test(html) && html.length > 5000);

  // --- summary ---
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + (failed.length === 0 ? 'ALL ' + results.length + ' CHECKS PASSED' : failed.length + ' OF ' + results.length + ' CHECKS FAILED'));
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
