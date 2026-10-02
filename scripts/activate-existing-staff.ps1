<#
.SYNOPSIS
  Activates an existing SMILE TRUST staff account (or verifies its sign-in) through the deployed
  staff-login Edge Function.

.DESCRIPTION
  Activate mode redeems a one-time activation code (issued with public.st_issue_staff_activation)
  and sets the password the staff member chooses. The public.app_users row keeps its uuid and role.
  Login mode checks that an activated account can sign in.

  Privileged roles (SystemOwner, KBA, Admin/AssistantManager, ManagingDirector, Accountant) must
  enroll an authenticator before the server issues a session. When that is still pending the
  script reports MFA ENROLLMENT REQUIRED (exit code 3) and points to the app's sign-in screen; it
  never displays the TOTP secret.

  The activation code, password and MFA code are read with hidden prompts and are never printed,
  logged or written to disk. Session tokens returned by the server are never printed or stored.
  No service-role or secret key is used or accepted.

  Only the production project qouokiqoepjpoksupskb is accepted. Pointing the script at another
  project requires changing $AllowedProjectRef in this file.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\activate-existing-staff.ps1 -Username john

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\activate-existing-staff.ps1 -Username john -Mode Login
#>
[CmdletBinding()]
param(
  [string]$Username = "",
  [ValidateSet("Activate", "Login")]
  [string]$Mode = "Activate",
  [string]$BusinessCode = "SMILE-TRUST",
  [string]$SupabaseUrl = "https://qouokiqoepjpoksupskb.supabase.co",
  # Optional. Only a publishable (sb_publishable_...) or anon key for the allowed project.
  [string]$PublishableKey = "",
  # Automated tests only: a loopback HTTP endpoint that stands in for staff-login.
  [string]$LocalTestEndpoint = ""
)

Set-StrictMode -Version 2
$ErrorActionPreference = "Stop"

$AllowedProjectRef = "qouokiqoepjpoksupskb"
$ExitRefused = 2
$ExitFailed = 1
$ExitMfaEnrollment = 3

function Stop-Refused([string]$message) {
  [Console]::Error.WriteLine("REFUSED: $message")
  exit $ExitRefused
}

function Get-Prop($object, [string]$name) {
  if ($null -eq $object) { return $null }
  if ($object -isnot [System.Management.Automation.PSCustomObject]) { return $null }
  $property = $object.PSObject.Properties[$name]
  if ($null -eq $property) { return $null }
  return $property.Value
}

function Read-PlainLine([string]$prompt) {
  if ([Console]::IsInputRedirected) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) { Stop-Refused "No input for: $prompt" }
    return $line
  }
  return Read-Host $prompt
}

# Hidden prompt on a console. With redirected input (automated tests) the line is read from stdin.
function Read-SecretLine([string]$prompt) {
  if ([Console]::IsInputRedirected) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) { Stop-Refused "No input for: $prompt" }
    $secure = New-Object System.Security.SecureString
    foreach ($char in $line.ToCharArray()) { $secure.AppendChar($char) }
    $line = $null
    $secure.MakeReadOnly()
    return $secure
  }
  return Read-Host $prompt -AsSecureString
}

# Runs $action with the plaintext of $secure; the unmanaged copy is zeroed and freed afterwards.
function Use-Plaintext([System.Security.SecureString]$secure, [scriptblock]$action) {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return & $action ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr))
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Get-JwtClaims([string]$token) {
  $parts = $token.Split(".")
  if ($parts.Length -ne 3) { return $null }
  $payload = $parts[1].Replace("-", "+").Replace("_", "/")
  while ($payload.Length % 4) { $payload += "=" }
  try {
    return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload)) | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Get-SafeServerMessage($data) {
  $message = $null
  foreach ($name in @("error", "message", "msg")) {
    $value = Get-Prop $data $name
    if ($value -is [string] -and $value.Trim()) { $message = $value; break }
  }
  if (-not $message) { return "(no message from server)" }
  $message = $message -replace "[\x00-\x1F\x7F]", " "
  $message = $message -replace "eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*", "[redacted]"
  $message = $message -replace "sb_(secret|publishable)_[A-Za-z0-9_-]+", "[redacted]"
  $message = $message -replace "[A-Za-z0-9+/_-]{32,}", "[redacted]"
  if ($message.Length -gt 200) { $message = $message.Substring(0, 200) + "..." }
  return $message.Trim()
}

# --- Endpoint and key checks (before anything is read or sent) ---------------------------------

