Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"

$sourceDirectory = Join-Path $PSScriptRoot "..\..\Yuan Prometheus Screenshots\font pairing and placement"
$files = Get-ChildItem -LiteralPath $sourceDirectory -File -Filter "*.png" | Sort-Object Name
$columns = 4
$rows = 3
$cellWidth = 420
$cellHeight = 720
$labelHeight = 46
$sheetSize = $columns * $rows
$font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$labelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$backgroundBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18, 18, 20))

for ($sheetIndex = 0; $sheetIndex -lt [Math]::Ceiling($files.Count / $sheetSize); $sheetIndex += 1) {
  $bitmap = [System.Drawing.Bitmap]::new(
    [int]($columns * $cellWidth),
    [int]($rows * $cellHeight)
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.FillRectangle($backgroundBrush, 0, 0, $bitmap.Width, $bitmap.Height)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

  for ($cellIndex = 0; $cellIndex -lt $sheetSize; $cellIndex += 1) {
    $fileIndex = $sheetIndex * $sheetSize + $cellIndex
    if ($fileIndex -ge $files.Count) { break }

    $file = $files[$fileIndex]
    $column = $cellIndex % $columns
    $row = [Math]::Floor($cellIndex / $columns)
    $cellX = $column * $cellWidth
    $cellY = $row * $cellHeight
    $image = [System.Drawing.Image]::FromFile($file.FullName)
    $availableWidth = $cellWidth - 20
    $availableHeight = $cellHeight - $labelHeight - 20
    $scale = [Math]::Min($availableWidth / $image.Width, $availableHeight / $image.Height)
    $drawWidth = [Math]::Max(1, [Math]::Round($image.Width * $scale))
    $drawHeight = [Math]::Max(1, [Math]::Round($image.Height * $scale))
    $drawX = $cellX + [Math]::Floor(($cellWidth - $drawWidth) / 2)
    $drawY = $cellY + $labelHeight + [Math]::Floor(($availableHeight - $drawHeight) / 2)
    $graphics.DrawImage($image, $drawX, $drawY, $drawWidth, $drawHeight)
    $graphics.DrawString(("{0:D2}  {1}" -f ($fileIndex + 1), $file.Name), $font, $labelBrush, $cellX + 10, $cellY + 10)
    $image.Dispose()
  }

  $outputPath = Join-Path $PSScriptRoot ("font-pairing-contact-sheet-{0}.png" -f ($sheetIndex + 1))
  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

$font.Dispose()
$labelBrush.Dispose()
$backgroundBrush.Dispose()
