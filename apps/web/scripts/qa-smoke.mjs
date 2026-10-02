// Automated smoke test against the LIVE deployment.
// Usage: node scripts/qa-smoke.mjs [baseUrl]
// Auth: NextAuth credentials flow (demo account). Writes one meal, then
// PATCH + DELETE (self-cleaning). No glucose writes (no delete endpoint yet).
// Known expected side effect: the first model refit snaps the stored seeded
// sensitivity to the computed prior - pre-registered engine behavior, not a bug.
const base = (process.argv[2] || 'https://metabolic-int-web-vignan-guild.vercel.app').replace(/\/+$/, '');
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
  console.log('QA smoke against:', base);

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
  const authed = profileRes.status === 200;
  check('login (credentials flow)', authed, authed ? '' : 'profile returned ' + profileRes.status + ' - check field names in src/lib/auth.ts');

  const idliRes = await req('/api/foods?q=idli');
  const idliJson = await idliRes.json();
  check('food search (idli)', idliRes.status === 200 && (idliJson.foods?.length ?? 0) > 0, idliJson.foods?.[0]?.name || '');
  const biryaniRes = await req('/api/foods?q=biryani');
  const biryaniJson = await biryaniRes.json();
  check('food search (biryani, unfiltered)', biryaniRes.status === 200 && (biryaniJson.foods?.length ?? 0) > 0, (biryaniJson.foods?.length ?? 0) + ' results');
  const regionRes = await req('/api/foods?q=biryani&region=south_indian');
  check('food search with region param', regionRes.status === 200, 'status ' + regionRes.status);

  if (!authed) {
    console.log('\nAuthenticated checks skipped (login failed).');
    return finish();
  }

  const profile = await profileRes.json();
  check('profile has sensitivity + model fields',
    typeof profile.sensitivity === 'number' && typeof profile.isPrior === 'boolean' && typeof profile.sampleSize === 'number',
    'sensitivity ' + profile.sensitivity);

  const mealsRes = await req('/api/meals');
  const mealsJson = await mealsRes.json();
  check('GET /api/meals', mealsRes.status === 200 && Array.isArray(mealsJson.entries), (mealsJson.entries?.length ?? 0) + ' entries');

  // Use a clearly carb-rich food so the check-in derivation fires (15g floor).
  const riceRes = await req('/api/foods?q=rice');
  const riceJson = await riceRes.json();
  const postFood = riceJson.foods?.[0] || idliJson.foods?.[0];
  const loggedAt = Date.now() - 10 * 60_000;
  const postRes = await req('/api/meals', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ foodId: postFood.id, portionType: 'serving', portionValue: 1, loggedAt }),
  });
  const postJson = await postRes.json().catch(() => ({}));
  const entryId = postJson.entry?.id;
  check('POST /api/meals (back-timed)', postRes.status === 200 && !!entryId, entryId || 'none');
  check('loggedAt honored', !!entryId && Math.abs(new Date(postJson.entry.loggedAt).getTime() - loggedAt) < 90_000);
  check('predictedSpike present', !!(postJson.predictedSpike && typeof postJson.predictedSpike.deltaMgDl === 'number'), 'delta ' + (postJson.predictedSpike?.deltaMgDl ?? 'n/a'));
  check('checkIn derived', !!postJson.checkIn, postJson.checkIn ? 'state ' + postJson.checkIn.state : 'none - under the 15g carb floor?');

  if (entryId) {
    const patchRes = await req('/api/meals', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: entryId, portionValue: 2 }),
    });
    const patchJson = await patchRes.json().catch(() => ({}));
    check('PATCH /api/meals (portion x2)', patchRes.status === 200 && patchJson.entry?.portionValue === 2, 'status ' + patchRes.status);

    const delRes = await req('/api/meals?id=' + encodeURIComponent(entryId), { method: 'DELETE' });
    const after = await req('/api/meals');
    const afterJson = await after.json();
    const gone = !(afterJson.entries || []).some((e) => e.id === entryId);
    check('DELETE /api/meals (self-cleanup)', delRes.status === 200 && gone, delRes.status === 200 ? (gone ? 'removed' : 'still listed') : 'status ' + delRes.status);
  }
  return finish();
}

function finish() {
  const fails = results.filter((r) => !r.ok).length;
  console.log('\n' + (results.length - fails) + '/' + results.length + ' checks passed.');
  if (fails > 0) {
    console.log('FAILURES:');
    for (const r of results.filter((r) => !r.ok)) console.log('  - ' + r.name);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('QA script error:', e);
  process.exitCode = 1;
});