/**
 * One-time Remotion Lambda infra bootstrap for the landscape fan-out.
 *
 * Usage: npm run lambda:deploy
 *
 * Prereqs (done once per machine / CI):
 *   1. AWS credentials configured (AWS_PROFILE or instance role).
 *   2. npx remotion lambda functions deploy --memory 3008
 *      (deploys the render function named by REMOTION_LAMBDA_FUNCTION,
 *      default remotion-render-joseph).
 *
 * This script: getOrCreateBucket + deploySite(landscape-entry). Prints the
 * infra JSON for wiring into renderLandscapeLambda / manual renderMediaOnLambda.
 */
import {deployLandscapeLambdaInfra} from '../src/lambda-render.js';

const infra = await deployLandscapeLambdaInfra({});
console.log(JSON.stringify(infra, null, 2));
