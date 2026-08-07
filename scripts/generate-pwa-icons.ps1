param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\public\icons')
)

Add-Type -AssemblyName System.Drawing

function New-RoseIcon {
  param(
    [int]$Size,
    [string]$OutputPath
  )

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#FB2879'))

  $haloBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(38, 255, 255, 255))
  $haloMargin = [int]($Size * 0.20)
  $haloSize = $Size - ($haloMargin * 2)
  $graphics.FillEllipse($haloBrush, $haloMargin, $haloMargin, $haloSize, $haloSize)

  $letterBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $font = New-Object System.Drawing.Font('Georgia', ($Size * 0.48), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $bounds = New-Object System.Drawing.RectangleF(0, (-$Size * 0.015), $Size, $Size)
  $graphics.DrawString('R', $font, $letterBrush, $bounds, $format)

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $format.Dispose()
  $font.Dispose()
  $letterBrush.Dispose()
  $haloBrush.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
New-RoseIcon -Size 192 -OutputPath (Join-Path $OutputDirectory 'rose-192.png')
New-RoseIcon -Size 512 -OutputPath (Join-Path $OutputDirectory 'rose-512.png')
New-RoseIcon -Size 512 -OutputPath (Join-Path $OutputDirectory 'rose-maskable.png')
