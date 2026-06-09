# Test Render: per-word-stagger-v1

## Scene Configuration
- Canvas: 800x600, dark background
- Camera: [0,0,10], FOV 50
- Text: "NOT YOUR AVERAGE MOTION DESIGN"
- Parameters: delay 0.15s, rotation 20°, driftY 1.0, duration 1.5s, ease back.out

## Expected Visual Result
Words should appear one after another, each rotating from 20° to 0° while rising from 1 unit below. The stagger should be clearly visible and rhythmic. No words should appear simultaneously.

## Status
Visual verification pending automated SSIM comparison.
