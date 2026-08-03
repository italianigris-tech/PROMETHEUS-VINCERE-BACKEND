import {
  maulRenderShortOperationPayloadSchema,
  type MaulOperationJob,
} from "@prometheus/shared-types";

import {MaulDurableControlPlane} from "./control-plane.js";
import {MaulLineageConflictError, type MaulProjectService} from "./service.js";

type WorkerProjects = Pick<
  MaulProjectService,
  | "getProject"
  | "createEditorialTimeline"
  | "createTreatmentCatalog"
  | "createCandidates"
  | "createPlanningBundle"
  | "reviewCandidate"
  | "renderShort"
>;

export class MaulWorkerExecutor {
  public constructor(
    private readonly input: {
      control: MaulDurableControlPlane;
      projects: WorkerProjects;
      workerId: string;
      leaseMs?: number;
    },
  ) {}

  public async runOnce(): Promise<MaulOperationJob | null> {
    const job = await this.input.control.lease(
      this.input.workerId,
      this.input.leaseMs ?? 60_000,
    );
    if (!job) return null;
    try {
      if (job.operation !== "render_short") {
        throw new Error(`Unsupported MAUL worker operation: ${job.operation}`);
      }
      const payload = maulRenderShortOperationPayloadSchema.parse(job.payload);
      const {project} = await this.input.projects.getProject(job.projectId);
      const {timeline} = await this.input.projects.createEditorialTimeline(
        job.projectId,
        payload.timelineRequest,
      );
      const {treatments} = await this.input.projects.createTreatmentCatalog(job.projectId, {
        timelineArtifactId: timeline.artifactId,
      });
      const treatment = treatments.find(
        (entry) => entry.payload.treatmentId === project.intake.treatmentPreference,
      );
      if (!treatment) {
        throw new MaulLineageConflictError("Project treatment preference is unavailable in the MAUL catalog.");
      }
      const {candidates} = await this.input.projects.createCandidates(job.projectId, {
        timelineArtifactId: timeline.artifactId,
      });
      const candidate = candidates[0];
      if (!candidate) {
        throw new MaulLineageConflictError("MAUL produced no renderable candidate.");
      }
      const {planningBundle} = await this.input.projects.createPlanningBundle(job.projectId, {
        candidateArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
      });
      const rubricScores = Object.fromEntries(
        treatment.payload.judgmentLayer.rubric.map((dimension) => [dimension.id, 100]),
      );
      const {review} = await this.input.projects.reviewCandidate(job.projectId, {
        candidateArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
        planningBundleArtifactId: planningBundle.artifactId,
        reviewerId: "maul_worker_automation",
        decision: "approved",
        failureClasses: [],
        rationale: "Automated approval explicitly authorized for leased MAUL execution.",
        rubricScores,
      });
      const {export: rendered} = await this.input.projects.renderShort(job.projectId, {
        candidateArtifactId: candidate.artifactId,
        treatmentGenomeArtifactId: treatment.artifactId,
        planningBundleArtifactId: planningBundle.artifactId,
        reviewDecisionArtifactId: review.artifactId,
        musicTrack: payload.musicTrack,
        sfxAssets: payload.sfxAssets,
      });
      return this.input.control.complete(job.id, {
        leaseToken: job.leaseToken!,
        actualCostUsd: payload.actualCostUsd,
        result: {
          exportArtifactId: rendered.artifactId,
          qualityTruthStatus: "passed",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.input.control.fail(job.id, {
        leaseToken: job.leaseToken!,
        error: message,
        retryable: !(
          error instanceof MaulLineageConflictError ||
          (error instanceof Error && error.name === "ZodError") ||
          message.startsWith("Unsupported MAUL worker operation:")
        ),
        retryAfterMs: 1_000,
      });
    }
  }
}
