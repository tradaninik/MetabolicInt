// devdata-target.ts - resolve which dev.db the running app reads.
// Installed by MetabolicInt-2e.ps1. Transit-safe: ASCII, lines <= 84.
// Output contract (parsed by the PS1):
//   ENVFILE/ENVRAW/SCHEMADS/RULEDB/ALTDB/APPDB - resolution facts
//   CAND <path> users= demo= entries= foods=   - probe per candidate
//   TARGET <path> / REASON <why> / OTHER <path> / RESOLVE-OK / FATAL
// Read-only: this script never writes to any database.

import * as fs from 'fs'
import * as path from 'path'

function die(s: string): never {
  console.log('FATAL ' + s)
  process.exit(1)
  throw new Error('unreachable')
}

async function run(): Promise<void> {
  const out = (s: string) => console.log(s)
  const warn = (s: string) => out('WARN ' + s)

  // this file lives at apps/web/scripts/devdata-target.ts
  let here = ''
  try {
    here = __dirname
  } catch {
    here = ''
  }
  const selfName = 'devdata-target.ts'
  if (!here || !fs.existsSync(path.join(here, selfName))) {
    here = path.dirname(process.argv[1] || '.')
  }
  const webroot = path.resolve(here, '..')
  const prismaDir = path.join(webroot, 'prisma')
  const schemaPath = path.join(prismaDir, 'schema.prisma')

  // ---- prisma client module (the same one the app uses) ----
  let pmod: any = null
  try {
    pmod = await import('@prisma/client')
  } catch {
    pmod = null
  }
  if (!pmod || !pmod.PrismaClient) {
    die('@prisma/client not resolvable from apps/web/scripts')
  }
  const NewClient: any = pmod.PrismaClient

  // ---- args ----
  const args = process.argv.slice(2)
  let explicitDb = ''
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--db' && i + 1 < args.length) {
      explicitDb = args[++i]
    } else if (a.indexOf('--db=') === 0) {
      explicitDb = a.slice(5)
    }
  }

  out('RESOLV v1')
  if (explicitDb) out('EXPLICIT ' + explicitDb)
  if (explicitDb && !fs.existsSync(explicitDb)) {
    die('--db path does not exist: ' + explicitDb)
  }

  // ---- DATABASE_URL the way Next.js dev loads it ----
  const envOrder = ['.env.development.local', '.env.local',
    '.env.development', '.env']
  let envFile = ''
  let envRaw = ''
  for (const f of envOrder) {
    const p = path.join(webroot, f)
    if (!fs.existsSync(p)) continue
    const txt = fs.readFileSync(p, 'utf8')
    const m = txt.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/m)
    if (!m) continue
    let v = m[1].trim().replace(/^['"]|['"]$/g, '')
    const hc = v.indexOf(' #')
    if (hc > 0) v = v.slice(0, hc).trim()
    envRaw = v
    envFile = p
    break
  }
  const prismaEnv = path.join(prismaDir, '.env')
  if (fs.existsSync(prismaEnv)) {
    out('ENVPRISMA ' + prismaEnv + ' (cli-only, app ignores)')
  }
  out('ENVFILE ' + (envFile || 'none'))
  out('ENVRAW ' + (envRaw || 'none'))

  // ---- schema datasource (name + literal url if any) ----
  let dsName = 'db'
  let dsEnv = 'unknown'
  let schemaUrl = ''
  try {
    const stxt = fs.readFileSync(schemaPath, 'utf8')
    const dm = stxt.match(/datasource\s+([A-Za-z0-9_]+)\s*\{([^}]*)\}/)
    if (dm) {
      dsName = dm[1]
      const body = dm[2]
      if (/env\(\s*['"]DATABASE_URL['"]\s*\)/.test(body)) {
        dsEnv = 'env'
      }
      const lum = body.match(/url\s*=\s*['"]([^'"]+)['"]/)
      if (lum) schemaUrl = lum[1].trim()
      if (dsEnv !== 'env' && schemaUrl) dsEnv = 'literal'
    }
  } catch {
    warn('schema unreadable: ' + schemaPath)
  }
  out('SCHEMADS ' + dsName + ' url=' + dsEnv)
  if (schemaUrl && !envRaw) out('SCHEMAURL ' + schemaUrl)

  // ---- rule resolution (prisma: relative file: = schema dir) ----
  const effRaw = envRaw || (dsEnv === 'literal' ? schemaUrl : '')
  const envNonSqlite = !!envRaw && envRaw.indexOf('://') > 0
    && envRaw.indexOf('file:') !== 0
  let ruleDb = ''
  let altDb = ''
  if (effRaw) {
    let p = effRaw
    if (p.indexOf('file:') === 0) p = p.slice(5)
    if (p.indexOf('://') > 0) p = ''
    if (p) {
      try {
        p = decodeURIComponent(p)
      } catch {
        /* keep raw */
      }
      if (path.isAbsolute(p)) {
        ruleDb = path.normalize(p)
      } else {
        ruleDb = path.resolve(prismaDir, p)
        altDb = path.resolve(webroot, p)
      }
    }
  }
  out('RULEDB ' + (ruleDb || 'unresolved'))
  if (altDb && altDb !== ruleDb) out('ALTDB ' + altDb)

  // ---- app resolution: real client + same env, ask sqlite where ----
  const norm = (p: string) => path.normalize(p)
  const known = [path.join(prismaDir, 'dev.db'),
    path.join(webroot, 'dev.db')]
  if (ruleDb) known.push(ruleDb)
  if (altDb) known.push(altDb)
  if (explicitDb) known.push(explicitDb)
  const appGate = envRaw || (dsEnv === 'literal' && schemaUrl)
  let appDb = ''
  if (appGate && ruleDb && fs.existsSync(ruleDb)) {
    const prev = process.env.DATABASE_URL
    if (envRaw) process.env.DATABASE_URL = envRaw
    let pc: any = null
    try {
      pc = new NewClient()
      const rows = await pc.$queryRawUnsafe('PRAGMA database_list')
      const mainrow = rows.find((r: any) => r && r.name === 'main')
      if (mainrow && mainrow.file) appDb = String(mainrow.file)
    } catch (e: any) {
      const msg = String((e && e.message) || e).slice(0, 60)
      warn('app-resolve failed: ' + msg)
    } finally {
      if (pc) {
        try { await pc.$disconnect() } catch { /* ignore */ }
      }
      if (prev === undefined) {
        delete process.env.DATABASE_URL
      } else {
        process.env.DATABASE_URL = prev
      }
    }
  }
  if (appDb) {
    appDb = norm(appDb)
    if (known.map(norm).indexOf(appDb) < 0) {
      warn('app-resolved outside known files: ' + appDb)
      appDb = ''
    } else if (!fs.existsSync(appDb)) {
      appDb = ''
    }
  }
  out('APPDB ' + (appDb || 'unresolved'))

  // ---- dmmf: schema facts + dump for future one-round fixes ----
  let models: any[] = []
  try {
    const d = pmod.Prisma && pmod.Prisma.dmmf
    models = (d && d.datamodel && d.datamodel.models) || []
  } catch {
    models = []
  }
  if (models.length === 0) warn('dmmf unavailable (no DMODEL dump)')
  const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s)
  const findModel = (n: string) =>
    models.find((m: any) => m.name.toLowerCase() === n.toLowerCase())
  for (const m of models) {
    const scal: string[] = []
    const rel: string[] = []
    for (const f of m.fields || []) {
      if (f.kind === 'scalar') {
        scal.push(f.name)
      } else if (f.kind === 'object') {
        rel.push(f.name + ':' + f.type)
      }
    }
    const words = ['DMODEL', m.name, '|'].concat(scal, ['@rel'], rel)
    let cur = ''
    for (const w of words) {
      if (cur && (cur + ' ' + w).length > 84) {
        out(cur)
        cur = ''
      }
      cur = cur ? cur + ' ' + w : w
    }
    if (cur) out(cur)
  }

  // ---- candidates + probe ----
  const cands: string[] = []
  const push = (p: string) => {
    if (!p) return
    const n = norm(p)
    if (cands.indexOf(n) < 0) cands.push(n)
  }
  if (explicitDb) push(explicitDb)
  push(appDb)
  push(ruleDb)
  push(altDb)
  for (const d of known) push(d)

  const fwd = (p: string) => p.replace(/\\/g, '/')
  let dsOpt = ''
  const mkClient = (p: string): any => {
    const url = 'file:' + fwd(p)
    const optsList: any[] = []
    if (dsOpt === 'datasourceUrl') {
      optsList.push({ datasourceUrl: url })
    } else {
      optsList.push({ datasourceUrl: url })
      optsList.push({ datasources: { [dsName]: { url } } })
      optsList.push({ datasources: { db: { url } } })
    }
    for (const o of optsList) {
      try {
        const pc = new NewClient(o)
        if (o.datasourceUrl) dsOpt = 'datasourceUrl'
        return pc
      } catch {
        /* try next option */
      }
    }
    return null
  }
  const probes: any[] = []
  for (const c of cands) {
    if (!fs.existsSync(c)) {
      out('CAND ' + c + ' missing')
      continue
    }
    const pr: any = { p: c, users: -1, demo: false, entries: -1, foods: -1 }
    const pc = mkClient(c)
    if (!pc) {
      warn('probe failed (client construct): ' + c)
      continue
    }
    try {
      const um = findModel('User')
      if (um) {
        const uq = pc[lowerFirst(um.name)]
        pr.users = await uq.count()
        if (pr.users > 0) {
          const users = await uq.findMany({ take: 200 })
          pr.demo = users.some((u: any) => {
            const em = String(u.email || '').toLowerCase()
            const nm = String(u.name || u.fullName
              || u.displayName || '').toLowerCase()
            return em.indexOf('demo') >= 0 || nm.indexOf('demo') >= 0
          })
        }
      }
      const em2 = findModel('FoodEntry')
      if (em2) pr.entries = await pc[lowerFirst(em2.name)].count()
      const fm = findModel('Food')
      if (fm) pr.foods = await pc[lowerFirst(fm.name)].count()
      probes.push(pr)
      out('CAND ' + c + ' users=' + pr.users + ' demo='
        + (pr.demo ? 'yes' : 'no') + ' entries=' + pr.entries
        + ' foods=' + pr.foods)
    } catch (e: any) {
      const msg = String((e && e.message) || e).slice(0, 60)
      warn('probe failed ' + c + ': ' + msg)
    } finally {
      try { await pc.$disconnect() } catch { /* ignore */ }
    }
  }

  // ---- decide ----
  const exists = (p: string) => !!p && fs.existsSync(p)
  let target = ''
  let reason = ''
  if (explicitDb && exists(explicitDb)) {
    target = norm(explicitDb)
    reason = 'explicit'
  } else if (appDb && exists(appDb)) {
    target = appDb
    reason = envRaw ? 'app-env' : 'app-schema'
  } else if (ruleDb && exists(ruleDb)) {
    target = norm(ruleDb)
    reason = envRaw ? 'rule-env' : 'rule-schema'
  } else {
    const demos = probes.filter((r: any) => r.demo)
    if (envNonSqlite) {
      // env points at a non-sqlite url: refuse to guess a stray file
    } else if (demos.length === 1) {
      target = demos[0].p
      reason = 'unique-demo'
    } else if (demos.length === 0 && probes.length === 1) {
      target = probes[0].p
      reason = 'fallback-unique'
    }
  }
  for (const r of probes) {
    if (target && r.p !== target && r.demo) out('OTHER ' + r.p)
  }
  if (!target) {
    const n = probes.filter((r: any) => r.demo).length
    die('ambiguous: ' + n + ' dbs hold demo data and no env url'
      + ' resolved one; pass -DbPath "<db file>" explicitly')
  }
  out('TARGET ' + target)
  out('REASON ' + reason)
  const tProbe = probes.find((r: any) => r.p === target)
  if (tProbe && !tProbe.demo) {
    die('target db has no demo user: ' + target
      + ' - pick another via -DbPath')
  }
  if (!tProbe) warn('target not probed; writer will validate demo')
  out('RESOLVE-OK')
}

run().then(
  () => process.exit(0),
  (e: any) => {
    console.log('FATAL ' + String((e && e.message) || e))
    process.exit(1)
  }
)