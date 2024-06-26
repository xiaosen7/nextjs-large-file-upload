import { ChunksHashCalculator } from "../models/chunks-hash-calculator";

self.onmessage = async (e) => {
  const chunks = e.data as Blob[];

  const calculator = new ChunksHashCalculator(chunks);

  calculator.progress$.subscribe((progress) => {
    self.postMessage({
      progress,
    });
  });

  const hash = await calculator.calc();

  self.postMessage({
    percentage: 100,
    hash,
  });

  self.close();
};
