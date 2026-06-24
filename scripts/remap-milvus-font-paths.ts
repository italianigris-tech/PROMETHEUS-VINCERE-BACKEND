import {readFile} from "node:fs/promises";
import path from "node:path";

type RemappedFontRecord = {
  fontId?: string;
  publicPath?: string;
  newPublicPath?: string;
};

const requiredCredentials = ["MILVUS_ADDRESS", "MILVUS_TOKEN", "ZILLIZ_API_KEY"] as const;
const missingCredentials = requiredCredentials.filter((name) => !process.env[name]);

if (missingCredentials.length > 0) {
  throw new Error(`Milvus/Zilliz font remap skipped: missing required credential(s): ${missingCredentials.join(", ")}.`);
}

const manifestPath = path.resolve("font-intelligence", "outputs", "font-manifest-remapped.json");
const records = JSON.parse(await readFile(manifestPath, "utf8")) as RemappedFontRecord[];

if (!Array.isArray(records) || records.length === 0) {
  throw new Error(`Milvus/Zilliz font remap requires a non-empty remapped manifest at ${manifestPath}.`);
}

throw new Error(
  [
    "Milvus/Zilliz credentials are present, but automatic vector-preserving bulk upsert is not implemented in this repository yet.",
    "Manual ops step: export existing font vectors by ID, update metadata_json.publicPath from font-manifest-remapped.json, then upsert the same vector values without regenerating embeddings.",
    `Records ready for remap: ${records.length}.`,
  ].join(" ")
);
