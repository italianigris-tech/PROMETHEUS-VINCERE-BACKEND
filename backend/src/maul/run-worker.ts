import {createBackendApp} from "../app.js";
import {MaulWorkerExecutor} from "./worker-executor.js";

const main = async (): Promise<void> => {
  const context = await createBackendApp();
  const workerId = process.env.MAUL_WORKER_ID?.trim() || `maul_worker_${process.pid}`;
  const executor = new MaulWorkerExecutor({
    control: context.maulControlPlane,
    projects: context.maulProjects,
    workerId,
  });
  const job = await executor.runOnce();
  console.log(job ? `${job.id} ${job.status}` : "no_job");
  await context.app.close();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
