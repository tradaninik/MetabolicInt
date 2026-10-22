# P3-1 live E2E: temp account -> login -> export downloads -> 401 signed out.
param([int]$Port = 3000)
 $base = "http://localhost:$Port"
 $stamp = Get-Date -Format 'yyyyMMddHHmmss'
 $email = "e2e-export-$stamp@example.com"
 $pass = 'E2eTest123!'
 $script:checks = 0; $script:fails = 0
 $ProgressPreference = 'SilentlyContinue'
function Check($name, $cond) {
  $script:checks++
  if ($cond) { "PASS  $name" } else { $script:fails++; "FAIL  $name" }
}
try { $csrfResp = Invoke-WebRequest -UseBasicParsing -Uri "$base/api/auth/csrf" -SessionVariable s -TimeoutSec 15 } catch { Write-Error "dev server unreachable at $base"; exit 2 }
 $csrf = ($csrfResp.Content | ConvertFrom-Json).csrfToken
Check 'csrf token fetched' ($csrf -is [string] -and $csrf.Length -gt 8)
 $signupBody = @{ email = $email; password = $pass; name = 'E2E Export' } | ConvertTo-Json
 $signup = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$base/api/signup" -ContentType 'application/json' -Body $signupBody -WebSession $s
 $signupJson = $signup.Content | ConvertFrom-Json
Check 'signup 200 with user id' ($signup.StatusCode -eq 200 -and $signupJson.id)
 $loginBody = 'csrfToken=' + [uri]::EscapeDataString($csrf) + '&email=' + [uri]::EscapeDataString($email) + '&password=' + [uri]::EscapeDataString($pass) + '&callbackUrl=' + [uri]::EscapeDataString("$base/reports") + '&json=true'
 $login = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$base/api/auth/callback/credentials" -ContentType 'application/x-www-form-urlencoded' -Body $loginBody -WebSession $s
 $cookie = @($s.Cookies.GetCookies($base) | Where-Object { $_.Name -eq 'next-auth.session-token' })
Check 'login set session cookie' ($cookie.Count -ge 1)
 $j = Invoke-WebRequest -UseBasicParsing -Uri "$base/api/export?format=json" -WebSession $s
 $jDisp = [string]$j.Headers['Content-Disposition']
 $jJson = $j.Content | ConvertFrom-Json
 $tableCount = @($jJson.tables.PSObject.Properties).Count
 $userRow = @($jJson.tables.user)[0]
Check 'json export 200 + filename + envelope' ($j.StatusCode -eq 200 -and $jDisp -match 'filename="metabolicint-backup-\d{8}-\d{4}\.json"' -and $jJson.app -eq 'MetabolicInt' -and $jJson.formatVersion -eq 1)
Check 'json export has all 21 tables' ($tableCount -eq 21)
Check 'json profile row has no passwordHash' ($null -ne $userRow -and @($userRow.PSObject.Properties.Name) -notcontains 'passwordHash')
 $c = Invoke-WebRequest -UseBasicParsing -Uri "$base/api/export?format=csv&table=labs" -WebSession $s
 $cDisp = [string]$c.Headers['Content-Disposition']
 $cType = [string]$c.Headers['Content-Type']
Check 'csv export 200 + filename + type' ($c.StatusCode -eq 200 -and $cDisp -match 'metabolicint-backup-\d{8}-\d{4}-labs\.csv' -and $cType -match 'text/csv')
try { Invoke-WebRequest -UseBasicParsing -Uri "$base/api/export?format=csv&table=nope" -WebSession $s | Out-Null; $bad = 200 } catch { $bad = [int]$_.Exception.Response.StatusCode }
Check 'unknown table answers 400' ($bad -eq 400)
 $anon = $null
try { $anon = Invoke-WebRequest -UseBasicParsing -Uri "$base/api/export?format=json" -TimeoutSec 15 } catch { $anon = $_.Exception.Response }
 $anonStatus = 0
if ($anon) { try { $anonStatus = [int]$anon.StatusCode } catch { $anonStatus = -1 } }
Check 'signed-out request answers 401' ($anonStatus -eq 401)
""
"temp account left in dev.db: $email"
"E2E RESULT: $(if ($script:fails -eq 0) { 'PASS' } else { 'FAIL' }) ($($script:checks - $script:fails)/$($script:checks) checks)"
exit $(if ($script:fails -eq 0) { 0 } else { 1 })
