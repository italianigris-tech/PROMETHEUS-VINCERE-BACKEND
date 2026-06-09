# Test Render: chromatic-aberration-per-element-v1

## Scene Configuration
- Canvas: 800x600, black background
- Camera: [0,0,8], FOV 45
- Text: "CHROMATIC", white, centered
- CA Params: intensity 0.025, angle 30°
- Background: gridHelper to verify no full-screen leakage

## Expected Visual Result
Text should show visible red/cyan fringes on left/right edges. The grid in the background should be perfectly sharp with no color fringing. If the grid is blurred or colored, the primitive has failed scope isolation.

## Status
Visual verification pending automated SSIM comparison.
