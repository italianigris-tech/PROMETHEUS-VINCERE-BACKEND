# Test Render: chrome-text-v1

## Scene Configuration
- Canvas: 800x600
- Camera: [0,0,8], FOV 45
- Lighting: ambient (0.3) + directional (1.0)
- Text: "CHROME", fontSize 3, extrudeDepth 0.5
- Material: metalness 1.0, roughness 0.05, envMapIntensity 2.0, color #E0E0FF
- Controls: Auto-rotating orbit to verify envMap response

## Expected Visual Result
Text should appear as highly reflective silver/chrome with visible 3D depth. As the camera rotates, the gradient envMap should create moving highlights on the text faces. The text should not appear flat or diffuse.

## Status
Visual verification pending automated SSIM comparison.
