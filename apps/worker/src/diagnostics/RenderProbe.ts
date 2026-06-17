export type RenderCapability =
  | "background-video"
  | "kinetic-text"
  | "selective-text-bloom"
  | "device-mockup-primitive";

export type RenderGraphNode = {
  id: string;
  type: string;
  payload?: Record<string, unknown>;
  children?: RenderGraphNode[];
};

export type RenderCost = {
  drawCalls: number;
  geometries: number;
  materials: number;
  textureTargets: number;
  estimatedFillPixels: number;
};

export type RenderProbeResult = {
  canRender: boolean;
  missingCapabilities: string[];
  suggestedDowngrade: RenderGraphNode | null;
  estimatedCost: RenderCost;
};

export type RenderProbeInput = {
  capabilities?: Iterable<string>;
};

const DEFAULT_CAPABILITIES: RenderCapability[] = [
  "background-video",
  "kinetic-text",
  "selective-text-bloom",
  "device-mockup-primitive"
];

const ZERO_COST: RenderCost = {
  drawCalls: 0,
  geometries: 0,
  materials: 0,
  textureTargets: 0,
  estimatedFillPixels: 0
};

const addCost = (left: RenderCost, right: RenderCost): RenderCost => ({
  drawCalls: left.drawCalls + right.drawCalls,
  geometries: left.geometries + right.geometries,
  materials: left.materials + right.materials,
  textureTargets: left.textureTargets + right.textureTargets,
  estimatedFillPixels: left.estimatedFillPixels + right.estimatedFillPixels
});

const estimateNodeCost = (node: RenderGraphNode): RenderCost => {
  switch (node.type) {
    case "device-mockup":
      return {
        drawCalls: 5,
        geometries: 5,
        materials: 5,
        textureTargets: 0,
        estimatedFillPixels: 304_920
      };
    case "text":
    case "kinetic-text":
      return {
        drawCalls: 1,
        geometries: 1,
        materials: 1,
        textureTargets: 0,
        estimatedFillPixels: 220_000
      };
    case "background-video":
      return {
        drawCalls: 1,
        geometries: 1,
        materials: 1,
        textureTargets: 0,
        estimatedFillPixels: 2_073_600
      };
    default:
      return {
        drawCalls: 1,
        geometries: 1,
        materials: 1,
        textureTargets: 0,
        estimatedFillPixels: 0
      };
  }
};

const requiredCapabilitiesFor = (node: RenderGraphNode): string[] => {
  switch (node.type) {
    case "device-mockup":
      return ["device-mockup-primitive"];
    case "text":
    case "kinetic-text":
      return ["kinetic-text"];
    case "background-video":
      return ["background-video"];
    default:
      return [`unsupported-node:${node.type}`];
  }
};

const unique = (values: string[]): string[] => [...new Set(values)];

const buildDowngrade = (node: RenderGraphNode, missingCapabilities: string[]): RenderGraphNode => ({
  id: `${node.id}-downgrade`,
  type: "background-video",
  payload: {
    downgradeReason: `missing:${missingCapabilities.join(",")}`,
    originalType: node.type,
    originalId: node.id
  }
});

export class RenderProbe {
  private readonly capabilities: Set<string>;

  constructor(input: RenderProbeInput = {}) {
    this.capabilities = new Set(input.capabilities ?? DEFAULT_CAPABILITIES);
  }

  probe(node: RenderGraphNode): RenderProbeResult {
    const required = [
      ...requiredCapabilitiesFor(node),
      ...(node.children ?? []).flatMap((child) => requiredCapabilitiesFor(child))
    ];
    const missingCapabilities = unique(required.filter((capability) => !this.capabilities.has(capability)));
    const childCost = (node.children ?? []).reduce(
      (cost, child) => addCost(cost, estimateNodeCost(child)),
      ZERO_COST
    );
    const estimatedCost = addCost(estimateNodeCost(node), childCost);

    return {
      canRender: missingCapabilities.length === 0,
      missingCapabilities,
      suggestedDowngrade: missingCapabilities.length > 0
        ? buildDowngrade(node, missingCapabilities)
        : null,
      estimatedCost
    };
  }
}
