/* eslint-disable @typescript-eslint/no-require-imports */
import path from "path";
import fs from "fs";
import logger from "@/configs/logger";

const scriptName = process.argv[2];
if (!scriptName) {
  logger.error(
    "❌ Please provide a script name. Example: npm run script -- migrate",
  );
  process.exit(1);
}

const scriptPathTs = path.resolve(__dirname, `${scriptName}.ts`);
const scriptPathJs = path.resolve(__dirname, `${scriptName}.js`);

let scriptToRun: string | null = null;
if (fs.existsSync(scriptPathTs)) scriptToRun = scriptPathTs;
else if (fs.existsSync(scriptPathJs)) scriptToRun = scriptPathJs;

if (!scriptToRun) {
  logger.error(
    `❌ Could not find script: ${scriptName}.ts or ${scriptName}.js in ./scripts`,
  );
  process.exit(1);
}

const nodeExec = process.argv[0];
const scriptArg0 = scriptToRun;
const extraArgs = process.argv.slice(3);

const originalArgv = process.argv.slice();
process.argv = [nodeExec, scriptArg0, ...extraArgs];

try {
  require(scriptToRun);
} catch (err) {
  logger.error(err, "❌ Error while running script:");
  process.exit(1);
} finally {
  process.argv = originalArgv;
}