if ($LocalTestEndpoint) {
  if ($LocalTestEndpoint -notmatch "^http://(127\.0\.0\.1|localhost):\d{1,5}(/[A-Za-z0-9/_-]*)?$") {
    Stop-Refused "LocalTestEndpoint must be a loopback http://127.0.0.1:<port> address."
  }
  $endpoint = $LocalTestEndpoint
  $authBase = ([Uri]$LocalTestEndpoint).GetLeftPart([UriPartial]::Authority)
} else {
  $trimmedUrl = $SupabaseUrl.Trim().TrimEnd("/")
  if ($trimmedUrl -notmatch "^https://([a-z]{20})\.supabase\.co$") {
    Stop-Refused "SupabaseUrl must be https://<project-ref>.supabase.co."
  }
  if ($Matches[1] -cne $AllowedProjectRef) {
    Stop-Refused "Project $($Matches[1]) is not the SMILE TRUST production project ($AllowedProjectRef)."
  }
  $endpoint = "$trimmedUrl/functions/v1/staff-login"
  $authBase = $trimmedUrl
}

if ($PublishableKey) {
  if ($PublishableKey.StartsWith("sb_secret_")) { Stop-Refused "Secret keys are never accepted. Use the publishable key." }
  if (-not $PublishableKey.StartsWith("sb_publishable_")) {
    $claims = Get-JwtClaims $PublishableKey
    if ($null -eq $claims -or (Get-Prop $claims "role") -ne "anon") {
      Stop-Refused "PublishableKey must be a publishable (sb_publishable_) or anon key."
    }
    if (-not $LocalTestEndpoint -and (Get-Prop $claims "ref") -ne $AllowedProjectRef) {
      Stop-Refused "PublishableKey belongs to a different project."
    }
  }
}

if ($BusinessCode -notmatch "^[A-Za-z0-9_-]{1,80}$") { Stop-Refused "Invalid business code." }

# --- Inputs --------------------------------------------------------------------------------------

if (-not $Username) { $Username = Read-PlainLine "Username" }
$usernameKey = $Username.Trim().ToLowerInvariant()
if ($usernameKey -notmatch "^[a-z0-9._@-]{1,80}$") { Stop-Refused "Invalid username." }

Write-Host "SMILE TRUST staff $($Mode.ToLowerInvariant()) for '$usernameKey' (business $BusinessCode)"
Write-Host "Server: $endpoint"

$activationCode = $null
if ($Mode -eq "Activate") {
  $activationCode = Read-SecretLine "Activation code (hidden)"
  $codeOk = Use-Plaintext $activationCode {
    param($plain)
    $normalized = $plain.ToUpperInvariant() -replace "[^A-Z0-9]", ""
    $normalized.Length -ge 8 -and $normalized.Length -le 32
  }
  if (-not $codeOk) { Stop-Refused "The activation code does not have the expected format. Nothing was sent." }

  $password = Read-SecretLine "New password (hidden, at least 8 characters)"
  $confirm = Read-SecretLine "Confirm new password (hidden)"
  $problem = Use-Plaintext $password {
    param($plain)
    $second = Use-Plaintext $confirm { param($other) $other }
    if ($plain -cne $second) { "The two passwords do not match." }
    elseif ($plain.Length -lt 8) { "The password must be at least 8 characters." }
    elseif ($plain.Length -gt 256) { "The password is too long." }
    elseif ($plain -ne $plain.Trim()) { "The password starts or ends with a space (often a paste problem)." }
    else { "" }
    $second = $null
  }
  $confirm.Dispose()
  if ($problem) { Stop-Refused "$problem Nothing was sent." }
} else {
  $password = Read-SecretLine "Password (hidden)"
  $passwordOk = Use-Plaintext $password { param($plain) $plain.Length -ge 1 -and $plain.Length -le 256 }
  if (-not $passwordOk) { Stop-Refused "Enter the account password. Nothing was sent." }
}

# --- Request -------------------------------------------------------------------------------------

Add-Type -AssemblyName System.Net.Http
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(45)

function Send-StaffLogin([System.Security.SecureString]$mfaCode) {
  $json = Use-Plaintext $password {
    param($plainPassword)
    $body = [ordered]@{ business_code = $BusinessCode; username = $usernameKey }
    if ($Mode -eq "Activate") {
      $body.action = "activate"
      $body.activation_code = Use-Plaintext $activationCode { param($plain) $plain.ToUpperInvariant() -replace "[^A-Z0-9]", "" }
      $body.new_password = $plainPassword
    } else {
      $body.action = "login"
      $body.password = $plainPassword
    }
    if ($mfaCode) { $body.mfa_code = Use-Plaintext $mfaCode { param($plain) $plain.Trim() } }
    $serialized = $body | ConvertTo-Json -Compress
    $body.Clear()
    $serialized
  }
  $request = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, $endpoint)
  if ($PublishableKey) { [void]$request.Headers.TryAddWithoutValidation("apikey", $PublishableKey) }
  $request.Content = New-Object System.Net.Http.StringContent($json, [Text.Encoding]::UTF8, "application/json")
  $json = $null
  try {
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
  } catch {
    return @{ status = 0; data = $null }
  } finally {
    $request.Dispose()
  }
  $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  $data = $null
  try { $data = $text | ConvertFrom-Json } catch { $data = $null }
  $text = $null
  return @{ status = [int]$response.StatusCode; data = $data }
}

