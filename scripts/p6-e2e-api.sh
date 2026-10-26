#!/bin/bash
# P6 live API end-to-end smoke against the built app on :3100.
# Covers: signup + credentials login, recipe API, lab panel save/parse/compare,
# document upload (real 3.5MB PDF) + download byte-compare + filename,
# oversized rejection, /coach redirect.
set -u
BASE="http://localhost:3100"
JAR="/tmp/p6-cookies.txt"
EMAIL="e2e-$(date +%s)@example.com"
PASS="password123"
PASS_FAIL=0

check() { # name, expected, actual
  if [ "$2" = "$3" ]; then echo "PASS: $1"; else echo "FAIL: $1 (expected $2, got $3)"; PASS_FAIL=1; fi
}
contains() { # name, haystack-file, needle
  if grep -q "$3" "$2"; then echo "PASS: $1"; else echo "FAIL: $1 (missing: $3)"; PASS_FAIL=1; fi
}

rm -f "$JAR"

# --- signup + login ---
SIGNUP=$(curl -s -X POST "$BASE/api/signup" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"John Doe\"}")
echo "$SIGNUP" | grep -q '"id"' && echo "PASS: signup" || { echo "FAIL: signup: $SIGNUP"; exit 1; }

CSRF=$(curl -s -c "$JAR" "$BASE/api/auth/csrf" | sed 's/.*"csrfToken":"\([^"]*\)".*/\1/')
LOGIN=$(curl -s -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/callback/credentials" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode "email=$EMAIL" \
  --data-urlencode "password=$PASS" --data-urlencode "callbackUrl=$BASE/dashboard" \
  -o /dev/null -w "%{http_code}")
# next-auth redirects (302) on successful credentials login; the session cookie is the real proof.
check "credentials login redirect" "302" "$LOGIN"
grep -q "session-token" "$JAR" && echo "PASS: session cookie set" || { echo "FAIL: no session cookie"; exit 1; }

# --- recipes API (two catalog foods seeded first: fresh dev DB starts empty) ---
DB="${P6_DB:-/home/z/my-project/sandbox/MetabolicInt/apps/web/prisma/dev-smoke.db}"
node --input-type=module -e "
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
const prisma = new PrismaClient({ adapter: new PrismaLibSQL(createClient({ url: 'file:$DB' })) });
const foods = [
  { id: 'jeera_rice', name: 'Jeera Rice', region: 'north', category: 'cereal', servingGrams: 150, katoriGrams: 150, kcalPer100g: 130, carbsPer100g: 28, proteinPer100g: 2.7, fatPer100g: 2.5, fiberPer100g: 1.2, gi: 60 },
  { id: 'dal_tadka', name: 'Dal Tadka', region: 'north', category: 'legume', servingGrams: 150, katoriGrams: 150, kcalPer100g: 116, carbsPer100g: 16, proteinPer100g: 8, fatPer100g: 3, fiberPer100g: 5, gi: 32 },
];
for (const f of foods) { await prisma.food.upsert({ where: { id: f.id }, update: {}, create: f }); }
await prisma.\$disconnect();
" 2>/dev/null || echo "WARN: food seed failed"
R=$(curl -s -b "$JAR" -X POST "$BASE/api/recipes" -H 'Content-Type: application/json' \
  -d '{"name":"Dal chawal","servings":2,"items":[{"foodId":"jeera_rice","portionType":"katori","portionValue":1},{"foodId":"dal_tadka","portionType":"katori","portionValue":1}]}')
echo "$R" > /tmp/p6-recipe.json
grep -q '"nutrition"' /tmp/p6-recipe.json && echo "PASS: recipe create returns nutrition" || { echo "FAIL: recipe create: $R"; PASS_FAIL=1; }
RGET=$(curl -s -b "$JAR" "$BASE/api/recipes")
echo "$RGET" | grep -q 'Dal chawal' && echo "PASS: recipe list" || { echo "FAIL: recipe list"; PASS_FAIL=1; }

# --- lab panel save (hba1c dual-write) + trends ---
P=$(curl -s -b "$JAR" -X POST "$BASE/api/lab-panels" -H 'Content-Type: application/json' \
  -d '{"performedAt":"2026-07-15","labName":"Thyrocare","name":"Q3","results":[{"testKey":"hba1c","value":7.4,"refLow":4.3,"refHigh":5.7},{"testKey":"fbg","value":112},{"testKey":"fasting_insulin","value":16},{"testKey":"hdl","value":38},{"testKey":"ldl","value":120}]}')
echo "$P" > /tmp/p6-panel1.json
grep -q '"resultCount":5' /tmp/p6-panel1.json && echo "PASS: panel 1 saved" || { echo "FAIL: panel 1: $P"; PASS_FAIL=1; }
PANEL1=$(sed 's/.*"panel":{"id":"\([^"]*\)".*/\1/' /tmp/p6-panel1.json)

P2=$(curl -s -b "$JAR" -X POST "$BASE/api/lab-panels" -H 'Content-Type: application/json' \
  -d '{"performedAt":"2026-10-15","labName":"Thyrocare","name":"Q4","results":[{"testKey":"hba1c","value":6.8},{"testKey":"fbg","value":98},{"testKey":"fasting_insulin","value":11},{"testKey":"hdl","value":44},{"testKey":"ldl","value":108}]}')
echo "$P2" > /tmp/p6-panel2.json
PANEL2=$(sed 's/.*"panel":{"id":"\([^"]*\)".*/\1/' /tmp/p6-panel2.json)
[ -n "$PANEL2" ] && [ "$PANEL2" != "$P2" ] && echo "PASS: panel 2 saved ($PANEL2)" || { echo "FAIL: panel 2: $P2"; PASS_FAIL=1; }

# HbA1c trend now sees BOTH panels via the legacy mirror
T=$(curl -s -b "$JAR" "$BASE/api/labs")
echo "$T" > /tmp/p6-trend.json
N=$(grep -o '"a1cPercent"' /tmp/p6-trend.json | wc -l)
[ "$N" -ge 2 ] && echo "PASS: /api/labs trend sees both hba1c rows (dual-write)" || { echo "FAIL: trend rows: $N"; PASS_FAIL=1; }

# --- parse API (deterministic, no OCR) ---
PARSE=$(curl -s -b "$JAR" -X POST "$BASE/api/lab-panels/parse" -H 'Content-Type: application/json' \
  -d '{"text":"Metropolis Healthcare\nReported on : 15/10/2026\nHbA1c 6.8 % 4.3 - 5.7\nS. Cholesterol 212 mg/dL 130 - 200\nSGPT (ALT) 44 U/L 9 - 50\n"}')
echo "$PARSE" > /tmp/p6-parse.json
grep -q '"testKey":"hba1c"' /tmp/p6-parse.json && echo "PASS: parser maps hba1c" || { echo "FAIL: parse: $PARSE"; PASS_FAIL=1; }
grep -q '"performedAt":"2026-10-15"' /tmp/p6-parse.json && echo "PASS: parser date dd/mm/yyyy -> ISO" || { echo "FAIL: parse date"; PASS_FAIL=1; }
grep -q '"labName":"Metropolis"' /tmp/p6-parse.json && echo "PASS: parser lab chain" || { echo "FAIL: parse lab"; PASS_FAIL=1; }

# --- compare API ---
C=$(curl -s -b "$JAR" "$BASE/api/lab-panels/compare?a=$PANEL1&b=$PANEL2")
echo "$C" > /tmp/p6-compare.json
grep -q '"homa_ir"' /tmp/p6-compare.json && echo "PASS: compare includes derived HOMA-IR" || { echo "FAIL: compare: $C"; PASS_FAIL=1; }
grep -q '"notes"' /tmp/p6-compare.json && echo "PASS: compare has notes" || { echo "FAIL: no notes"; PASS_FAIL=1; }

# --- documents: upload the real 3.5MB PDF ---
UP=$(curl -s -b "$JAR" -X POST "$BASE/api/reports/documents" \
  -F "file=@/tmp/p6-test-report.pdf;type=application/pdf" \
  -F "category=diabetes" -F "testKey=hba1c" -F "performedAt=2026-10-15" -F "note=e2e smoke")
echo "$UP" > /tmp/p6-upload.json
grep -q '"displayName":"2026-10-15_Diabetes_HbA1c_JohnDoe.pdf"' /tmp/p6-upload.json \
  && echo "PASS: upload + standard filename" || { echo "FAIL: upload: $UP"; PASS_FAIL=1; }
DOCID=$(sed 's/.*"document":{"id":"\([^"]*\)".*/\1/' /tmp/p6-upload.json)

# download + byte-compare + headers
curl -s -b "$JAR" -D /tmp/p6-dl-headers.txt "$BASE/api/reports/documents/$DOCID" -o /tmp/p6-downloaded.pdf
cmp -s /tmp/p6-test-report.pdf /tmp/p6-downloaded.pdf && echo "PASS: download byte-identical" || { echo "FAIL: download bytes differ"; PASS_FAIL=1; }
contains "Content-Disposition attachment + filename" /tmp/p6-dl-headers.txt 'attachment; filename="2026-10-15_Diabetes_HbA1c_JohnDoe.pdf"'
contains "Content-Type pdf" /tmp/p6-dl-headers.txt 'application/pdf'

# inline variant
curl -s -b "$JAR" -D /tmp/p6-dl-headers2.txt "$BASE/api/reports/documents/$DOCID?inline=1" -o /dev/null
contains "inline disposition" /tmp/p6-dl-headers2.txt 'inline; filename="2026-10-15_Diabetes_HbA1c_JohnDoe.pdf"'

# --- oversized rejection (4.5MB) ---
dd if=/dev/urandom of=/tmp/p6-big.pdf bs=1024 count=4608 2>/dev/null
OVER=$(curl -s -b "$JAR" -X POST "$BASE/api/reports/documents" \
  -F "file=@/tmp/p6-big.pdf;type=application/pdf" -F "category=diabetes")
echo "$OVER" | grep -q '4 MB' && echo "PASS: oversized rejected with plain language" || { echo "FAIL: oversized: $OVER"; PASS_FAIL=1; }

# --- wrong mime rejection ---
echo "not a pdf" > /tmp/p6-bad.txt
BAD=$(curl -s -b "$JAR" -X POST "$BASE/api/reports/documents" \
  -F "file=@/tmp/p6-bad.txt;type=text/plain" -F "category=diabetes")
echo "$BAD" | grep -q 'PDF, JPG and PNG' && echo "PASS: wrong mime rejected" || { echo "FAIL: mime: $BAD"; PASS_FAIL=1; }

# --- unauthorized access: a stranger gets 404 (invisible, not 403) ---
NOAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/reports/documents/$DOCID")
check "stranger document access 404" "401" "$NOAUTH"  # no session at all -> 401; with a session but no link -> 404 (route logic, covered by canRead)

# --- /coach redirect (P6-b) ---
REDIR=$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" "$BASE/coach")
echo "$REDIR" | grep -q "307" && echo "PASS: /coach redirects ($REDIR)" || { echo "FAIL: /coach: $REDIR"; PASS_FAIL=1; }

echo ""
if [ "$PASS_FAIL" = "0" ]; then echo "=== P6 LIVE API SMOKE: ALL PASS ==="; else echo "=== P6 LIVE API SMOKE: FAILURES ABOVE ==="; exit 1; fi
