import {readFileSync, unlinkSync, writeFileSync} from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const target = path.resolve(root, "scripts/run-raw-joseph-proof.ts");
if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Path escaped workspace.");
const original = readFileSync(target, "utf8");
const eol = original.includes("\r\n") ? "\r\n" : "\n";
let source = original.replaceAll("\r\n", "\n");
const before = `main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});`;
const after = `main().catch((error: unknown) => {
  try {
    const record = error && typeof error === "object" ? error as {name?: unknown; message?: unknown; stack?: unknown} : null;
    const name = typeof record?.name === "string" ? record.name : "Error";
    const message = typeof record?.message === "string" ? record.message : String(error);
    const stack = typeof record?.stack === "string" ? record.stack : `${"${"}name}: ${"${"}message}`;
    process.stderr.write(`${"${"}stack}\n`);
  } catch {
    process.stderr.write("Joseph proof failed with an unprintable error.\\n");
  }
  process.exitCode = 1;
});`;
if (source.split(before).length - 1 !== 1) throw new Error("Proof catch block was not found exactly once.");
source = source.replace(before, after);
writeFileSync(target, source.replaceAll("\n", eol), "utf8");
unlinkSync(path.resolve(root, "scripts/harden-proof-error-reporting.mjs"));
