import type {PipelineExecutionContext} from "../execution-context";
import type {
  ExecutionCapability,
  JobExecutionResult,
  PipelineExecutor
} from "./executor-contract";

type SharedPipelineRunner = (
  context: PipelineExecutionContext
) => Promise<JobExecutionResult>;

export class MainVideoExecutor implements PipelineExecutor {
  private readonly runSharedPipeline: SharedPipelineRunner;

  public constructor({
    runSharedPipeline
  }: {
    runSharedPipeline: SharedPipelineRunner;
  }) {
    this.runSharedPipeline = runSharedPipeline;
  }

  public capability(): ExecutionCapability {
    return "main_video";
  }

  public async execute(context: PipelineExecutionContext): Promise<JobExecutionResult> {
    const result = await this.runSharedPipeline(context);
    return {
      ...result,
      capability: this.capability()
    };
  }
}
