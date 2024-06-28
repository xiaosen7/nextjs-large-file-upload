import { ChunksHashCalculator } from "../models/chunks-hash-calculator";

self.onmessage = async (e) => {
  const chunks = e.data as Blob[];

  const calculator = new ChunksHashCalculator(chunks);

  calculator.progress$.subscribe((progress) => {
    self.postMessage({
      progress,
    });
  });

  try {
    const hash = await calculator.calc();

    self.postMessage({
      percentage: 100,
      hash,
    });
  } catch (error) {
    self.postMessage({
      error,
    });
  } finally {
    self.close();
  }
};