$result = Send-StaffLogin $null
if ($result.status -eq 401 -and (Get-Prop $result.data "mfa_required") -eq $true) {
  Write-Host "This account has MFA enabled."
  $mfa = Read-SecretLine "Authenticator code (hidden, 6 digits)"
  $result = Send-StaffLogin $mfa
  $mfa.Dispose()
}

$label = "SIGN-IN"
if ($Mode -eq "Activate") { $label = "ACTIVATION" }
$status = $result.status
$data = $result.data
$result = $null

if ($status -eq 200) {
  $accessToken = Get-Prop $data "access_token"
  $appUser = Get-Prop $data "app_user"
  $returnedName = [string](Get-Prop $appUser "username")
  $role = [string](Get-Prop $appUser "role")
  $data = $null
  if (-not ($accessToken -is [string] -and $accessToken)) {
    [Console]::Error.WriteLine("$label FAILED: the server answered 200 without a session.")
    exit $ExitFailed
  }
  if ($returnedName.ToLowerInvariant() -ne $usernameKey) {
    [Console]::Error.WriteLine("$label FAILED: the server returned a different account than requested.")
    exit $ExitFailed
  }
  $sessionNote = "issued by the server; not printed and not stored"
  if ($PublishableKey) {
    try {
      $logout = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, "$authBase/auth/v1/logout?scope=local")
      [void]$logout.Headers.TryAddWithoutValidation("apikey", $PublishableKey)
      [void]$logout.Headers.TryAddWithoutValidation("Authorization", "Bearer $accessToken")
      $logoutResponse = $client.SendAsync($logout).GetAwaiter().GetResult()
      if ($logoutResponse.IsSuccessStatusCode) { $sessionNote = "issued by the server, then signed out; not printed and not stored" }
      $logout.Dispose()
    } catch { }
  }
  $accessToken = $null
  if ($Mode -eq "Activate") { Write-Host "ACTIVATION SUCCEEDED" } else { Write-Host "SIGN-IN VERIFIED" }
  Write-Host "Username: $returnedName"
  Write-Host "Role: $role"
  Write-Host "Business: $BusinessCode"
  Write-Host "Session: $sessionNote"
  if ($Mode -eq "Activate") { Write-Host "Next: run the read-only verification SQL before relying on this account." }
  $password.Dispose()
  if ($activationCode) { $activationCode.Dispose() }
  [GC]::Collect()
  exit 0
}

$password.Dispose()
if ($activationCode) { $activationCode.Dispose() }
[GC]::Collect()

# Privileged roles get no session until an authenticator is confirmed on the server. The TOTP
# secret is deliberately never shown in a terminal (terminal output can be captured); enrollment
# happens on the app's sign-in screen.
if ($status -eq 403 -and (Get-Prop $data "mfa_enrollment_required") -eq $true) {
  if ($Mode -eq "Activate") { Write-Host "ACTIVATION SUCCEEDED (password saved)" } else { Write-Host "PASSWORD ACCEPTED" }
  Write-Host "MFA ENROLLMENT REQUIRED: this role needs an authenticator app before any session is issued."
  Write-Host "Next: open the SMILE TRUST app, sign in with this username and password, choose 'Set up authenticator',"
  Write-Host "add the key to your authenticator app and confirm with a 6-digit code. Then run this script with -Mode Login."
  Write-Host "Do NOT request a new activation code."
  exit $ExitMfaEnrollment
}

[Console]::Error.WriteLine("$label FAILED")
if ($status -eq 0) {
  [Console]::Error.WriteLine("Could not reach staff-login. Check the internet connection and try again.")
  exit $ExitFailed
}
[Console]::Error.WriteLine("HTTP status: $status")
[Console]::Error.WriteLine("Server message: $(Get-SafeServerMessage $data)")
switch ($status) {
  400 { [Console]::Error.WriteLine("The request was rejected before anything was changed (format or password rules).") }
  401 {
    if ($Mode -eq "Activate") {
      [Console]::Error.WriteLine("The code is wrong, expired or already used, or the account already has a password. Nothing was changed.")
    }
    [Console]::Error.WriteLine("Each failure counts toward a 15-minute lock after 5 failures.")
  }
  404 { [Console]::Error.WriteLine("staff-login was not found on this project.") }
  429 { [Console]::Error.WriteLine("Locked after repeated failures. Wait 15 minutes before trying again.") }
  default {
    if ($Mode -eq "Activate" -and $status -ge 500) {
      [Console]::Error.WriteLine("OUTCOME UNCERTAIN: the password may already have been saved. Do NOT request a new activation code.")
      [Console]::Error.WriteLine("Run the read-only verification SQL. If password_format is pbkdf2, sign in with the password you chose (-Mode Login).")
    }
  }
}
exit $ExitFailed
