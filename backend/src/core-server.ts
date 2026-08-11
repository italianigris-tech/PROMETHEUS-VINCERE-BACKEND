import {createCoreApp} from "./core-app.js";

const bootstrap = async (): Promise<void> => {
  const {app, env} = await createCoreApp();
  await app.listen({
    port: env.PORT,
    host: "0.0.0.0",
  });
  console.log(`Core backend listening on http://0.0.0.0:${env.PORT}`);
};

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
