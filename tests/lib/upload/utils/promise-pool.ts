import { ERRORS } from "@/shared/constants/errors";
import { IPromisePoolOptions, PromisePool } from "@/upload/utils/promise-pool";
import { firstValueFrom } from "rxjs";
import { nameOf } from "../../../test-utils";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(() => resolve(), ms));

describe("PromisePool2", () => {
  describe("options validation", () => {
    test("concurrency", async () => {
      expect(
        vi.fn(() => {
          new PromisePool({ concurrency: 0 });
        })
      ).toThrowError(ERRORS.upload.invalidConcurrencyType);
    });
  });

  test(nameOf<PromisePool>("progress$"), async () => {
    const data = [1, 2, 3, 4, 5];
    const onProgress = vi.fn();

    const pool = new PromisePool({ concurrency: 2 });
    pool.progress$.subscribe(onProgress);
    data.forEach(() => pool.append(async () => {}));

    pool.start();
    await firstValueFrom(pool.finishAll$);

    expect(onProgress).toHaveBeenCalledTimes(data.length + 1);
    expect(onProgress).toHaveBeenNthCalledWith(1, 0);
    data.forEach((_, index) => {
      const nth = index + 2;
      const arg = ((index + 1) / data.length) * 100;
      expect(onProgress).toHaveBeenNthCalledWith(nth, arg);
    });
  });

  describe(nameOf<PromisePool>("error$"), () => {
    test("should emit error", async () => {
      const ids = [1, 2, 3, 4, 5];
      const error = new Error("error");
      const pool = new PromisePool({ concurrency: 2 });

      ids.forEach((id) => {
        pool.append(async () => {
          if (id === 3) {
            throw error;
          }
        });
      });

      pool.start();

      const onError = vi.fn();
      pool.error$.subscribe(onError);

      await firstValueFrom(pool.finishAll$);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith({ index: 2, error });
    });
  });

  test(nameOf<PromisePool>("elapse$"), async (): Promise<void> => {
    const timeouts = [100, 100, 100, 100, 100];

    const pool = new PromisePool({
      concurrency: 1,
    });

    timeouts.forEach((ms) =>
      pool.append(async () => {
        await sleep(ms);
      })
    );

    pool.start();

    await sleep(350);
    expect(pool.elapse$.value).toBe(3);
  });

  describe(nameOf<IPromisePoolOptions>("concurrency"), () => {
    async function doConcurrencyTest(
      concurrency: number,
      timeouts: number[],
      expectedDuration: number
    ) {
      const startTime = Date.now();
      const pool = new PromisePool({ concurrency });
      timeouts.forEach((timeout) => {
        pool.append(() => sleep(timeout));
      });

      pool.start();
      await firstValueFrom(pool.finishAll$);

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(expectedDuration);
      expect(elapsed).toBeLessThanOrEqual(expectedDuration + 60);
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

  describe(nameOf<PromisePool>("stop"), () => {
    test("stop and start", async () => {
      const timeouts = [100, 100, 100, 100, 100];

      const pool = new PromisePool({
        concurrency: 1,
      });

      timeouts.forEach((ms) =>
        pool.append(async () => {
          await sleep(ms);
        })
      );

      const finishObserver = vi.fn();
      const progressObserver = vi.fn();
      pool.finish$.subscribe(finishObserver);
      pool.progress$.subscribe(progressObserver);

      pool.start();

      await sleep(350);

      pool.stop();

      expect(finishObserver).toBeCalledTimes(3);
      expect(progressObserver).toBeCalledTimes(5);

      await sleep(350);
      expect(finishObserver).toBeCalledTimes(4);
      expect(progressObserver).toBeCalledTimes(5);
    });
  });
});
