param(
  [string]$SourcePath,
  [string]$AssetsDir,
  [string]$BuildDir,
  [string]$AndroidResDir
)

Add-Type -AssemblyName System.Drawing

function Save-Png($bitmap, $path) {
  $dir = Split-Path $path -Parent
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Resize-Square($source, $size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($source, 0, 0, $size, $size)
  $g.Dispose()
  return $bmp
}

function Resize-AdaptiveForeground($source, $size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $inner = [int][Math]::Round($size * 0.72)
  $x = [int][Math]::Round(($size - $inner) / 2)
  $g.DrawImage($source, $x, $x, $inner, $inner)
  $g.Dispose()
  return $bmp
}

function Crop-SquareTop($img) {
  $size = [Math]::Min($img.Width, [Math]::Round($img.Height * 0.58))
  $x = [Math]::Max(0, [Math]::Round(($img.Width - $size) / 2))
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $size, $size), (New-Object System.Drawing.Rectangle $x, 0, $size, $size), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  return $bmp
}

function Draw-LoginBackground($logo) {
  $width = 1920
  $height = 1080
  $bg = New-Object System.Drawing.Bitmap $width, $height
  $g = [System.Drawing.Graphics]::FromImage($bg)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

  $rect = New-Object System.Drawing.Rectangle 0, 0, $width, $height
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 8, 36, 58)), ([System.Drawing.Color]::FromArgb(255, 18, 95, 78)), 135
  $g.FillRectangle($brush, $rect)
  $brush.Dispose()

  $glow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(48, 255, 214, 120))
  $g.FillEllipse($glow, -120, -80, 900, 900)
  $glow.Dispose()

  $glow2 = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(36, 72, 201, 176))
  $g.FillEllipse($glow2, 980, 420, 980, 980)
  $glow2.Dispose()

  $logoHeight = [int]($height * 0.78)
  $logoWidth = [int]($logo.Width * ($logoHeight / $logo.Height))
  $logoX = 72
  $logoY = [int](($height - $logoHeight) / 2)

  $cm = New-Object System.Drawing.Imaging.ColorMatrix
  $cm.Matrix33 = 0.18
  $attrs = New-Object System.Drawing.Imaging.ImageAttributes
  $attrs.SetColorMatrix($cm)
  $dest = New-Object System.Drawing.Rectangle $logoX, $logoY, $logoWidth, $logoHeight
  $g.DrawImage($logo, $dest, 0, 0, $logo.Width, $logo.Height, [System.Drawing.GraphicsUnit]::Pixel, $attrs)
  $attrs.Dispose()

  $overlay = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(120, 6, 31, 41)), ([System.Drawing.Color]::FromArgb(40, 6, 31, 41)), 0
  $g.FillRectangle($overlay, $rect)
  $overlay.Dispose()

  $g.Dispose()
  return $bg
}

if (-not (Test-Path $SourcePath)) {
  Write-Error "Missing logo source: $SourcePath"
  exit 1
}

New-Item -ItemType Directory -Force -Path $AssetsDir, $BuildDir, $AndroidResDir | Out-Null

$loaded = [System.Drawing.Image]::FromFile($SourcePath)
$fullLogo = New-Object System.Drawing.Bitmap $loaded
$iconSource = Crop-SquareTop $fullLogo

Save-Png $fullLogo (Join-Path $AssetsDir "smile-trust-logo.png")
Save-Png $iconSource (Join-Path $AssetsDir "smile-trust-icon-mark.png")

$loginBg = Draw-LoginBackground $fullLogo
Save-Png $loginBg (Join-Path $AssetsDir "smile-trust-login-bg.png")
$loginBg.Dispose()

$sizes = @(
  @{ file = "smile-trust-icon.png"; size = 256; android = $false; adaptive = $false },
  @{ file = "smile-trust-icon-192.png"; size = 192; android = $false; adaptive = $false },
  @{ file = "smile-trust-icon-512.png"; size = 512; android = $false; adaptive = $false },
  @{ file = "mipmap-mdpi\ic_launcher.png"; size = 48; android = $true; adaptive = $false },
  @{ file = "mipmap-hdpi\ic_launcher.png"; size = 72; android = $true; adaptive = $false },
  @{ file = "mipmap-xhdpi\ic_launcher.png"; size = 96; android = $true; adaptive = $false },
  @{ file = "mipmap-xxhdpi\ic_launcher.png"; size = 144; android = $true; adaptive = $false },
  @{ file = "mipmap-xxxhdpi\ic_launcher.png"; size = 192; android = $true; adaptive = $false },
  @{ file = "mipmap-mdpi\ic_launcher_foreground.png"; size = 108; android = $true; adaptive = $true },
  @{ file = "mipmap-hdpi\ic_launcher_foreground.png"; size = 162; android = $true; adaptive = $true },
  @{ file = "mipmap-xhdpi\ic_launcher_foreground.png"; size = 216; android = $true; adaptive = $true },
  @{ file = "mipmap-xxhdpi\ic_launcher_foreground.png"; size = 324; android = $true; adaptive = $true },
  @{ file = "mipmap-xxxhdpi\ic_launcher_foreground.png"; size = 432; android = $true; adaptive = $true }
)

foreach ($entry in $sizes) {
  if ($entry.adaptive) {
    $resized = Resize-AdaptiveForeground $iconSource $entry.size
  } else {
    $resized = Resize-Square $iconSource $entry.size
  }
  if ($entry.android) {
    $target = Join-Path $AndroidResDir $entry.file
  } else {
    $target = Join-Path $AssetsDir $entry.file
  }
  Save-Png $resized $target
  $resized.Dispose()
  if ($entry.android -and $entry.file -like "*\ic_launcher.png") {
    $round = $target.Replace("ic_launcher.png", "ic_launcher_round.png")
    Copy-Item $target $round -Force
  }
}

$icoSizes = @(16, 32, 48, 64, 128, 256)
foreach ($size in $icoSizes) {
  $resized = Resize-Square $iconSource $size
  Save-Png $resized (Join-Path $BuildDir "icon-$size.png")
  $resized.Dispose()
}

$iconSource.Dispose()
$fullLogo.Dispose()
$loaded.Dispose()

Write-Output "BRAND_ASSETS_OK"
