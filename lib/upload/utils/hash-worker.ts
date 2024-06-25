// 导入脚本
import SparkMD5 from "spark-md5";
import { IFilePiece } from "../types";
import { PromisePool } from "./promise-pool";

const readChunk = (file: Blob) => {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = (e) => {
      const result = e.target?.result;
      if (result instanceof ArrayBuffer) {
        resolve(result);
      }
    };
    // 这里需要增加容错处理
  });
};

// 生成文件 hash
self.onmessage = async (e) => {
  const { fileChunkList } = e.data as { fileChunkList: IFilePiece[] };
  const spark = new SparkMD5.ArrayBuffer();

  const promisePool = new PromisePool({
    data: fileChunkList,
    concurrency: 3,
    process: async ({ chunk }) => {
      const res = await readChunk(chunk);
      spark.append(res);
    },
  });

  promisePool.start();

  promisePool.progress$.subscribe((progress) => {
    self.postMessage({
      percentage: progress,
    });
  });

  promisePool.state$.subscribe((state) => {
    if (state === PromisePool.EState.Complete) {
      self.postMessage({
        percentage: 100,
        hash: spark.end(),
      });
      self.close();
    }
  });
};
