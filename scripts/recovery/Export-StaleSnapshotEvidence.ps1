<#
.SYNOPSIS
  READ-ONLY export of the stale SMILE-TRUST cloud snapshot row to a local evidence file before it is
  retired (runbook docs/recovery/STALE-SNAPSHOT-RECOVERY-RUNBOOK.md, step B).

.DESCRIPTION
  * Connects only to project qouokiqoepjpoksupskb; refuses any other host or user, and refuses
    angoswtgcklnorhlosnf outright.
  * psql prompts for the database password itself. The password is never passed on the command line,
    stored in an environment variable, written to disk or printed.
  * Runs one read-only transaction (begin transaction read only ... rollback). Nothing in the
    database changes.
  * Writes the payload JSON and a metadata file into a folder outside the repository that only the
    current Windows user can read, with names marked STALE-DO-NOT-RESTORE so they can never be
    mistaken for an active snapshot.
  * Prints only file paths, byte count, top-level key count and the SHA-256 fingerprint. The payload
    (which contains member records) is never printed.
  * Fails unless the SHA-256 of the exported file equals both the fingerprint the database computes
    and the fingerprint recorded at step A.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\recovery\Export-StaleSnapshotEvidence.ps1 `
    -DbHost aws-0-<region>.pooler.supabase.com -ExpectedFingerprint <64 hex chars from step A>
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$DbHost,
  [Parameter(Mandatory = $true)][string]$ExpectedFingerprint,
  [int]$Port = 5432,
  [string]$OutDir = (Join-Path $env:LOCALAPPDATA "SmileTrustRecoveryEvidence"),
  [string]$PsqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe",
  # Only for the repository's disposable local test database on 127.0.0.1.
  [switch]$LocalTestOnly
)

$ErrorActionPreference = "Stop"
$ProjectRef = "qouokiqoepjpoksupskb"
$ForbiddenRef = "angoswtgcklnorhlosnf"

function Fail([string]$message) {
  Write-Host "STOP: $message" -ForegroundColor Red
  exit 1
}

# --- target checks -------------------------------------------------------------------------------
$hostName = $DbHost.Trim().ToLowerInvariant()
if ($hostName.Contains($ForbiddenRef)) { Fail "that host belongs to another system; it must never be accessed." }
if ($ExpectedFingerprint -notmatch '^[0-9a-f]{64}$') { Fail "ExpectedFingerprint must be the 64-character lowercase PAYLOAD FINGERPRINT from the step A checkpoint." }
$sslMode = "require"
if ($LocalTestOnly) {
  if ($hostName -ne "127.0.0.1") { Fail "-LocalTestOnly only connects to 127.0.0.1." }
  $dbUser = "postgres"
  $sslMode = "disable"
} elseif ($hostName -match '^db\.([a-z0-9]+)\.supabase\.co$') {
  if ($Matches[1] -ne $ProjectRef) { Fail "direct host is not project $ProjectRef." }
  $dbUser = "postgres"
} elseif ($hostName -match '^[a-z0-9-]+\.pooler\.supabase\.com$') {
  $dbUser = "postgres.$ProjectRef"
} else {
  Fail "host must be db.$ProjectRef.supabase.co or a *.pooler.supabase.com pooler host from the project's dashboard."
}
if (-not (Test-Path -LiteralPath $PsqlPath)) { Fail "psql not found at $PsqlPath." }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$outFull = [System.IO.Path]::GetFullPath($OutDir)
if ($outFull.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) { Fail "OutDir must be outside the repository." }
if ($outFull -match '\\OneDrive') { Fail "OutDir must not be a cloud-synchronised folder." }

# --- private output folder -----------------------------------------------------------------------
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'")
$runDir = Join-Path $outFull "STALE-DO-NOT-RESTORE_SMILE-TRUST_snapshot-id1_$stamp"
New-Item -ItemType Directory -Path $runDir -Force | Out-Null
$me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $runDir /inheritance:r /grant:r "${me}:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "could not restrict access to $runDir." }

$payloadFile = Join-Path $runDir "STALE-DO-NOT-RESTORE_payload.json"
$metaFile = Join-Path $runDir "STALE-DO-NOT-RESTORE_metadata.json"
$sqlFile = Join-Path $runDir "export.sql"
$metaForPsql = $metaFile.Replace('\', '/')
$payloadForPsql = $payloadFile.Replace('\', '/')

$sql = @"
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
\pset footer off
begin transaction read only;
select (count(*) = 1 and count(*) filter (where business_id = 'SMILE-TRUST' and id = 1) = 1) as one_stale_row
  from public.smile_trust_cloud_snapshots \gset
\if :one_stale_row
\o '$metaForPsql'
select json_build_object(
  'warning', 'STALE SNAPSHOT EVIDENCE - DO NOT RESTORE - not an active or authoritative copy',
  'project', '$ProjectRef',
  'table', 'public.smile_trust_cloud_snapshots',
  'row_id', s.id,
  'business_id', s.business_id,
  'saved_by', case when lower(btrim(s.saved_by)) in ('john', 'ama', 'kwame', 'system') then lower(btrim(s.saved_by)) else 'unrecognised' end,
  'saved_at', to_char(s.saved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'legacy_access_key_set', coalesce(s.access_key, '') <> '',
  'payload_sha256', encode(sha256(convert_to(s.payload::text, 'UTF8')), 'hex'),
  'payload_bytes', octet_length(convert_to(s.payload::text, 'UTF8')),
  'top_level_keys', (select count(*) from jsonb_object_keys(s.payload)),
  'exported_at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
)::text
from public.smile_trust_cloud_snapshots s where s.business_id = 'SMILE-TRUST' and s.id = 1;
\o '$payloadForPsql'
select s.payload::text from public.smile_trust_cloud_snapshots s where s.business_id = 'SMILE-TRUST' and s.id = 1;
\o
\else
\echo STOP: the table does not hold exactly the one stale row (id 1); nothing was exported
\endif
rollback;
"@
[System.IO.File]::WriteAllText($sqlFile, $sql, (New-Object System.Text.UTF8Encoding($false)))

# --- read-only export (psql prompts for the password) ---------------------------------------------
Write-Host "Connecting to $hostName as $dbUser (read-only). psql will ask for the database password."
$env:PGSSLMODE = $sslMode
$env:PGCLIENTENCODING = "UTF8"
$env:PGAPPNAME = "st-stale-snapshot-evidence-readonly"
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
& $PsqlPath -X -q -h $hostName -p $Port -U $dbUser -d postgres -f $sqlFile
$code = $LASTEXITCODE
Remove-Item -LiteralPath $sqlFile -Force
if ($code -ne 0) { Fail "psql exited with code $code; nothing usable was exported." }
if (-not (Test-Path -LiteralPath $payloadFile) -or -not (Test-Path -LiteralPath $metaFile)) {
  Fail "the export did not produce both files (see the psql message above)."
}

# --- normalise: psql ends the single value with a line break (CRLF on Windows); JSON text from
# jsonb never contains a raw line break, so the evidence file keeps exactly the stored text.
$bytes = [System.IO.File]::ReadAllBytes($payloadFile)
$length = $bytes.Length
while ($length -gt 0 -and ($bytes[$length - 1] -eq 10 -or $bytes[$length - 1] -eq 13)) { $length-- }
[Array]::Resize([ref]$bytes, $length)
[System.IO.File]::WriteAllBytes($payloadFile, $bytes)
$meta = Get-Content -Raw -LiteralPath $metaFile | ConvertFrom-Json
$fileHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $payloadFile).Hash.ToLowerInvariant()

if ($meta.payload_sha256 -ne $fileHash -or [int64]$meta.payload_bytes -ne $bytes.Length) {
  Rename-Item -LiteralPath $runDir -NewName ("INVALID_" + (Split-Path $runDir -Leaf))
  Fail "the exported file does not match the database fingerprint; the export was marked INVALID."
}
if ($fileHash -ne $ExpectedFingerprint) {
  Rename-Item -LiteralPath $runDir -NewName ("CHANGED_" + (Split-Path $runDir -Leaf))
  Fail "the row's fingerprint differs from step A: the snapshot changed after inspection. Do not continue to step C."
}

"$fileHash  STALE-DO-NOT-RESTORE_payload.json" | Out-File -Encoding ascii -LiteralPath (Join-Path $runDir "SHA256SUMS.txt")
Get-ChildItem -LiteralPath $runDir -File | ForEach-Object { $_.IsReadOnly = $true }

Write-Host ""
Write-Host "Evidence exported (read-only transaction, nothing changed in the database)." -ForegroundColor Green
Write-Host "  folder         : $runDir"
Write-Host "  payload bytes  : $($bytes.Length)"
Write-Host "  top-level keys : $($meta.top_level_keys)"
Write-Host "  SHA-256        : $fileHash"
Write-Host "  matches step A : yes"
Write-Host "Access is limited to $me. Do not open, copy, upload or restore this file; keep it only as evidence."
