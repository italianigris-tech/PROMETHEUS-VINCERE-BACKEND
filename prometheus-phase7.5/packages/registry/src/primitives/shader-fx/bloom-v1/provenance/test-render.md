# Test Render: bloom-v1

## Scene Configuration
- Canvas: 800x600, very dark background (#050505)
- Camera: [0,0,8], FOV 45
- Text: "BLOOM", white, fontSize 3
- Lighting: ambient 0.2 + pointLight intensity 2
- Bloom: strength 0.6, radius 0.5, threshold 0.7
- antialias: false (required for post-processing compatibility)

## Expected Visual Result
Text should have a soft white halo extending ~20-30 pixels around the letters. The background should remain dark. The glow should feel cinematic, not like an overexposed photograph.

## Status
Visual verification pending automated SSIM comparison.
