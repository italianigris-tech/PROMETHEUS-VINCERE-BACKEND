import * as fs from "node:fs";
import * as path from "node:path";
import { execSync, spawnSync } from "node:child_process";

export interface PythonProbeResult {
  status: "ready" | "degraded" | "missing";
  executablePath: string | null;
  pythonVersion: string | null;
  hasMediaPipe: boolean;
  mediapipeVersion: string | null;
  hasOpenCv: boolean;
  opencvVersion: string | null;
  hasNumPy: boolean;
  numpyVersion: string | null;
  errors: string[];
  remediation: string | null;
}

export interface FfmpegProbeResult {
  status: "ready" | "degraded" | "missing";
  ffmpegPath: string | null;
  ffprobePath: string | null;
  ffmpegVersion: string | null;
  source: "configured" | "remotion_bundle" | "vendor_bin" | "global_path" | null;
  errors: string[];
  remediation: string | null;
}

export interface AssetProbeResult {
  status: "ready" | "missing";
  speakerPath: string | null;
  speakerBaseName: string | null;
  availableAssets: string[];
  missingAssets: string[];
}

export interface PreflightReport {
  timestamp: string;
  ready: boolean;
  python: PythonProbeResult;
  ffmpeg: FfmpegProbeResult;
  assets: AssetProbeResult;
}

const studioDir = __dirname;
const repoRoot = path.resolve(studioDir, "../..");

/**
 * Checks if a file exists and is executable.
 */
