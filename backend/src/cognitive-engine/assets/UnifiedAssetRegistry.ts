import {createFailureReport, type CognitiveFailureReport} from "../contracts/manifests";

export type UnifiedAssetKind = "local" | "cloud" | "vector" | "motion" | "typography" | "overlay";

export type UnifiedAssetRecord = {
  id: string;
  kind: UnifiedAssetKind;
  url: string;
  tags: string[];
  region?: string | null;
};

export type UnifiedAssetResolution = {
  asset: UnifiedAssetRecord | null;
  failures: CognitiveFailureReport[];
};

export class UnifiedAssetRegistry {
  private readonly records = new Map<string, UnifiedAssetRecord>();

  register(record: UnifiedAssetRecord): void {
    this.records.set(record.id, record);
  }

  resolve(id: string): UnifiedAssetResolution {
    const asset = this.records.get(id) ?? null;
    if (!asset) {
      return {
        asset: null,
        failures: [createFailureReport({
          stage: "AssetRetrievalStage",
          message: `Asset '${id}' was not registered.`,
          missingFields: ["asset.url"],
          degradedSubsystems: ["asset-registry"],
          confidenceCollapse: 1
        })]
      };
    }

    if (!asset.url.trim()) {
      return {
        asset: null,
        failures: [createFailureReport({
          stage: "AssetRetrievalStage",
          message: `Asset '${id}' has an empty URL.`,
          missingFields: ["asset.url"],
          degradedSubsystems: ["asset-url"],
          confidenceCollapse: 1
        })]
      };
    }

    return {asset, failures: []};
  }
}
