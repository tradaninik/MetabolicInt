# MetabolicInt — Production Installation Guide

This guide takes you from the source package to a running, installable PWA on a
public HTTPS domain. Pick **one** deployment option:

| Option | Best for | Effort |
|---|---|---|
| **A. Node on a VPS / cloud VM** | Full control, cheapest long-term | ~15 min |
| **B. Docker** | Container-based infra (AWS ECS, K8s, any VPS) | ~10 min |
| **C. Vercel** | Zero server management | ~5 min |

All three serve the identical build that passed the 13-point smoke test
(tabs, 4-step text size 16→22.4 px, service worker activation, offline shell,
≥48 px tap targets, zero console errors).

---

## 0. What you need

- **A domain** with DNS pointed at your server (e.g. `app.yourdomain.com`).
- **HTTPS** — non-negotiable for a PWA: browsers only show the
  "Install app" prompt and register the service worker over HTTPS
  (or `localhost` for testing).
- **Node.js ≥ 20.9** (22 LTS recommended) **or** Bun ≥ 1.1.
- A server with **≥ 1 GB RAM / 1 vCPU** (the standalone server is light,
  ~150 MB RAM at idle).
- No database is required — the app is fully client-side (state persists in
  the browser via localStorage). `DATABASE_URL` in `.env` is unused template
  scaffolding and can be ignored.

The app is a **Next.js 16 standalone build**. After `npm run build`
everything needed to run lives in `.next/standalone/` (the build script
copies `public/` and static chunks into it automatically).

---

## Option A — Node on a VPS (fully manual, recommended)

### A1. Copy the code to the server

```bash
# on your local machine
scp -r metabolicint-pwa user@your-server:/opt/metabolicint
# or: unzip metabolicint-pwa-v1.0.0.zip on the server
```

### A2. Install dependencies

```bash
cd /opt/metabolicint
npm install          # or: bun install (bun.lock is included)
```

### A3. Build

```bash
npm run build
```

This runs `next build` and copies `public/` + static assets into
`.next/standalone/`. Expect ~10–30 s. It must end with a route table
showing `○ /` (static) and `ƒ /api`.

### A4. Start the server

```bash
cd /opt/metabolicint
PORT=3000 HOSTNAME=127.0.0.1 NODE_ENV=production \
  node .next/standalone/server.js
```

- `HOSTNAME=127.0.0.1` binds locally so the app is only reachable through
  your HTTPS reverse proxy. Use `0.0.0.0` only if you have no proxy and a
  firewall on port 3000.