function isExecutable(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  try {
    if (process.platform === "win32") {
      return true;
    }
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Collect candidate Python executables across environment variables, virtual environments, and system paths.
 */
function discoverPythonCandidates(): string[] {
  const candidates: string[] = [];
  const exeName = process.platform === "win32" ? "python.exe" : "python";
  const exeName3 = process.platform === "win32" ? "python.exe" : "python3";

  // 1. Explicit environment variable
  if (process.env.MAUL_MEDIAPIPE_PYTHON_BIN?.trim()) {
    candidates.push(process.env.MAUL_MEDIAPIPE_PYTHON_BIN.trim());
  }

  // 2. Active virtual environment
  if (process.env.VIRTUAL_ENV) {
    candidates.push(path.join(process.env.VIRTUAL_ENV, process.platform === "win32" ? "Scripts/python.exe" : "bin/python"));
  }

  // 3. Local repository virtual environments (.venv, venv)
  const venvSearchRoots = [
    studioDir,
    repoRoot,
    path.resolve(repoRoot, ".."),
    process.env.HOME || "",
    process.env.USERPROFILE || "",
  ].filter(Boolean);

  for (const root of venvSearchRoots) {
    const venvDir1 = path.join(root, ".venv");
    const venvDir2 = path.join(root, "venv");
    const py1 = path.join(venvDir1, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
    const py2 = path.join(venvDir2, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
    if (fs.existsSync(py1)) candidates.push(py1);
    if (fs.existsSync(py2)) candidates.push(py2);
  }

  // 4. Windows standard AppData Prometheus installation
  if (process.env.LOCALAPPDATA) {
    const winVisionPy = path.join(
      process.env.LOCALAPPDATA,
      "Prometheus",
      "maul-vision-py311",
      "Scripts",
      "python.exe"
    );
    if (fs.existsSync(winVisionPy)) candidates.push(winVisionPy);
  }

  // 5. System PATH executables
  candidates.push(exeName3);
  candidates.push(exeName);

  // Return unique paths
  return Array.from(new Set(candidates.filter(Boolean)));
}

/**
 * Probe a Python binary for version, mediapipe, cv2, and numpy support.
 */
function probePythonBinary(pyBin: string): {
  valid: boolean;
  pythonVersion?: string;
  mediapipeVersion?: string;
  opencvVersion?: string;
  numpyVersion?: string;
  error?: string;
} {
  const probeScript = `
import sys, json
info = {"pythonVersion": sys.version.split()[0]}
try:
    import mediapipe as mp
    info["mediapipeVersion"] = getattr(mp, "__version__", "available")
except Exception as e:
    info["mediapipeError"] = str(e)
try:
    import cv2
    info["opencvVersion"] = getattr(cv2, "__version__", "available")
except Exception as e:
    info["opencvError"] = str(e)
try:
    import numpy as np
    info["numpyVersion"] = getattr(np, "__version__", "available")
except Exception as e:
    info["numpyError"] = str(e)
sys.stdout.write(json.dumps(info))
`;
  try {
    const res = spawnSync(pyBin, ["-c", probeScript], {
      encoding: "utf8",
      timeout: 10000,
      windowsHide: true,
    });
    if (res.error || res.status !== 0) {
      return {
        valid: false,
        error: (res.stderr || res.error?.message || "Subprocess exited with non-zero code").trim(),
      };
    }
    const data = JSON.parse(res.stdout.trim());
    return {
      valid: true,
      pythonVersion: data.pythonVersion,
      mediapipeVersion: data.mediapipeVersion,
      opencvVersion: data.opencvVersion,
      numpyVersion: data.numpyVersion,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: err.message || String(err),
    };
  }
}

/**
 * Perform comprehensive preflight check on Python & MediaPipe Vision environment.
 */
export function checkPythonEnvironment(): PythonProbeResult {
  const candidates = discoverPythonCandidates();
  const errors: string[] = [];

  let bestCandidate: {
    bin: string;
    probe: ReturnType<typeof probePythonBinary>;
  } | null = null;

  for (const candidate of candidates) {
    const probe = probePythonBinary(candidate);
    if (probe.valid) {
      if (probe.mediapipeVersion && probe.opencvVersion) {
        // Fully equipped vision python
        return {
          status: "ready",
          executablePath: candidate,
          pythonVersion: probe.pythonVersion || null,
          hasMediaPipe: true,
          mediapipeVersion: probe.mediapipeVersion || null,
          hasOpenCv: true,
          opencvVersion: probe.opencvVersion || null,
          hasNumPy: Boolean(probe.numpyVersion),
          numpyVersion: probe.numpyVersion || null,
          errors: [],
          remediation: null,
        };
      }
      if (!bestCandidate) {
        bestCandidate = { bin: candidate, probe };
      }
    } else {
      errors.push(`${candidate}: ${probe.error || "Not executable"}`);
    }
  }

  if (bestCandidate) {
    const missing: string[] = [];
    if (!bestCandidate.probe.mediapipeVersion) missing.push("mediapipe");
    if (!bestCandidate.probe.opencvVersion) missing.push("opencv-python");
    if (!bestCandidate.probe.numpyVersion) missing.push("numpy");

    const remediationCmd = `${bestCandidate.bin} -m pip install ${missing.join(" ")}`;
    return {
      status: "degraded",
      executablePath: bestCandidate.bin,
      pythonVersion: bestCandidate.probe.pythonVersion || null,
      hasMediaPipe: Boolean(bestCandidate.probe.mediapipeVersion),
      mediapipeVersion: bestCandidate.probe.mediapipeVersion || null,
      hasOpenCv: Boolean(bestCandidate.probe.opencvVersion),
      opencvVersion: bestCandidate.probe.opencvVersion || null,
      hasNumPy: Boolean(bestCandidate.probe.numpyVersion),
      numpyVersion: bestCandidate.probe.numpyVersion || null,
      errors: [`Python runtime found at ${bestCandidate.bin}, but missing: ${missing.join(", ")}`],
      remediation: `Install missing vision libraries with: ${remediationCmd} (or set MAUL_MEDIAPIPE_PYTHON_BIN to an equipped python environment)`,
    };
  }

  return {
    status: "missing",
    executablePath: null,
    pythonVersion: null,
    hasMediaPipe: false,
    mediapipeVersion: null,
    hasOpenCv: false,
    opencvVersion: null,
    hasNumPy: false,
    numpyVersion: null,
    errors: ["No functional Python interpreter was discovered in the environment.", ...errors],
    remediation: "Please install Python 3.10+ and run: pip install mediapipe opencv-python numpy",
  };
}

/**
 * Probe and resolve FFmpeg and FFprobe binaries.
 */
export function checkFfmpegEnvironment(): FfmpegProbeResult {
  const binaryName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const probeName = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
  const errors: string[] = [];

  // 1. Check explicit environment variables
  if (process.env.FFMPEG_PATH && isExecutable(process.env.FFMPEG_PATH)) {
    const ffmpegPath = path.resolve(process.env.FFMPEG_PATH);
    const ffprobePath = process.env.FFPROBE_PATH && isExecutable(process.env.FFPROBE_PATH)
      ? path.resolve(process.env.FFPROBE_PATH)
      : null;
    return {
      status: "ready",
      ffmpegPath,
      ffprobePath,
      ffmpegVersion: getBinaryVersion(ffmpegPath),
      source: "configured",
      errors: [],
      remediation: null,
    };
  }

  // 2. Check Remotion compositor bundle
  const remotionPackages = [
    `compositor-linux-x64-gnu`,
    `compositor-linux-x64-musl`,
    `compositor-linux-arm64-gnu`,
    `compositor-darwin-x64`,
    `compositor-darwin-arm64`,
    `compositor-win32-x64-msvc`,
  ];

  for (const pkg of remotionPackages) {
    const candidate = path.join(
      repoRoot,
      "remotion-app",
      "node_modules",
      "@remotion",
      pkg,
      binaryName
    );
    if (isExecutable(candidate)) {
      const probeCandidate = path.join(
        repoRoot,
        "remotion-app",
        "node_modules",
        "@remotion",
        pkg,
        probeName
      );
      return {
        status: "ready",
        ffmpegPath: candidate,
        ffprobePath: isExecutable(probeCandidate) ? probeCandidate : null,
        ffmpegVersion: getBinaryVersion(candidate),
        source: "remotion_bundle",
        errors: [],
        remediation: null,
      };
    }
  }

  // 3. Check vendor bin directories
  const vendorPaths = [
    path.join(repoRoot, "bin", binaryName),
    path.join(repoRoot, "vendor", binaryName),
    path.join(repoRoot, "node_modules", ".bin", binaryName),
  ];
  for (const candidate of vendorPaths) {
    if (isExecutable(candidate)) {
      return {
        status: "ready",
        ffmpegPath: candidate,
        ffprobePath: null,
        ffmpegVersion: getBinaryVersion(candidate),
        source: "vendor_bin",
        errors: [],
        remediation: null,
      };
    }
  }

  // 4. Check system PATH
  const delimiter = process.platform === "win32" ? ";" : ":";
  const pathEntries = (process.env.PATH || "").split(delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    const candidate = path.join(entry, binaryName);
    if (isExecutable(candidate)) {
      const probeCandidate = path.join(entry, probeName);
      return {
        status: "ready",
        ffmpegPath: candidate,
        ffprobePath: isExecutable(probeCandidate) ? probeCandidate : null,
        ffmpegVersion: getBinaryVersion(candidate),
        source: "global_path",
        errors: [],
        remediation: null,
      };
    }
  }

  return {
    status: "missing",
    ffmpegPath: null,
    ffprobePath: null,
    ffmpegVersion: null,
    source: null,
    errors: ["FFmpeg binary not found in configured FFMPEG_PATH, Remotion bundle, vendor bins, or system PATH."],
    remediation: "Install FFmpeg on your system (e.g., `sudo apt-get install ffmpeg` or `brew install ffmpeg`), run `npm install` in remotion-app, or set FFMPEG_PATH.",
  };
}

function getBinaryVersion(binPath: string): string | null {
  try {
    const out = execSync(`"${binPath}" -version`, { encoding: "utf8", timeout: 3000 });
    const firstLine = out.split("\n")[0] || "";
    const match = firstLine.match(/ffmpeg version ([^\s]+)/i);
    return match ? match[1] : firstLine.trim().slice(0, 30);
  } catch {
    return "available";
  }
}

/**
 * Verify studio cutouts and vector assets.
 */
export function checkStudioAssets(): AssetProbeResult {
  const speakerCandidates = [
    path.join(studioDir, "matted_speaker_male.png"),
    path.join(studioDir, "The matted MALE TALKING HEAD.png"),
    path.join(repoRoot, "The matted MALE TALKING HEAD.png"),
    path.join(repoRoot, "docs/mini_run_studio/matted_speaker_male.png"),
    "/home/ec2-user/The matted MALE TALKING HEAD.png",
    "C:/Users/HomePC/Downloads/HELP, VIDEO MATTING/The matted MALE TALKING HEAD.png",
  ];

  let resolvedSpeaker: string | null = null;
  for (const candidate of speakerCandidates) {
    if (fs.existsSync(candidate)) {
      resolvedSpeaker = candidate;
      break;
    }
  }

  const expectedAssets = [
    "transcript2_metronome_unique.svg",
    "transcript2_robotic_arm_unique.svg",
    "transcript2_rocket_scale_unique.svg",
    "typography_treatment_presentation.html",
  ];

  const available: string[] = [];
  const missing: string[] = [];

  for (const assetName of expectedAssets) {
    const fullPath = path.join(studioDir, assetName);
    if (fs.existsSync(fullPath)) {
      available.push(assetName);
    } else {
      missing.push(assetName);
    }
  }

  return {
    status: resolvedSpeaker ? "ready" : "missing",
    speakerPath: resolvedSpeaker,
    speakerBaseName: resolvedSpeaker ? path.basename(resolvedSpeaker) : null,
    availableAssets: available,
    missingAssets: missing,
  };
}

/**
 * Execute complete pre-flight environment check.
 */
export function runPreflightCheck(): PreflightReport {
  const python = checkPythonEnvironment();
  const ffmpeg = checkFfmpegEnvironment();
  const assets = checkStudioAssets();

  const ready =
    python.status !== "missing" &&
    ffmpeg.status !== "missing" &&
    assets.status === "ready";

  return {
    timestamp: new Date().toISOString(),
    ready,
    python,
    ffmpeg,
    assets,
  };
}

/**
 * Assert environment is ready or throw structured diagnostic error.
 */
export function assertPreflightReady(strictVision = false): PreflightReport {
  const report = runPreflightCheck();
  if (strictVision && report.python.status !== "ready") {
    throw new Error(
      `[PREFLIGHT_VISION_ERROR] Python MediaPipe Vision environment not fully equipped:\n${report.python.errors.join("\n")}\nRemediation: ${report.python.remediation}`
    );
  }
  if (report.ffmpeg.status === "missing") {
    throw new Error(
      `[PREFLIGHT_FFMPEG_ERROR] FFmpeg binary resolution failed:\n${report.ffmpeg.errors.join("\n")}\nRemediation: ${report.ffmpeg.remediation}`
    );
  }
  if (report.assets.status === "missing") {
    throw new Error(
      `[PREFLIGHT_ASSET_ERROR] Matted speaker talking head PNG asset could not be found.`
    );
  }
  return report;
}

// CLI Execution Handler
if (require.main === module || process.argv[1]?.endsWith("preflight_environment_check.ts")) {
  console.log("================================================================================");
  console.log("         PROMETHEUS CORE — MINI-RUN STUDIO PRE-FLIGHT ENVIRONMENT CHECK         ");
  console.log("================================================================================");

  const report = runPreflightCheck();

  // 1. Python & MediaPipe Vision
  console.log("\n[1] Python & MediaPipe Vision Subsystem:");
  if (report.python.status === "ready") {
    console.log(`    Status:           \x1b[32m✔ READY\x1b[0m`);
    console.log(`    Executable:       ${report.python.executablePath}`);
    console.log(`    Python Version:   ${report.python.pythonVersion}`);
    console.log(`    MediaPipe:        v${report.python.mediapipeVersion}`);
    console.log(`    OpenCV (cv2):     v${report.python.opencvVersion}`);
    console.log(`    NumPy:            v${report.python.numpyVersion}`);
  } else if (report.python.status === "degraded") {
    console.log(`    Status:           \x1b[33m⚠ DEGRADED (Vision Packages Missing)\x1b[0m`);
    console.log(`    Executable:       ${report.python.executablePath}`);
    console.log(`    Python Version:   ${report.python.pythonVersion}`);
    console.log(`    MediaPipe:        ${report.python.hasMediaPipe ? "v" + report.python.mediapipeVersion : "\x1b[31mNOT INSTALLED\x1b[0m"}`);
    console.log(`    OpenCV (cv2):     ${report.python.hasOpenCv ? "v" + report.python.opencvVersion : "\x1b[31mNOT INSTALLED\x1b[0m"}`);
    console.log(`    Remediation:      ${report.python.remediation}`);
  } else {
    console.log(`    Status:           \x1b[31m✖ MISSING\x1b[0m`);
    console.log(`    Remediation:      ${report.python.remediation}`);
  }

  // 2. FFmpeg Binary Resolution
  console.log("\n[2] FFmpeg Media Engine Subsystem:");
  if (report.ffmpeg.status === "ready") {
    console.log(`    Status:           \x1b[32m✔ READY\x1b[0m`);
    console.log(`    Executable:       ${report.ffmpeg.ffmpegPath}`);
    console.log(`    Source:           ${report.ffmpeg.source}`);
    console.log(`    FFmpeg Version:   ${report.ffmpeg.ffmpegVersion}`);
    console.log(`    FFprobe:          ${report.ffmpeg.ffprobePath || "not found (optional)"}`);
  } else {
    console.log(`    Status:           \x1b[31m✖ MISSING\x1b[0m`);
    console.log(`    Remediation:      ${report.ffmpeg.remediation}`);
  }

  // 3. Studio Assets
  console.log("\n[3] Matted Speaker Cutouts & Vector Assets:");
  if (report.assets.status === "ready") {
    console.log(`    Status:           \x1b[32m✔ READY\x1b[0m`);
    console.log(`    Speaker Cutout:   ${report.assets.speakerPath} (${report.assets.speakerBaseName})`);
    console.log(`    Available Assets: ${report.assets.availableAssets.join(", ")}`);
  } else {
    console.log(`    Status:           \x1b[31m✖ MISSING\x1b[0m`);
    console.log(`    Speaker Cutout:   Not found in studio or repo roots`);
  }

  console.log("\n================================================================================");
  if (report.ready) {
    console.log("OVERALL ENVIRONMENT STATUS: \x1b[32mREADY FOR MINI-RUN STUDIO OPERATIONS\x1b[0m");
  } else {
    console.log("OVERALL ENVIRONMENT STATUS: \x1b[33mPARTIAL / FALLBACK READY WITH DIAGNOSTICS\x1b[0m");
  }
  console.log("================================================================================\n");
}
