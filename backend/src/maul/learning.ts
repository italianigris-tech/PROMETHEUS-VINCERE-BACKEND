import {createHash, randomBytes} from "node:crypto";
import {mkdir, readFile, readdir, rename, unlink, writeFile} from "node:fs/promises";
import path from "node:path";

import {
  maulCreatorTasteMemorySchema,
  maulFeedbackEventSchema,
  maulFeedbackRequestSchema,
  maulOutcomeEventSchema,
  maulOutcomeRequestSchema,
  maulPatternMemorySchema,
  type MaulCreatorTasteMemory,
  type MaulFeedbackEvent,
  type MaulOutcomeEvent,
  type MaulPatternMemory
} from "@prometheus/shared-types";

const keyHash = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 32);
const eventId = (prefix: string): string => `${prefix}_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`;
const isMissing = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "ENOENT";

const atomicJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), {recursive: true});
  const temp = `${filePath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temp, filePath);
};

class LearningLock {
  private current: Promise<void> = Promise.resolve();
  public async run<T>(action: () => Promise<T>): Promise<T> {
    const previous = this.current;
    let release = (): void => undefined;
    this.current = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await action();
    } finally {
      release();
    }
  }
}

const blankStats = () => ({
  wins: 0,
  acceptable: 0,
  losses: 0,
  blocked: 0,
  averageRating: 0,
  explicitPreferenceSignals: 0,
  lastFeedbackAt: null as string | null
});

const blankPatternTreatment = () => ({
  wins: 0,
  acceptable: 0,
  losses: 0,
  blocked: 0,
  failureCounts: {} as Record<string, number>,
  outcomes: {
    count: 0,
    averageViews: 0,
    averageWatchPercentage: 0,
    averageClickThroughRate: 0
  }
});

const buildTasteMemory = ({
  tenantId,
  creatorId,
  feedback,
  updatedAt
}: {
  tenantId: string;
  creatorId: string;
  feedback: MaulFeedbackEvent[];
  updatedAt: string;
}): MaulCreatorTasteMemory => {
  const treatmentStats: Record<string, ReturnType<typeof blankStats>> = {};
  for (const event of feedback) {
    const previous = treatmentStats[event.treatmentId] ?? blankStats();
    const priorCount = previous.wins + previous.acceptable + previous.losses + previous.blocked;
    treatmentStats[event.treatmentId] = {
      ...previous,
      wins: previous.wins + (event.verdict === "winner" ? 1 : 0),
      acceptable: previous.acceptable + (event.verdict === "acceptable" ? 1 : 0),
      losses: previous.losses + (event.verdict === "loser" ? 1 : 0),
      blocked: previous.blocked + (event.verdict === "blocked" ? 1 : 0),
      averageRating: Number(((previous.averageRating * priorCount + event.rating) / (priorCount + 1)).toFixed(3)),
      explicitPreferenceSignals: previous.explicitPreferenceSignals + (event.explicitCreatorPreference ? 1 : 0),
      lastFeedbackAt: event.createdAt
    };
  }
  const explicitPreferredTreatmentIds = Object.entries(treatmentStats)
    .filter(([, stats]) => stats.explicitPreferenceSignals > 0 && stats.wins + stats.acceptable > stats.losses + stats.blocked)
    .sort((left, right) => right[1].averageRating - left[1].averageRating)
    .map(([treatmentId]) => treatmentId);
  return maulCreatorTasteMemorySchema.parse({
    schemaVersion: "maul-creator-taste-memory/v1",
    tenantId,
    creatorId,
    advisoryOnly: true,
    silentIntentMutationAllowed: false,
    explicitPreferredTreatmentIds,
    treatmentStats,
    feedbackEventIds: feedback.map((event) => event.eventId),
    updatedAt
  });
};

const buildPatternMemory = ({
  feedback,
  outcomes,
  updatedAt
}: {
  feedback: MaulFeedbackEvent[];
  outcomes: MaulOutcomeEvent[];
  updatedAt: string;
}): MaulPatternMemory => {
  const treatments: Record<string, ReturnType<typeof blankPatternTreatment>> = {};
  for (const event of feedback) {
    const stats = treatments[event.treatmentId] ?? blankPatternTreatment();
    const failureCounts = {...stats.failureCounts};
    for (const failure of event.failureClasses) {
      failureCounts[failure] = (failureCounts[failure] ?? 0) + 1;
    }
    treatments[event.treatmentId] = {
      ...stats,
      wins: stats.wins + (event.verdict === "winner" ? 1 : 0),
      acceptable: stats.acceptable + (event.verdict === "acceptable" ? 1 : 0),
      losses: stats.losses + (event.verdict === "loser" ? 1 : 0),
      blocked: stats.blocked + (event.verdict === "blocked" ? 1 : 0),
      failureCounts
    };
  }
  for (const event of outcomes) {
    const stats = treatments[event.treatmentId] ?? blankPatternTreatment();
    const count = stats.outcomes.count;
    const nextCount = count + 1;
    treatments[event.treatmentId] = {
      ...stats,
      outcomes: {
        count: nextCount,
        averageViews: Number(((stats.outcomes.averageViews * count + event.metrics.views) / nextCount).toFixed(3)),
        averageWatchPercentage: Number(((stats.outcomes.averageWatchPercentage * count + event.metrics.averageWatchPercentage) / nextCount).toFixed(4)),
        averageClickThroughRate: Number(((stats.outcomes.averageClickThroughRate * count + event.metrics.clickThroughRate) / nextCount).toFixed(4))
      }
    };
  }
  return maulPatternMemorySchema.parse({
    schemaVersion: "maul-pattern-memory/v1",
    advisoryOnly: true,
    treatments,
    updatedAt
  });
};

export class MaulLearningStore {
  private readonly lock = new LearningLock();

  public constructor(
    private readonly rootDir: string,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  private learningDir(): string {
    return path.join(this.rootDir, "maul", "learning");
  }

  private tastePath(tenantId: string, creatorId: string): string {
    return path.join(this.learningDir(), "creator-taste", `${keyHash(`${tenantId}:${creatorId}`)}.json`);
  }

  private patternPath(): string {
    return path.join(this.learningDir(), "pattern-memory.json");
  }

  private feedbackPath(id: string): string {
    return path.join(this.learningDir(), "feedback", `${id}.json`);
  }

  private outcomePath(id: string): string {
    return path.join(this.learningDir(), "outcomes", `${id}.json`);
  }

  public async initialize(): Promise<void> {
    await mkdir(this.learningDir(), {recursive: true});
  }

  private async feedbackFiles(): Promise<Array<{filePath: string; event: MaulFeedbackEvent}>> {
    const directory = path.join(this.learningDir(), "feedback");
    try {
      const names = (await readdir(directory)).filter((name) => name.endsWith(".json"));
      return Promise.all(names.map(async (name) => ({
        filePath: path.join(directory, name),
        event: maulFeedbackEventSchema.parse(JSON.parse(await readFile(path.join(directory, name), "utf8")))
      })));
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
  }

  private async outcomeFiles(): Promise<Array<{filePath: string; event: MaulOutcomeEvent}>> {
    const directory = path.join(this.learningDir(), "outcomes");
    try {
      const names = (await readdir(directory)).filter((name) => name.endsWith(".json"));
      return Promise.all(names.map(async (name) => ({
        filePath: path.join(directory, name),
        event: maulOutcomeEventSchema.parse(JSON.parse(await readFile(path.join(directory, name), "utf8")))
      })));
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
  }

  public async deleteProjectRecords({
    projectId,
    tenantId,
    creatorId
  }: {
    projectId: string;
    tenantId: string;
    creatorId: string;
  }): Promise<{deletedFeedbackEvents: number; deletedOutcomeEvents: number}> {
    return this.lock.run(async () => {
      const [feedbackFiles, outcomeFiles] = await Promise.all([
        this.feedbackFiles(),
        this.outcomeFiles()
      ]);
      const deletedFeedback = feedbackFiles.filter(({event}) => event.projectId === projectId);
      const deletedOutcomes = outcomeFiles.filter(({event}) => event.projectId === projectId);
      await Promise.all([
        ...deletedFeedback.map(({filePath}) => unlink(filePath)),
        ...deletedOutcomes.map(({filePath}) => unlink(filePath))
      ]);
      const remainingFeedback = feedbackFiles
        .filter(({event}) => event.projectId !== projectId)
        .map(({event}) => event);
      const remainingOutcomes = outcomeFiles
        .filter(({event}) => event.projectId !== projectId)
        .map(({event}) => event);
      const timestamp = this.now();
      const creatorFeedback = remainingFeedback.filter(
        (event) => event.tenantId === tenantId && event.creatorId === creatorId
      );
      await Promise.all([
        atomicJson(this.tastePath(tenantId, creatorId), buildTasteMemory({
          tenantId,
          creatorId,
          feedback: creatorFeedback,
          updatedAt: timestamp
        })),
        atomicJson(this.patternPath(), buildPatternMemory({
          feedback: remainingFeedback,
          outcomes: remainingOutcomes,
          updatedAt: timestamp
        }))
      ]);
      return {
        deletedFeedbackEvents: deletedFeedback.length,
        deletedOutcomeEvents: deletedOutcomes.length
      };
    });
  }

  public async readTasteMemory(tenantId: string, creatorId: string): Promise<MaulCreatorTasteMemory> {
    try {
      return maulCreatorTasteMemorySchema.parse(
        JSON.parse(await readFile(this.tastePath(tenantId, creatorId), "utf8"))
      );
    } catch (error) {
      if (!isMissing(error)) throw error;
      return maulCreatorTasteMemorySchema.parse({
        schemaVersion: "maul-creator-taste-memory/v1",
        tenantId,
        creatorId,
        advisoryOnly: true,
        silentIntentMutationAllowed: false,
        explicitPreferredTreatmentIds: [],
        treatmentStats: {},
        feedbackEventIds: [],
        updatedAt: this.now()
      });
    }
  }

  public async readPatternMemory(): Promise<MaulPatternMemory> {
    try {
      return maulPatternMemorySchema.parse(JSON.parse(await readFile(this.patternPath(), "utf8")));
    } catch (error) {
      if (!isMissing(error)) throw error;
      return maulPatternMemorySchema.parse({
        schemaVersion: "maul-pattern-memory/v1",
        advisoryOnly: true,
        treatments: {},
        updatedAt: this.now()
      });
    }
  }

  public async recordFeedback({
    projectId,
    tenantId,
    creatorId,
    input
  }: {
    projectId: string;
    tenantId: string;
    creatorId: string;
    input: unknown;
  }): Promise<{event: MaulFeedbackEvent; tasteMemory: MaulCreatorTasteMemory; patternMemory: MaulPatternMemory}> {
    const request = maulFeedbackRequestSchema.parse(input);
    return this.lock.run(async () => {
      const createdAt = this.now();
      const event = maulFeedbackEventSchema.parse({
        ...request,
        schemaVersion: "maul-feedback/v1",
        eventId: eventId("maul_feedback"),
        projectId,
        tenantId,
        creatorId,
        createdAt
      });
      const taste = await this.readTasteMemory(tenantId, creatorId);
      const previous = taste.treatmentStats[request.treatmentId] ?? blankStats();
      const priorCount = previous.wins + previous.acceptable + previous.losses + previous.blocked;
      const nextStats = {
        ...previous,
        wins: previous.wins + (request.verdict === "winner" ? 1 : 0),
        acceptable: previous.acceptable + (request.verdict === "acceptable" ? 1 : 0),
        losses: previous.losses + (request.verdict === "loser" ? 1 : 0),
        blocked: previous.blocked + (request.verdict === "blocked" ? 1 : 0),
        averageRating: Number(((previous.averageRating * priorCount + request.rating) / (priorCount + 1)).toFixed(3)),
        explicitPreferenceSignals: previous.explicitPreferenceSignals + (request.explicitCreatorPreference ? 1 : 0),
        lastFeedbackAt: createdAt
      };
      const treatmentStats = {...taste.treatmentStats, [request.treatmentId]: nextStats};
      const explicitPreferredTreatmentIds = Object.entries(treatmentStats)
        .filter(([, stats]) => stats.explicitPreferenceSignals > 0 && stats.wins + stats.acceptable > stats.losses + stats.blocked)
        .sort((left, right) => right[1].averageRating - left[1].averageRating)
        .map(([treatmentId]) => treatmentId);
      const nextTaste = maulCreatorTasteMemorySchema.parse({
        ...taste,
        explicitPreferredTreatmentIds,
        treatmentStats,
        feedbackEventIds: [...taste.feedbackEventIds, event.eventId],
        updatedAt: createdAt
      });

      const pattern = await this.readPatternMemory();
      const patternStats = pattern.treatments[request.treatmentId] ?? blankPatternTreatment();
      const failureCounts = {...patternStats.failureCounts};
      for (const failure of request.failureClasses) {
        failureCounts[failure] = (failureCounts[failure] ?? 0) + 1;
      }
      const nextPattern = maulPatternMemorySchema.parse({
        ...pattern,
        treatments: {
          ...pattern.treatments,
          [request.treatmentId]: {
            ...patternStats,
            wins: patternStats.wins + (request.verdict === "winner" ? 1 : 0),
            acceptable: patternStats.acceptable + (request.verdict === "acceptable" ? 1 : 0),
            losses: patternStats.losses + (request.verdict === "loser" ? 1 : 0),
            blocked: patternStats.blocked + (request.verdict === "blocked" ? 1 : 0),
            failureCounts
          }
        },
        updatedAt: createdAt
      });
      await Promise.all([
        atomicJson(this.feedbackPath(event.eventId), event),
        atomicJson(this.tastePath(tenantId, creatorId), nextTaste),
        atomicJson(this.patternPath(), nextPattern)
      ]);
      return {event, tasteMemory: nextTaste, patternMemory: nextPattern};
    });
  }

  public async recordOutcome({
    projectId,
    tenantId,
    creatorId,
    input
  }: {
    projectId: string;
    tenantId: string;
    creatorId: string;
    input: unknown;
  }): Promise<{event: MaulOutcomeEvent; patternMemory: MaulPatternMemory}> {
    const request = maulOutcomeRequestSchema.parse(input);
    return this.lock.run(async () => {
      const createdAt = this.now();
      const event = maulOutcomeEventSchema.parse({
        ...request,
        schemaVersion: "maul-outcome/v1",
        eventId: eventId("maul_outcome"),
        projectId,
        tenantId,
        creatorId,
        createdAt
      });
      const pattern = await this.readPatternMemory();
      const stats = pattern.treatments[request.treatmentId] ?? blankPatternTreatment();
      const count = stats.outcomes.count;
      const nextCount = count + 1;
      const nextPattern = maulPatternMemorySchema.parse({
        ...pattern,
        treatments: {
          ...pattern.treatments,
          [request.treatmentId]: {
            ...stats,
            outcomes: {
              count: nextCount,
              averageViews: Number(((stats.outcomes.averageViews * count + request.metrics.views) / nextCount).toFixed(3)),
              averageWatchPercentage: Number(((stats.outcomes.averageWatchPercentage * count + request.metrics.averageWatchPercentage) / nextCount).toFixed(4)),
              averageClickThroughRate: Number(((stats.outcomes.averageClickThroughRate * count + request.metrics.clickThroughRate) / nextCount).toFixed(4))
            }
          }
        },
        updatedAt: createdAt
      });
      await Promise.all([
        atomicJson(this.outcomePath(event.eventId), event),
        atomicJson(this.patternPath(), nextPattern)
      ]);
      return {event, patternMemory: nextPattern};
    });
  }
}
