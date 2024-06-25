import { CHUNK_SIZE } from "../constants";
import { IFilePiece } from "../types";
import { createFormData } from "../utils/base";
import { PromisePool } from "../utils/promise-pool";

export interface IUploadClientApi {
  exists: (hash: string) => Promise<boolean>;
  chunkExists: (hash: string, index: number) => Promise<boolean>;
  mergeFile: (hash: string) => Promise<void>;
  uploadChunk: (formData: FormData) => Promise<void>;
}

export interface IUploadChunkData {
  hash: string;
  chunk: Blob;
  index: number;
}

interface IUploadChunksOptions {
  pieces: IFilePiece[];
  hash: string;
  parallelSize?: number;
}

export class UploadClient {
  constructor(private file: File, private api: IUploadClientApi) {}

  split(chunkSize = CHUNK_SIZE) {
    const fileChunkList: IFilePiece[] = [];
    let cur = 0;
    while (cur < this.file.size) {
      const piece = this.file.slice(cur, cur + chunkSize);
      fileChunkList.push({
        chunk: piece,
        size: piece.size,
      });
      cur += chunkSize;
    }
    return fileChunkList;
  }

  calHash = ({
    chunks,
    onTick,
  }: {
    chunks: IFilePiece[];
    onTick?: (percentage: number) => void;
  }): Promise<string> => {
    return new Promise((resolve) => {
      // 添加 worker 属性，webworker
      const worker = new Worker(
        new URL("../utils/hash-worker.ts", import.meta.url)
      );
      worker.postMessage({ fileChunkList: chunks });
      worker.onmessage = (e) => {
        const { hash, percentage } = e.data;
        const hashPercentage = parseInt(percentage.toFixed(2));
        onTick?.(hashPercentage);
        if (hash) {
          resolve(hash);
        }
      };
    });
  };

  uploadChunks(options: IUploadChunksOptions) {
    const { pieces: originChunks, hash, parallelSize = 3 } = options;
    const uploadChunksPool = new PromisePool({
      data: originChunks,
      concurrency: parallelSize,
      process: async ({ chunk }, index) => {
        const exists = await this.api.chunkExists(hash, index);
        if (!exists) {
          await this.api.uploadChunk(
            createFormData({ hash, chunk: chunk, index })
          );
        }
      },
    });

    return uploadChunksPool;
  }

  merge(hash: string) {
    return this.api.mergeFile(hash);
  }
}
