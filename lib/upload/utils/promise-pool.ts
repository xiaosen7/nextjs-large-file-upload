import { ERRORS } from "@/shared/constants/errors";
import {
  BehaviorSubject,
  Subject,
  Subscription,
  from,
  interval,
  mergeMap,
  range,
  takeUntil,
} from "rxjs";

type ITask = () => Promise<void>;

export interface IPromisePoolOptions {
  concurrency: number;
}

export class PromisePool {
  progress$ = new BehaviorSubject<number>(0);
  error$ = new Subject<{
    index: number;
    error: unknown;
  }>();
  finish$ = new Subject<{ index: number; error?: unknown }>();
  finishAll$ = new Subject<void>();
  elapse$ = new BehaviorSubject<number>(0);

  #stop$ = new Subject<void>();

  #started = false;
  #stopPromise: Promise<void> | null = null;
  #total = 0;
  #tasks: ITask[] = [];
  #activatedIndices = new Set<number>();
  #finishedIndices = new Set<number>();

  #subscription = new Subscription();

  constructor(private options: IPromisePoolOptions) {
    if (options.concurrency <= 0) {
      throw ERRORS.upload.invalidConcurrencyType;
    }
  }

  append(task: ITask) {
    this.#total += 1;
    this.#tasks.push(task);
  }

  #startTimer() {
    interval(100)
      .pipe(takeUntil(this.#stop$))
      .subscribe(() => {
        this.elapse$.next(this.elapse$.value + 1);
      });
  }

  start() {
    if (this.#stopPromise) {
      this.continue();
      return;
    }

    if (this.#started) {
      return;
    }

    this.#started = true;

    const { concurrency } = this.options;

    // below code will only execute once

    this.#startTimer();

    this.#subscription.add(
      range(0, this.#tasks.length)
        .pipe(
          mergeMap((index) => {
            return from(Promise.resolve(this.#stopPromise)).pipe(
              mergeMap(() => {
                this.progress$.next(((index + 1) / this.#total) * 100);

                return this.#tasks
                  [index]()
                  .then(() => ({ index, error: undefined }))
                  .catch((error) => {
                    return {
                      index,
                      error,
                    };
                  });
              })
            );
          }, concurrency)
        )
        .subscribe({
          next: ({ index, error }) => {
            this.#finishedIndices.add(index);

            if (error) {
              this.error$.next({
                index,
                error,
              });
            }

            this.finish$.next({ index, error });
          },
          complete: () => {
            this.finishAll$.next();
            this.destroy();
          },
        })
    );
  }

  private continue() {
    void 0;
  }

  stop() {
    if (this.#stopPromise) {
      return;
    }

    this.#stop$.next();

    this.#stopPromise = new Promise((resolve) => {
      this.continue = () => {
        this.#stopPromise = null;
        this.#startTimer();
        resolve();
      };
    });
  }

  destroy() {
    this.#subscription.unsubscribe();
    this.progress$.complete();
    this.error$.complete();
    this.#stop$.complete();
    this.finish$.complete();
    this.finishAll$.complete();
    this.elapse$.complete();
    this.#tasks = [];
  }
}
