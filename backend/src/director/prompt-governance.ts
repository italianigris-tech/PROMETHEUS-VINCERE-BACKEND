import {createHash, randomUUID} from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface PromptDoctrine {
  density?: "high" | "medium" | "low";
  tone?: "aggressive" | "cinematic" | "minimal";
  exclusions?: string[];
  stylePreferences?: string[];
}

export interface GovernedPrompt {
  id: string;
  version: number;
  text: string;
  fingerprint: string;
  doctrine: PromptDoctrine;
  infrastructureFlags: {
    mayOverrideDeterminism: false;
    mayOverrideVariationKey: false;
    mayOverrideRenderPipeline: false;
  };
  createdAt: string;
}

export interface PromptValidationResult {
  allowed: boolean;
  allowReasons: string[];
  blockReasons: string[];
}

const DEFAULT_REGISTRY_PATH = path.join(os.homedir(), ".prometheus", "prompt-registry.jsonl");

const INFRASTRUCTURE_RULES: Array<{pattern: RegExp; reason: string}> = [
  {pattern: /\b(Math\.random|Date\.now|performance\.now|requestAnimationFrame|setInterval|setTimeout|GSAP|crypto\.getRandomValues|new Date)\b/i, reason: "Prompt attempts to introduce a forbidden render-path API."},
  {pattern: /\b(non[- ]?deterministic|randomize everything|disable determinism|ignore determinism|break determinism)\b/i, reason: "Prompt attempts to override deterministic execution."},
  {pattern: /\b(ignore|bypass|override|remove)\s+(the\s+)?(variation\s+key|upload_instance_id|retry_index)\b/i, reason: "Prompt attempts to override Variation Key authority."},
  {pattern: /\b(BullMQ|Redis|queue worker|monitor process|distributed worker|parallel chunking)\b/i, reason: "Prompt attempts to change the locked MVP infrastructure."},
  {pattern: /\b(switch|replace|move)\s+(from\s+)?(R3F|Remotion|React Three Fiber)\b/i, reason: "Prompt attempts to override the locked R3F + Remotion render stack."},
  {pattern: /\b(change|remove|ignore|bypass)\s+(the\s+)?(90\s?second|duration cap|schema authority|Judgment Layer|quality floor)\b/i, reason: "Prompt attempts to override v8.1 architecture authority."},
];

export const fingerprintString = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const validatePromptInfrastructure = (promptText: string): PromptValidationResult => {
  const blockReasons = INFRASTRUCTURE_RULES
    .filter((rule) => rule.pattern.test(promptText))
    .map((rule) => rule.reason);

  return {
    allowed: blockReasons.length === 0,
    allowReasons: blockReasons.length === 0
      ? ["Prompt may influence doctrine only; infrastructure flags remain locked false."]
      : [],
    blockReasons,
  };
};

const infrastructureFlags = (): GovernedPrompt["infrastructureFlags"] => ({
  mayOverrideDeterminism: false,
  mayOverrideVariationKey: false,
  mayOverrideRenderPipeline: false,
});

const stableDoctrine = (doctrine: PromptDoctrine = {}): PromptDoctrine => ({
  ...(doctrine.density ? {density: doctrine.density} : {}),
  ...(doctrine.tone ? {tone: doctrine.tone} : {}),
  ...(doctrine.exclusions ? {exclusions: [...doctrine.exclusions]} : {}),
  ...(doctrine.stylePreferences ? {stylePreferences: [...doctrine.stylePreferences]} : {}),
});

const parsePromptLine = (line: string): GovernedPrompt | undefined => {
  if (!line.trim()) {
    return undefined;
  }

  const parsed = JSON.parse(line) as GovernedPrompt;
  if (!parsed.fingerprint || !parsed.id) {
    return undefined;
  }

  return parsed;
};

export class PromptRegistry {
  private readonly registryPath: string;
  private prompts: GovernedPrompt[];

  constructor(registryPath = DEFAULT_REGISTRY_PATH) {
    this.registryPath = registryPath;
    this.prompts = this.load();
  }

  register(promptText: string, doctrine: PromptDoctrine = {}): GovernedPrompt {
    if (!promptText.trim()) {
      throw new Error("promptText is required");
    }

    const validation = validatePromptInfrastructure(promptText);
    if (!validation.allowed) {
      throw new Error(`Prompt rejected by governance: ${validation.blockReasons.join(" ")}`);
    }

    const fingerprint = fingerprintString(promptText);
    const current = this.getByFingerprint(fingerprint);
    const version = current ? current.version + 1 : 1;
    const prompt: GovernedPrompt = {
      id: randomUUID(),
      version,
      text: promptText,
      fingerprint,
      doctrine: stableDoctrine(doctrine),
      infrastructureFlags: infrastructureFlags(),
      createdAt: new Date().toISOString(),
    };

    this.append(prompt);
    this.prompts.push(prompt);
    return prompt;
  }

  getByFingerprint(fingerprint: string): GovernedPrompt | undefined {
    return [...this.prompts].reverse().find((prompt) => prompt.fingerprint === fingerprint);
  }

  getById(id: string): GovernedPrompt | undefined {
    return this.prompts.find((prompt) => prompt.id === id);
  }

  list(): GovernedPrompt[] {
    return this.prompts.map((prompt) => ({
      ...prompt,
      doctrine: stableDoctrine(prompt.doctrine),
      infrastructureFlags: infrastructureFlags(),
    }));
  }

  private load(): GovernedPrompt[] {
    if (!fs.existsSync(this.registryPath)) {
      return [];
    }

    return fs.readFileSync(this.registryPath, "utf8")
      .split(/\r?\n/)
      .map(parsePromptLine)
      .filter((prompt): prompt is GovernedPrompt => Boolean(prompt));
  }

  private append(prompt: GovernedPrompt): void {
    fs.mkdirSync(path.dirname(this.registryPath), {recursive: true});
    fs.appendFileSync(this.registryPath, `${JSON.stringify(prompt)}\n`, "utf8");
  }
}