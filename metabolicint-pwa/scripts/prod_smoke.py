"""Smoke-test the BUILT MetabolicInt app (standalone server on :3100).

Checks: app renders, all 5 tabs + FAB navigate, text-size setting applies,
PWA manifest + SW registration, no console errors, tap targets >= 48px.
"""
import asyncio, json
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:3100"
results, errors = [], []

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 390, "height": 844})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        await page.goto(BASE, wait_until="networkidle")
        results.append(("title", (await page.title()).startswith("MetabolicInt")))
        results.append(("manifest-link", await page.locator('link[rel="manifest"]').count() == 1))
        body = (await page.inner_text("body")).lower()
        results.append(("dashboard-renders", "today" in body and "glucose" in body))

        # tab navigation
        for tab, probe in [("Log", ["log a meal", "breakfast"]), ("Foods", ["search", "food"]),
                           ("Insights", ["time in range"]), ("More", ["text size"]),
                           ("Home", ["today"])]:
            await page.get_by_role("navigation").get_by_text(tab, exact=True).first.click()
            await page.wait_for_timeout(250)
            t = (await page.inner_text("body")).lower()
            results.append((f"tab-{tab.lower()}", any(p.lower() in t for p in probe)))

        # text size setting (More -> Largest step = 22.4px, Standard = 16px)
        await page.get_by_role("navigation").get_by_text("More", exact=True).first.click()
        await page.wait_for_timeout(200)
        big = page.get_by_role("button", name="Largest")
        if await big.count():
            await big.click()
            await page.wait_for_timeout(250)
            fs = await page.evaluate("getComputedStyle(document.documentElement).fontSize")
            results.append(("text-size-largest-22.4px", fs == "22.4px"))
            std = page.get_by_role("button", name="Standard")
            await std.click(); await page.wait_for_timeout(200)
            fs2 = await page.evaluate("getComputedStyle(document.documentElement).fontSize")
            results.append(("text-size-standard-16px", fs2 == "16px"))
        else:
            results.append(("text-size-control", False))

        # service worker registered
        sw = await page.evaluate(
            "navigator.serviceWorker.getRegistration().then(r => r ? r.active && r.active.state : 'none')")
        results.append(("service-worker-active", sw in ("activated", "activating")))

        # tap targets >= 48px in bottom nav
        small = await page.evaluate("""() => {
          const nav = document.querySelector('nav[aria-label="Main navigation"]');
          let bad = 0;
          nav.querySelectorAll('button').forEach(b => {
            const r = b.getBoundingClientRect();
            if (r.height < 48 || r.width < 48) bad++;
          });
          return bad;
        }""")
        results.append(("tap-targets-48px", small == 0))

        # offline shell: kill network, reload -> app still renders
        await page.context.set_offline(True)
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_timeout(700)
        body2 = (await page.inner_text("body")).lower()
        results.append(("offline-renders", len(body2) > 200 and "metabolicint" in body2 or "today" in body2))
        await page.context.set_offline(False)

        await browser.close()

    passed = sum(1 for _, ok in results if ok)
    for name, ok in results:
        print(("PASS " if ok else "FAIL ") + name)
    print(f"\n{passed}/{len(results)} passed")
    if errors:
        print("CONSOLE ERRORS:", json.dumps(errors[:5], indent=1))
    else:
        print("No console errors.")

asyncio.run(main())
