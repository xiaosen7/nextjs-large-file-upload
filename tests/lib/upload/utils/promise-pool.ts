import { ERRORS } from "@/shared/constants/errors";
import { IPromisePoolOptions, PromisePool } from "@/upload/utils/promise-pool";
import { nameOf } from "../../../test-utils";

const sleep = (ms: number) =>
  new Promise<number>((resolve) => setTimeout(() => resolve(ms), ms));

describe("PromisePool", () => {
  test(nameOf<PromisePool>("progress$"), async () => {
    const data = [1, 2, 3, 4, 5];
    const onProgress = vi.fn(() => {});
    const pool = new PromisePool({
      concurrency: 2,
      data,
      process: async (data) => {
        await sleep(100);
        return data;
      },
    });

    pool.progress$.subscribe(onProgress);

    await pool.start();

    expect(onProgress).toHaveBeenCalledTimes(6);
    expect(onProgress).toHaveBeenNthCalledWith(1, 0);
    expect(onProgress).toHaveBeenLastCalledWith(100);
  });

  describe(nameOf<IPromisePoolOptions>("concurrency"), () => {
    async function doConcurrencyTest(
      concurrency: number,
      timeouts: number[],
      expectedDuration: number
    ) {
      const start = Date.now();
      const results = await new PromisePool({
        concurrency,
        data: timeouts,
        process: async (timeout) => {
          await sleep(timeout);
          return timeout;
        },
      }).start();

      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(expectedDuration);
      expect(elapsed).toBeLessThanOrEqual(expectedDuration + 60);
      expect(results).toEqual(
        timeouts.map((value) => ({ value, error: null }))
      );
    }

    test("1", async () => {
      const concurrency = 1;
      const timeouts = [40, 10, 20, 30, 10];
      const expectedDuration = timeouts.reduce(
        (sum, timeout) => sum + timeout,
        0
      );

      await doConcurrencyTest(concurrency, timeouts, expectedDuration);
    });

    test("2", async () => {
      const concurrency = 2;
      const timeouts = [400, 100, 200, 300, 100];
      const expectedDuration = 600;
      await doConcurrencyTest(concurrency, timeouts, expectedDuration);
    });

    test("ensures", async () => {
      const concurrency = 2;
      const timeouts = [100, 20, 30, 10, 10, 10, 50];
      const expectedDuration = 130;
      await doConcurrencyTest(concurrency, timeouts, expectedDuration);
    });

    test("handles concurrency greater than items in the list", async () => {
      const concurrency = 1000;
      const timeouts = [1, 2, 3, 4, 5];
      const expectedDuration = 5;
      await doConcurrencyTest(concurrency, timeouts, expectedDuration);
    });
  });

  describe("errors", () => {
    test(nameOf<IPromisePoolOptions>("concurrency"), async () => {
      const data = [1, 2, 3, 4, 5];
      expect(
        vi.fn(() => {
          new PromisePool({
            concurrency: -2,
            data,
            process: async (data) => {
              await sleep(100);
              return data;
            },
          });
        })
      ).toThrowError(ERRORS.upload.invalidConcurrencyType);
    });

    test("returns errors", async () => {
      const ids = [1, 2, 3, 4, 5];
      const results = await new PromisePool({
        concurrency: 2,
        data: ids,
        process: async (id) => {
          if (id === 3) {
            throw new Error("3");
          }
          return id;
        },
      }).start();

      expect(results).toEqual(
        ids.map((id) => ({
          value: id === 3 ? null : id,
          error: id === 3 ? new Error("3") : null,
        }))
      );
    });

    test("stores the original error", async () => {
      class CustomError extends Error {
        constructor(message: any) {
          super(message);
        }
      }

      const results = await new PromisePool({
        concurrency: 2,
        data: [1],
        process: async () => {
          throw new CustomError("foo");
        },
      }).start();

      expect(results[0].error).toBeInstanceOf(CustomError);
    });

    test("keeps processing with when errors occur", async () => {
      const ids = Array.from({ length: 10 }, (_, i) => i);

      const results = await new PromisePool({
        concurrency: 2,
        data: ids,
        process: async (id) => {
          if (id === 1) {
            throw new Error("I can’t keep the first item");
          }
          return id;
        },
      }).start();

      expect(results).toEqual(
        results.map(({ error, value }, id) => ({
          error: id === 1 ? new Error("I can’t keep the first item") : error,
          value: id === 1 ? null : value,
        }))
      );
    });
  });

  describe(nameOf<PromisePool>("start"), () => {
    test("start called multiple times should return the same promise", async () => {
      const pool = new PromisePool({
        concurrency: 2,
        data: [1, 2],
        process: async (x) => x,
      });
      const p1 = pool.start();
      const p2 = pool.start();
      expect(p1).toBe(p2);
    });
  });

  describe(nameOf<PromisePool>("stop"), () => {
    test("base", async () => {
      const data = [1, 2];
      const pool = new PromisePool({
        concurrency: 1,
        data,
        process: async (x) => {
          if (x === 1) {
            pool.stop();
          }
          return x;
        },
      });

      const p = pool.start();

      await sleep(100);

      // 1 has been executed over
      expect(Array.from(pool.getActiveDataIndices())).toEqual([]);
      expect(pool.isStopped()).toBeTruthy();

      pool.start();
      expect(pool.isRunning()).toBeTruthy();
      const results = await p;

      expect(results).toEqual(data.map((value) => ({ value, error: null })));
    });
  });

  describe(nameOf<PromisePool>("state$"), () => {
    test("base", async () => {
      const data = [1, 2];
      const pool = new PromisePool({
        concurrency: 1,
        data,
        process: async (x) => {
          if (x === 1) {
            pool.stop();
          }
          return x;
        },
      });
      expect(pool.isStopped()).toBeTruthy();

      pool.start();
      expect(pool.isRunning()).toBeTruthy();

      await sleep(50);

      expect(pool.isStopped()).toBeTruthy();

      const p = pool.start();
      expect(pool.isRunning()).toBeTruthy();
      await p;
      expect(pool.isComplete()).toBeTruthy();
      expect(pool.getResults()).toEqual([
        {
          error: null,
          value: 1,
        },
        {
          error: null,
          value: 2,
        },
      ]);
    });
  });

  test(nameOf<PromisePool>("error$"), async () => {
    const data = [1, 2];
    const expectedError = new Error();
    const pool = new PromisePool({
      concurrency: 1,
      data,
      process: async (x) => {
        if (x === 1) {
          throw expectedError;
        }
        return x;
      },
    });

    const onError = vi.fn();
    pool.error$.subscribe(onError);
    await pool.start();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expectedError);
  });
});
