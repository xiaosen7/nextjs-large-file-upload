import { ChunksHashCalculator } from "@/upload/models/chunks-hash-calculator";

describe("ChunksHashCalculator", () => {
  test("calc", async () => {
    const blob1 = new Blob(["a"]);
    const blob2 = new Blob(["a"]);
    const blob3 = new Blob(["b"]);

    const c1 = new ChunksHashCalculator([blob1]);
    const c2 = new ChunksHashCalculator([blob2]);
    const c3 = new ChunksHashCalculator([blob3]);

    const h1 = await c1.calc();
    const h2 = await c2.calc();
    const h3 = await c3.calc();

    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  test("progress$", async () => {
    const calculator = new ChunksHashCalculator([
      new Blob(["a"]),
      new Blob(["b"]),
    ]);

    const progressObserver = vi.fn();
    calculator.progress$.subscribe(progressObserver);
    await calculator.calc();

    expect(progressObserver).toHaveBeenCalledTimes(3);
    expect(progressObserver).toHaveBeenNthCalledWith(1, 0);
    expect(progressObserver).toHaveBeenNthCalledWith(2, 50);
    expect(progressObserver).toHaveBeenNthCalledWith(3, 100);
  });
});
