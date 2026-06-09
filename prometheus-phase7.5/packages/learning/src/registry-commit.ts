// packages/learning/src/registry-commit.ts
// Commits validated primitives to the registry with human review gate

import type { Primitive, ProvenanceEntry } from "@prometheus/registry";
import { Registry } from "@prometheus/registry";
import type { ValidationForgeReport } from "./validation-forge";

export interface CommitConfig {
  requireHumanReview: boolean;  // If true, primitives are queued for review
  autoCommitThreshold: number;  // Confidence score above which auto-commit is allowed
}

export const defaultCommitConfig: CommitConfig = {
  requireHumanReview: true,
  autoCommitThreshold: 0.85,
};

export class RegistryCommit {
  private registry: Registry;
  private config: CommitConfig;
  private reviewQueue: Array<{ primitive: Primitive; report: ValidationForgeReport }> = [];

  constructor(registry: Registry, config: Partial<CommitConfig> = {}) {
    this.registry = registry;
    this.config = { ...defaultCommitConfig, ...config };
  }

  /**
   * Commit a primitive to the registry.
   * 
   * FLOW:
   * 1. If overallStatus === "rejected": Blocked. Return error.
   * 2. If requireHumanReview === true: Add to review queue. Notify human.
   * 3. If confidence >= autoCommitThreshold AND overallStatus === "ready": Auto-commit.
   * 4. Otherwise: Add to review queue.
   */
  async commit(primitive: Primitive, report: ValidationForgeReport): Promise<{ success: boolean; message: string; reviewRequired?: boolean }> {
    if (report.overallStatus === "rejected") {
      return {
        success: false,
        message: `Primitive ${primitive.id} rejected: ${report.schemaErrors.map((e) => e.message).join("; ")}`,
      };
    }

    if (this.config.requireHumanReview) {
      this.reviewQueue.push({ primitive, report });
      return {
        success: false,
        message: `Primitive ${primitive.id} queued for human review. ${this.reviewQueue.length} items in queue.`,
        reviewRequired: true,
      };
    }

    if (primitive.confidence.overall >= this.config.autoCommitThreshold && report.overallStatus === "ready") {
      const result = this.registry.addPrimitive(primitive);
      if (result.valid) {
        this.registry.addProvenance({
          primitiveId: primitive.id,
          videoId: primitive.provenance.sourceVideo,
          timestampStart: primitive.provenance.timestampStart,
          timestampEnd: primitive.provenance.timestampEnd,
        });
        return { success: true, message: `Primitive ${primitive.id} auto-committed to registry.` };
      }
      return { success: false, message: `Registry validation failed: ${result.errors.map((e) => e.message).join("; ")}` };
    }

    this.reviewQueue.push({ primitive, report });
    return {
      success: false,
      message: `Primitive ${primitive.id} queued for review (confidence ${primitive.confidence.overall} below threshold ${this.config.autoCommitThreshold}).`,
      reviewRequired: true,
    };
  }

  getReviewQueue() {
    return [...this.reviewQueue];
  }

  approveQueued(primitiveId: string): boolean {
    const idx = this.reviewQueue.findIndex((q) => q.primitive.id === primitiveId);
    if (idx === -1) return false;

    const { primitive } = this.reviewQueue[idx];
    const result = this.registry.addPrimitive(primitive);
    if (result.valid) {
      this.registry.addProvenance({
        primitiveId: primitive.id,
        videoId: primitive.provenance.sourceVideo,
        timestampStart: primitive.provenance.timestampStart,
        timestampEnd: primitive.provenance.timestampEnd,
      });
      this.reviewQueue.splice(idx, 1);
      return true;
    }
    return false;
  }

  rejectQueued(primitiveId: string): boolean {
    const idx = this.reviewQueue.findIndex((q) => q.primitive.id === primitiveId);
    if (idx === -1) return false;
    this.reviewQueue.splice(idx, 1);
    return true;
  }
}

export default RegistryCommit;
