// P8 Day-4 smoke: /api/recipes/by-ingredients (the "cook with what I have"
// surface) against a LIVE build. Run: node scripts/p8-byingredients-smoke.mjs
// [baseUrl] (from apps/web). Auth: NextAuth credentials flow (demo account),
// same as p8-catalog-smoke.mjs. Read-only except one idempotent save round-trip
// (POST /api/recipes/from-catalog + DELETE cleanup), so re-runs stay green.
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

// Non-increasing with an epsilon: equal coverage (ties) is valid ranking.
const covNonIncreasing = (ms) =>
  ms.every((m, i) => i === 0 || ms[i - 1].match.coverage >= m.match.coverage - 1e-9);

async function main() {
  console.log('P8 by-ingredients smoke against:', base);

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

  // --- unauth ---
  const unauth = await fetch(base + '/api/recipes/by-ingredients?ing=curd');
  check('unauth: 401', unauth.status === 401, 'status ' + unauth.status);

  // --- validation errors (plain 400s) ---
  let res = await req('/api/recipes/by-ingredients');
  let json = await res.json();
  check('no ing: 400 with ingredient hint', res.status === 400 && /ingredient/i.test(json.error || ''), json.error || '');

  res = await req('/api/recipes/by-ingredients?ing=curd&mode=fridge');
  json = await res.json();
  check('bad mode: 400 naming pantry/leftover', res.status === 400 && /pantry or leftover/i.test(json.error || ''), json.error || '');

  for (const bad of ['0', '51', '2.5', 'lots']) {
    res = await req('/api/recipes/by-ingredients?ing=curd&limit=' + bad);
    check('bad limit=' + bad + ': 400', res.status === 400);
  }

  const many = Array.from({ length: 31 }, (_, i) => 'ing_' + i).map((v) => 'ing=' + v).join('&');
  res = await req('/api/recipes/by-ingredients?' + many);
  check('31 distinct ing: 400', res.status === 400);

  // --- name / alias / id resolution ---
  res = await req('/api/recipes/by-ingredients?ing=Curd%20%28dahi%29&ing=dahi&ing=curd');
  json = await res.json();
  check('name, alias and id all resolve to one foodId', res.status === 200 &&
    json.have?.length === 1 && json.have[0] === 'curd', JSON.stringify(json.have));

  res = await req('/api/recipes/by-ingredients?ing=CURD&ing=curd&ing=Curd');
  json = await res.json();
  check('case-insensitive dedupe: one have entry', json.have?.length === 1);

  res = await req('/api/recipes/by-ingredients?ing=zzz-not-an-ingredient');
  json = await res.json();
  check('unknown value reported, not a 400', res.status === 200 &&
    Array.isArray(json.unknown) && json.unknown[0] === 'zzz-not-an-ingredient' &&
    Array.isArray(json.matches) && json.matches.length === 0);

  // --- basic ranking with a pantry of staples ---
  res = await req('/api/recipes/by-ingredients?ing=curd&ing=onion&ing=tomato');
  json = await res.json();
  check('pantry query: 200', res.status === 200);
  const matches = json.matches || [];
  check('pantry query: matches exist', matches.length > 0, String(matches.length));
  check('default limit 20 respected', matches.length <= 20, String(matches.length));
  check('every match shares at least one ingredient', matches.every((m) => m.match.matchedCount >= 1));
  check('ranked by coverage DESC', covNonIncreasing(matches));

  const first = matches[0];
  check('match row shape (recipe + match fields)', first && typeof first.id === 'string' &&
    typeof first.name === 'string' && Array.isArray(first.steps) && Array.isArray(first.items) &&
    typeof first.carbTier === 'string' && typeof first.match?.coverage === 'number' &&
    Array.isArray(first.match?.missingNames) && typeof first.match?.isLeftoverFriendly === 'boolean',
  first ? first.name : 'no row');

  // Coverage math holds on every row: parts sum to total, lists agree.
  check('coverage math: matched + missing = total on every row', matches.every((m) =>
    m.match.matchedCount + m.match.missingCount === m.match.totalCount &&
    m.match.matchedNames.length === m.match.matchedCount &&
    m.match.missingNames.length === m.match.missingCount &&
    Math.abs(m.match.coverage - m.match.matchedCount / m.match.totalCount) < 1e-9));

  // Items carry foodName + grams (grams-pinned seed contract).
  check('items carry foodName and grams', matches.every((m) =>
    m.items.length > 0 && m.items.every((it) => typeof it.foodName === 'string' && typeof it.grams === 'number')));

  // limit works
  res = await req('/api/recipes/by-ingredients?ing=curd&ing=onion&ing=tomato&limit=5');
  json = await res.json();
  check('limit=5: at most 5 rows', (json.matches || []).length <= 5, String(json.matches?.length));

  // --- leftover mode ---
  res = await req('/api/recipes/by-ingredients?ing=curd&ing=onion&ing=tomato&mode=leftover');
  json = await res.json();
  check('leftover mode: echoed in response', json.mode === 'leftover');
  check('leftover mode: still coverage DESC', covNonIncreasing(json.matches || []));
  // The boost only reorders EQUAL coverage: every leftover-friendly row must
  // be preceded only by rows with >= coverage or other friendly rows.
  const lm = json.matches || [];
  const boostOK = lm.every((m, i) => !m.match.isLeftoverFriendly ||
    lm.slice(0, i).every((p) => p.match.coverage >= m.match.coverage - 1e-9 || p.match.isLeftoverFriendly));
  check('leftover boost never outranks coverage', boostOK);

  // --- save round-trip from a match (idempotent) ---
  const target = matches[0];
  if (target) {
    // Clean any copy from a previous interrupted run first.
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
    check('save matched recipe: 201 created', res.status === 201 && json.existing === false, 'status ' + res.status);
    const savedId = json.recipe?.id;
    res = await req('/api/recipes/from-catalog', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ catalogId: target.id }),
    });
    check('save again: 200 existing:true (idempotent)', res.status === 200 && (await res.json()).existing === true);
    if (savedId) {
      const del = await req('/api/recipes?id=' + encodeURIComponent(savedId), { method: 'DELETE' });
      check('cleanup: copied recipe deleted', del.status === 200);
    }
  }

  // --- the /recipes page renders with the new view toggle ---
  res = await req('/recipes');
  const html = await res.text();
  check('/recipes page: 200', res.status === 200);
  check('/recipes page: both views present (toggle + catalog)', /Cook with what I have/i.test(html) && /Browse catalog/i.test(html));

  // --- summary ---
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + (failed.length === 0 ? 'ALL ' + results.length + ' CHECKS PASSED' : failed.length + ' OF ' + results.length + ' CHECKS FAILED'));
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
