import { once } from "lodash-es";
import { BehaviorSubject, Subject } from "rxjs";
import { isPositiveInter } from "./type";

enum EPromisePoolState {
  Stopped = "Stopped",
  Running = "Running",
  Complete = "Complete",
}

interface IPromisePoolOptions<TData, TValue> {
  concurrency: number;
  data: TData[];
  process: (data: TData, index: number) => Promise<TValue>;
}

interface IPromisePoolResult<TValue> {
  value: TValue | null;
  error: any;
}
/**
 * A promise pool with concurrency control.
 */
export class PromisePool<TData = any, TValue = any> {
  static EState = EPromisePoolState;

  state$ = new BehaviorSubject<EPromisePoolState>(EPromisePoolState.Stopped);
  progress$ = new BehaviorSubject<number>(0);
  error$ = new Subject();

  #results: Array<IPromisePoolResult<TValue>> = [];

  #activeDataIndices = new Set<number>();
  #isPoolFull = false;
  #stopPromise: Promise<void> | null = null;
  #resultPromise:
    | Promise<
        Array<{
          value: TValue | null;
          error: any;
        }>
      >
    | undefined;

  constructor(private options: IPromisePoolOptions<TData, TValue>) {
    this.#checkOptions(options);
  }

  #checkOptions(options: IPromisePoolOptions<TData, TValue>) {
    const { concurrency } = options;

    if (!isPositiveInter(concurrency)) {
      throw new Error("concurrency should be a positive integer");
    }
  }

  async stop() {
    this.state$.next(EPromisePoolState.Stopped);
    if (this.#stopPromise) {
      return;
    }

    this.#stopPromise = new Promise((resolve) => {
      this.continue = () => {
        this.#stopPromise = null;
        resolve();
      };
    });
  }

  private continue() {
    void 0;
  }

  #loop = once(async () => {
    const { process } = this.options;

    const { concurrency, data } = this.options;
    const promises = data.map((data, index) => () => process(data, index));

    const pool: Set<
      Promise<{
        promiseIndex: number;
        remove: () => void;
      }>
    > = new Set();

    let index = 0;
    let finished = 0;
    const total = promises.length;
    while (index < total) {
      if (this.#stopPromise) {
        await this.#stopPromise;
      }

      const promiseIndex = index;
      this.#activeDataIndices.add(promiseIndex);

      const poolItem = Promise.resolve()
        .then(() => promises[promiseIndex]())
        .then((result) => {
          this.#results[promiseIndex] = {
            value: result,
            error: null,
          };
        })
        .catch((error) => {
          this.error$.next(error);
          this.#results[promiseIndex] = {
            value: null,
            error,
          };
        })
        .then(() => {
          finished++;

          if (finished === total) {
            this.progress$.complete();
            this.state$.next(EPromisePoolState.Complete);
          }

          return {
            promiseIndex,
            remove: () => pool.delete(poolItem),
          };
        });
      pool.add(poolItem);

      const progress = ((promiseIndex + 1) / promises.length) * 100;
      this.progress$.next(progress);

      if (this.#activeDataIndices.size === concurrency) {
        this.#isPoolFull = true;
        await Promise.race([...pool]).then(({ promiseIndex, remove }) => {
          this.#isPoolFull = false;
          this.#activeDataIndices.delete(promiseIndex);
          remove();
        });
      }

      index++;
    }

    await Promise.all(pool); // wait rest promises
    return this.#results;
  });

  start() {
    this.state$.next(EPromisePoolState.Running);

    if (this.#resultPromise) {
      this.continue();
      return this.#resultPromise;
    }

    this.#resultPromise = this.#loop();

    this.#resultPromise;
    return this.#resultPromise;
  }

  isPoolFull() {
    return this.#isPoolFull;
  }

  getActiveDataIndices() {
    return this.#activeDataIndices;
  }

  getResults() {
    return this.#results;
  }

  //#region state
  isStopped() {
    return this.state$.value === EPromisePoolState.Stopped;
  }

  isRunning() {
    return this.state$.value === EPromisePoolState.Running;
  }

  isComplete() {
    return this.state$.value === EPromisePoolState.Complete;
  }

  //#endregion
}
