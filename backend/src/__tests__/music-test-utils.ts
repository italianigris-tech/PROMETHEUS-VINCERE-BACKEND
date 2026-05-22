import {mkdtemp, rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const makeMusicTempDir = async (): Promise<string> => {
  return mkdtemp(path.join(os.tmpdir(), "video-music-backend-"));
};

export const cleanupMusicTempDir = async (dir: string): Promise<void> => {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rm(dir, {recursive: true, force: true});
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }

  throw lastError;
};
