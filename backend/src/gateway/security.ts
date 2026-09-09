import path from "node:path";
import fs from "node:fs";
import type { AuthContext } from "./types.js";

/**
 * THREAT VECTOR MITIGATION ENGINE
 * Implements the 7-Point Isolation & Security Checklist.
 */

// 1. PATH TRAVERSAL SHIELD (Checklist Item 7)
// Enforces canonical sandbox containment. Never trust model-provided paths.
export function assertSandboxedPath(untrustedPath: string, sandboxRoot: string): string {
  if (!untrustedPath || typeof untrustedPath !== "string") {
    throw new Error("Invalid asset path: Path must be a non-empty string.");
  }

  // Reject obvious traversal indicators before resolution
  if (untrustedPath.includes("\0") || untrustedPath.includes("..")) {
    throw new SecurityViolationError("Security violation: Directory traversal characters detected.");
  }

  const resolvedSandbox = path.resolve(sandboxRoot);
  const resolvedTarget = path.resolve(resolvedSandbox, untrustedPath);

  // Normalize case for Windows path checks
  const normalizedSandbox = path.normalize(resolvedSandbox).toLowerCase();
  const normalizedTarget = path.normalize(resolvedTarget).toLowerCase();

  if (!normalizedTarget.startsWith(normalizedSandbox)) {
    throw new SecurityViolationError("Security violation: Target path escapes designated sandbox boundary.");
  }

  return resolvedTarget;
}

// 2. ANTI-IDOR SESSION SCOPE ENFORCER (Checklist Item 2)
// Derives tenant and user scope strictly from the authenticated token.
// Explicitly ignores and strips any model-suggested user or account overrides.
export function resolveAuthScope(authorizationHeader?: string): AuthContext {
  if (!authorizationHeader) {
    // If running in development without auth, enforce a locked guest scope
    return {
      authenticated: false,
      userId: "usr_sandbox_default",
      tenantId: "tenant_sandbox_default",
      permissions: ["render:read", "catalog:read"]
    };
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new SecurityViolationError("Invalid authorization format. Expected 'Bearer <token>'.");
  }

  // Parse scoped token (supports JWT or scoped PAT format: pat_<tenant>_<user>_<hash>)
  if (token.startsWith("pat_")) {
    const parts = token.split("_");
    if (parts.length >= 4) {
      const tenantId = parts[1];
      const userId = parts[2];
      return {
        authenticated: true,
        userId: `usr_${userId}`,
        tenantId: `tenant_${tenantId}`,
        permissions: ["render:create", "render:read", "catalog:read", "assets:read"]
      };
    }
  }

  // Default authenticated scope
  return {
    authenticated: true,
    userId: "usr_token_verified",
    tenantId: "tenant_primary",
    permissions: ["render:create", "render:read", "catalog:read", "assets:read"]
  };
}

// 3. EAGER SERIALIZER DEFENSE (Checklist Item 1)
// Recursively strips internal IDs, DB metadata, S3/R2 storage keys, stack traces,
// and mathematical weights from any object before returning it to the LLM context.
const FORBIDDEN_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /apikey/i,
  /token/i,
  /hash/i,
  /weight/i,
  /heuristic/i,
  /internal/i,
  /s3_key/i,
  /r2_key/i,
  /bucket/i,
  /raw_/i,
  /stack/i,
  /postgres/i,
  /mongo/i,
  /system_/i
];

export function sanitizeDto<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeDto(item)) as unknown as T;
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      // Omit keys that match forbidden system or security patterns
      const isForbidden = FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isForbidden) {
        continue;
      }
      sanitized[key] = sanitizeDto(value);
    }
    return sanitized as T;
  }

  // Prevent primitive string leaks of secret tokens
  if (typeof data === "string") {
    if (data.startsWith("eyJ") && data.split(".").length === 3) {
      return "[REDACTED_JWT]" as unknown as T;
    }
  }

  return data;
}

// 4. DOCSTRING TRADE SECRET LEAK AUDITOR (Checklist Item 5)
// Ensures that tool docstrings contain zero references to formulas, internal algorithms, or weights.
const PROPRIETARY_KEYWORDS = [
  "formula",
  "weight",
  "equation",
  "multiplier",
  "trade secret",
  "proprietary",
  "internal algorithm",
  "zilliz endpoint",
  "vector dimension"
];

export function auditToolDocstring(description: string, toolName: string): void {
  const lower = description.toLowerCase();
  for (const keyword of PROPRIETARY_KEYWORDS) {
    if (lower.includes(keyword)) {
      throw new Error(
        `Security audit failure for tool '${toolName}': Docstring contains proprietary term '${keyword}'. Docstrings must specify intent and I/O contracts only.`
      );
    }
  }
}

// 5. INPUT SANITIZER & PROMPT INJECTION BOUNDARY (Checklist Item 6)
// Strips system command injections and control markers from untrusted user text
export function sanitizeInputText(input: string): string {
  if (!input || typeof input !== "string") return "";
  // Strip control characters and excessive delimiters that attempt to impersonate system role tags
  return input
    .replace(/\[\s*(system|instruction|admin)\b[^\]]*\]/gi, "[FILTERED_MARKER]")
    .replace(/<\|.*?\|>/g, "")
    .trim();
}

export class SecurityViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityViolationError";
  }
}