- Verify: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/`
  → `200`.

### A5. Keep it running (systemd)

Create `/etc/systemd/system/metabolicint.service`:

```ini
[Unit]
Description=MetabolicInt PWA
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/metabolicint
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now metabolicint
sudo systemctl status metabolicint     # should show "active (running)"
```

### A6. HTTPS reverse proxy

**Easiest — Caddy** (automatic Let's Encrypt certificates):

```
# /etc/caddy/Caddyfile
app.yourdomain.com {
    encode gzip
    reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo systemctl reload caddy
```

**Alternative — Nginx + certbot:**

```nginx
server {
    listen 443 ssl http2;
    server_name app.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.yourdomain.com/privkey.pem;

    # never long-cache the service worker
    location = /sw.js {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "no-cache";
    }

    # hashed static assets can be cached forever
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
}
```

Run `sudo certbot --nginx -d app.yourdomain.com` for the certificates.

---

## Option B — Docker

Create this `Dockerfile` **in the package root**:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
EXPOSE 3000
CMD ["node", "server.js"]
```

Build and run:

```bash
docker build -t metabolicint .
docker run -d --name metabolicint --restart unless-stopped -p 3000:3000 metabolicint
```

Or with `docker-compose.yml`:

```yaml
services:
  web:
    build: .
    ports: ["3000:3000"]
    restart: unless-stopped
```

Put your TLS terminator (Caddy/Traefik/ALB/Cloudflare) in front of port 3000 —
remember: **HTTPS is required** for install prompts and service workers.

---

## Option C — Vercel (zero server)

```bash
npm i -g vercel
cd metabolicint-pwa
vercel --prod
```

Accept the defaults (framework auto-detected: Next.js). Vercel serves HTTPS
and correct MIME types out of the box, so the PWA works immediately at the
generated `*.vercel.app` URL (or attach your custom domain in the dashboard).
No environment variables are needed — the app does not use a database.

---

## Post-install verification checklist

Run these against your live URL:

```bash
B=https://app.yourdomain.com
curl -s -o /dev/null -w "home      %{http_code}\n"      $B/
curl -s -o /dev/null -w "manifest  %{http_code}\n"      $B/manifest.webmanifest
curl -s -o /dev/null -w "sw        %{http_code}\n"      $B/sw.js
curl -s -o /dev/null -w "icon      %{http_code}\n"      $B/icons/icon-192.png
curl -s -I $B/manifest.webmanifest | grep -i content-type
#   must be: application/manifest+json
```

Then on a real phone:

1. **Install prompt** — open the site in Chrome (Android) → menu shows
   *Install app* / *Add to Home Screen*. iOS Safari → Share →
   *Add to Home Screen*.
2. **Offline** — launch the installed app, turn on airplane mode, reopen:
   the app still loads from the service-worker cache.
3. **Text size** — More → Text size → pick *Largest* → every screen scales;
   kill and reopen the app → the choice persists (localStorage).
4. **App shortcut** — long-press the app icon (Android) → *Log a meal*
   opens straight into the Log screen.
5. Optional deeper check — `scripts/prod_smoke.py` in this package re-runs
   the full 13-point automated suite against any URL (needs Python +
   Playwright: `pip install playwright && playwright install chromium`,
   then set `BASE` inside the script to your domain).

---

## Updating to a new version

1. Replace the source files on the server.
2. **Bump the service-worker cache version** in `public/sw.js`:
   `const CACHE = "mi-v1";` → `"mi-v2"`. This is what tells already-installed
   clients to fetch fresh content (the SW uses `skipWaiting` + `clients.claim`,
   so users get the update on their next visit — no reinstall needed).
3. `npm run build && sudo systemctl restart metabolicint`
   (or `docker build ... && docker rm -f metabolicint && docker run ...`).

---

## Troubleshooting

| Symptom | Cause & fix |
|---|---|
| No "Install app" prompt | Site not served over HTTPS, or `manifest.webmanifest` returns non-200. Re-run the curl checklist. |
| Service worker not registering | `/sw.js` must be 200, same-origin, and served at the domain root scope. Check DevTools → Application → Service Workers. |
| App installs but offline fails | Precache list in `sw.js` didn't complete on first visit. Open the app once online, wait 5 s, then test offline. |
| 404s for JS/CSS after deploy | Standalone folder missing assets — make sure you ran the full `npm run build` (it copies `public/` and `.next/static` into `.next/standalone/`). |
| `npm install` fails | Node version below 20.9. Upgrade to Node 20.9+ or 22 LTS. |
| Port 3000 busy | Start with `PORT=3001` and point the proxy at it. |

---

## Package contents

```
metabolicint-pwa/
├── src/                  # Next.js 16 app (App Router, client components)
│   ├── app/              # layout.tsx (PWA metadata), page.tsx (shell + tab bar)
│   ├── components/mi/    # Dashboard, LogMeal, MealAnalysis, Foods,
│   │                     # Insights (Day/Week/Month/3M charts), More, shared
│   └── lib/              # data.ts (single-source dummy data), store.ts (zustand)
├── public/
│   ├── manifest.webmanifest   # installable-PWA manifest (+ app shortcut)
│   ├── sw.js                  # service worker: cache-first offline shell
│   ├── icons/                 # 192/512 + maskable + apple-touch icons
│   ├── fonts/                 # Inter (self-hosted, offline-safe)
│   └── photos/                # Indian meal photos used by the app
├── scripts/prod_smoke.py # 13-point production smoke test (optional tooling)
├── package.json, next.config.ts, tsconfig.json, tailwind.config.ts, ...
├── prisma/, db/          # unused template scaffolding (no DB needed)
└── .env.example
```
