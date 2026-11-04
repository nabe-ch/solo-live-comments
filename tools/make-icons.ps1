# Draws the app icons with the built-in Windows graphics library (no install needed).
# Usage: powershell -ExecutionPolicy Bypass -File tools/make-icons.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'icons'
New-Item -ItemType Directory -Force $outDir | Out-Null

function Color($hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }

# rounded = true: transparent corners for the favicon. Phones round the corners themselves.
# inset: the share of the icon kept as margin, so the mark survives the maskable crop.
function Draw($size, $name, $rounded, $inset) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.Color]::Transparent)

  # Night sea background
  $sea = New-Object System.Drawing.SolidBrush (Color '#0e3a47')
  if ($rounded) {
    $r = [int]($size * 0.22)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90)
    $path.AddArc($size - 2 * $r - 1, 0, 2 * $r, 2 * $r, 270, 90)
    $path.AddArc($size - 2 * $r - 1, $size - 2 * $r - 1, 2 * $r, 2 * $r, 0, 90)
    $path.AddArc(0, $size - 2 * $r - 1, 2 * $r, 2 * $r, 90, 90)
    $path.CloseFigure()
    $g.FillPath($sea, $path)
    $g.SetClip($path)
  } else {
    $g.FillRectangle($sea, 0, 0, $size, $size)
  }

  # All marks are placed in a 0-1 square inside the margin
  $m = $size * $inset
  $s = $size - 2 * $m
  function X($v) { $m + $s * $v }

  # Two swells of the sea along the bottom of the full icon
  $tide = New-Object System.Drawing.SolidBrush (Color '#1c5a66')
  $wave = New-Object System.Drawing.Drawing2D.GraphicsPath
  $y = $size * 0.8
  $wave.AddBezier(0, $y, ($size * 0.25), ($y - $size * 0.09), ($size * 0.45), ($y + $size * 0.09), ($size * 0.7), $y)
  $wave.AddBezier(($size * 0.7), $y, ($size * 0.8), ($y - $size * 0.04), ($size * 0.92), ($y - $size * 0.04), $size, $y)
  $wave.AddLine($size, $y, $size, $size)
  $wave.AddLine($size, $size, 0, $size)
  $wave.CloseFigure()
  $g.FillPath($tide, $wave)

  # Sand-colored speech bubble with its tail
  $sand = New-Object System.Drawing.SolidBrush (Color '#fbeec1')
  $g.FillEllipse($sand, (X 0.08), (X 0.06), ($s * 0.84), ($s * 0.7))
  $tail = @(
    (New-Object System.Drawing.PointF (X 0.26), (X 0.62)),
    (New-Object System.Drawing.PointF (X 0.46), (X 0.72)),
    (New-Object System.Drawing.PointF (X 0.18), (X 0.9))
  )
  $g.FillPolygon($sand, [System.Drawing.PointF[]]$tail)

  # Question mark
  $font = New-Object System.Drawing.Font 'Segoe UI', ($s * 0.46), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = 'Center'
  $fmt.LineAlignment = 'Center'
  $ink = New-Object System.Drawing.SolidBrush (Color '#0e3a47')
  $box = New-Object System.Drawing.RectangleF (X 0.08), (X 0.05), ($s * 0.84), ($s * 0.7)
  $g.DrawString('?', $font, $ink, $box, $fmt)

  # Coral dot: the app is listening
  $coral = New-Object System.Drawing.SolidBrush (Color '#ff7a8a')
  $g.FillEllipse($coral, (X 0.76), (X 0.72), ($s * 0.15), ($s * 0.15))

  $g.Dispose()
  $bmp.Save((Join-Path $outDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "$name $size"
}

Draw 180 'apple-touch-icon.png' $false 0.1
Draw 32 'favicon-32.png' $true 0.04
