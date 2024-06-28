import { IS_VERCEL } from "@/shared/constants";

export const DEFAULTS = {
  mergedFileName: "merged",
  chunksDir: "chunks",
  chunkSize: IS_VERCEL ? 100 * 1024 : 5 * 1024 * 1024,
  concurrency: IS_VERCEL ? 1 : 3,
};
