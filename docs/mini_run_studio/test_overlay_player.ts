import * as fs from "node:fs";
import * as path from "node:path";

const studioDir = __dirname;
const overlayHtmlPath = path.join(studioDir, "overlay_player.html");

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${message}`);
    failed++;
  }
}

// 1. File exists
assert(fs.existsSync(overlayHtmlPath), "overlay_player.html exists");

const html = fs.readFileSync(overlayHtmlPath, "utf8");

// 2. Contains required video elements
assert(html.includes('id="baseVideo"'), "Contains baseVideo element");
assert(html.includes('id="mattedVideo"'), "Contains mattedVideo element");
assert(html.includes('id="imageLayer"'), "Contains imageLayer element");

// 3. Contains sync logic
assert(html.includes('timeupdate'), "Contains timeupdate sync listener");
assert(html.includes('seeked'), "Contains seeked sync listener");
assert(html.includes('switchMattedVideo'), "Contains matted video switch function");
assert(html.includes('switchBaseVideo'), "Contains base video switch function");

// 4. Contains overlay-specific route in server
const serverPath = path.join(studioDir, "serve_preview.ts");
const serverCode = fs.readFileSync(serverPath, "utf8");
assert(serverCode.includes('/overlay'), "Server has /overlay route");
assert(serverCode.includes('overlay_player.html'), "Server serves overlay_player.html");

// 5. Matted video uploaded
const uploadDir = path.join(studioDir, "uploaded_videos");
if (fs.existsSync(uploadDir)) {
  const videos = fs.readdirSync(uploadDir).filter(f => /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(f));
  assert(videos.length > 0, "At least one matted video uploaded");
  assert(videos.some(v => v.toLowerCase().includes('matted')), "Video filename indicates matted content");
} else {
  assert(false, "uploaded_videos directory exists");
}

// 6. Base video exists
const baseVideoPath = path.join(studioDir, "uploaded_input_video.mp4");
assert(fs.existsSync(baseVideoPath), "Base video (uploaded_input_video.mp4) exists");

// 7. Verify HTML has proper layering CSS
assert(html.includes('z-index: 0') || html.includes('z-index:0'), "Base layer has z-index 0");
assert(html.includes('z-index: 1') || html.includes('z-index:1'), "Asset layer has z-index 1");
assert(html.includes('z-index: 2') || html.includes('z-index:2'), "Matt layer has z-index 2");

// 8. Verify non-destructive approach (no canvas compositing, no ffmpeg burn-in in overlay page)
assert(!html.includes('canvas.getContext'), "Overlay page does not use canvas compositing");
assert(!html.includes('ffmpeg') && !html.includes('ffmpeg'), "Overlay page does not invoke ffmpeg");

// The active typography mini-run must retain the original base under a muted,
// alpha-capable foreground speaker; neither source is composited in the page.
const typographyPath = path.join(studioDir, "typography_treatment_presentation.html");
const typographyHtml = fs.readFileSync(typographyPath, "utf8");
const alphaForegroundPath = path.join(uploadDir, "the_matted_AKIMBOSA_MALE_HEAD_VIDEO.alpha.webm");
assert(fs.existsSync(alphaForegroundPath), "Browser-ready alpha foreground asset exists");
assert(typographyHtml.includes('the_matted_AKIMBOSA_MALE_HEAD_VIDEO.alpha.webm'), "Typography run defaults to the alpha foreground asset");
assert(typographyHtml.includes('BASE_VIDEO_VISIBLE_WITH_MATTED_OVERLAY'), "Typography run keeps original video visible under the foreground speaker");
assert(typographyHtml.includes('mattedVideo.muted = true'), "Foreground speaker remains muted");
assert(typographyHtml.includes('MATTED_FOREGROUND_FOLLOWS_BASE_CLOCK'), "Typography run declares the base video as the matte foreground clock");
assert(typographyHtml.includes('function syncMattedVideoToBase'), "Typography run has a continuous matte synchronization function");
assert(typographyHtml.includes('stageVideoBg.addEventListener("seeking"'), "Typography run resynchronizes the matte when the base seeks");
assert(typographyHtml.includes('stageVideoBg.addEventListener("play"'), "Typography run resynchronizes the matte when base playback resumes");
assert(typographyHtml.includes('requestAnimationFrame(maintainMattedVideoSync)'), "Typography run continuously corrects matte drift while playing");

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
}
