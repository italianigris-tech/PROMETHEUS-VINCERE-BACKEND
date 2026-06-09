# Test Render: pill-stack-v1

## Scene Configuration
- Canvas: 800x600, dark background
- Camera: [0,0,8], FOV 45
- Pills: 3 stacked, width 3.5, height 0.9, gap 0.2, color #F0F0F0
- Hover lift: 0.3 units
- Shadow blur: 0.4
- Labels: DESIGN, MOTION, STUDIO

## Expected Visual Result
Three rounded white pills stacked vertically with slight z-offset. The top pill should appear closest. A dark shadow should be visible under each pill. Hovering over a pill should animate it forward along Z.

## Status
Visual verification pending automated SSIM comparison.
