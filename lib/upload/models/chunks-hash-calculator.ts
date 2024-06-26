import { once } from "lodash-es";
import { BehaviorSubject } from "rxjs";
import SparkMD5 from "spark-md5";

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

export class ChunksHashCalculator {
  progress$ = new BehaviorSubject<number>(0);

  constructor(private chunks: Blob[]) {}

  calc = once(async () => {
    const { chunks } = this;
    const spark = new SparkMD5.ArrayBuffer();

    // Can't use parallel processing here, because spark.append() is used.
    let i = 0;
    const total = chunks.length;
    while (i < total) {
      const progress = ((i + 1) / total) * 100;
      this.progress$.next(progress);

      const chunk = chunks[i];
      spark.append(await readChunk(chunk));

      i++;
    }

    const hash = spark.end();

    return hash;
  });
}
