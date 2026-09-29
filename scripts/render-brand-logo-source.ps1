# Renders assets/smile-trust-logo-source.png from the in-repo Smile Trust mark design
# (matches assets/smile-trust-mark.svg + assets/smile-trust-logo.svg brand colors).
param(
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [int]$Size = 1024
)

Add-Type -AssemblyName System.Drawing

$dir = Split-Path $OutputPath -Parent
if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

$bmp = New-Object System.Drawing.Bitmap $Size, $Size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$rect = New-Object System.Drawing.Rectangle 0, 0, $Size, $Size
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 13, 107, 92)), ([System.Drawing.Color]::FromArgb(255, 18, 122, 104)), 135
$g.FillRectangle($brush, $rect)
$brush.Dispose()

$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc(0, 0, [int]($Size * 0.5), [int]($Size * 0.5), 180, 90)
$path.AddArc([int]($Size * 0.5), 0, [int]($Size * 0.5), [int]($Size * 0.5), 270, 90)
$path.AddArc([int]($Size * 0.5), [int]($Size * 0.5), [int]($Size * 0.5), [int]($Size * 0.5), 0, 90)
$path.AddArc(0, [int]($Size * 0.5), [int]($Size * 0.5), [int]($Size * 0.5), 90, 90)
$path.CloseFigure()
$region = New-Object System.Drawing.Region $path
$g.SetClip($region)

# Soft gold face circle (header smiley mark)
$faceBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(242, 244, 185, 66))
$facePad = [int]($Size * 0.22)
$faceSize = [int]($Size * 0.44)
$g.FillEllipse($faceBrush, $facePad, [int]($Size * 0.16), $faceSize, $faceSize)
$faceBrush.Dispose()

$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 255, 255, 255), [single]($Size * 0.055))
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$smileRect = New-Object System.Drawing.RectangleF ([single]($Size * 0.28), [single]($Size * 0.42), [single]($Size * 0.44), [single]($Size * 0.28))
$g.DrawArc($pen, $smileRect, 20, 140)
$pen.Dispose()

$eyePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 13, 78, 69), [single]($Size * 0.035))
$eyePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$eyePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawArc($eyePen, [single]($Size * 0.34), [single]($Size * 0.30), [single]($Size * 0.12), [single]($Size * 0.10), 200, 140)
$g.DrawArc($eyePen, [single]($Size * 0.54), [single]($Size * 0.30), [single]($Size * 0.12), [single]($Size * 0.10), 200, 140)
$eyePen.Dispose()

$g.ResetClip()
$region.Dispose()
$path.Dispose()
$g.Dispose()

$bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "LOGO_SOURCE_OK $OutputPath"
