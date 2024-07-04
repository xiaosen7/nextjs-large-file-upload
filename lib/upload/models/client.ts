import { ERRORS } from "@/shared/constants/errors";
import { createFormData } from "@/shared/utils/type";
import { once } from "lodash-es";
import memoize from "p-memoize";
import {
  BehaviorSubject,
  EMPTY,
  Subject,
  Subscription,
  concatAll,
  concatMap,
  from,
  interval,
  map,
  switchMap,
  take,
  tap,
} from "rxjs";
import { DEFAULTS } from "../constants/defaults";
import { AsyncQueue } from "../utils/async-queue";
import { calculateChunksHashByWorker } from "../workers/calculate-hash";

export enum EUploadClientState {
  Default,
  CalculatingHash,
  CheckingFileExists,
  FastUploaded,
  WaitForUpload,
  Uploading,
  UploadStopped,
  Merging,
  UploadSuccessfully,
  Error,
}

export interface IUploadChunkData {
  hash: string;
  chunk: Blob | Buffer;
  index: number;
}

export interface IUploadClientActions {
  fileExists: (hash: string) => Promise<boolean>;
  chunkExists: (hash: string, index: number) => Promise<boolean>;
  merge: (hash: string) => Promise<void>;
  uploadChunk: (formData: FormData) => Promise<void>;
  getLastExistedChunkIndex: (hash: string) => Promise<number>;
}

export class UploadClient {
  static EState = EUploadClientState;

  state$ = new BehaviorSubject<EUploadClientState>(EUploadClientState.Default);
  progress$ = new BehaviorSubject<number>(0);
  error$ = new Subject();
  poolElapse$ = new BehaviorSubject<number>(0);

  #subscription = new Subscription();
  #destroyed = false;

  #asyncQueue: AsyncQueue;

  constructor(
    public readonly file: File,
    private actions: IUploadClientActions,
    public readonly concurrency = DEFAULTS.concurrency,
    public readonly chunkSize = DEFAULTS.chunkSize
  ) {
    this.#asyncQueue = new AsyncQueue({ concurrency });
    this.#asyncQueue.pause();
  }

  #split() {
    const chunks: Blob[] = [];
    let cur = 0;
    while (cur < this.file.size) {
      const piece = this.file.slice(cur, cur + this.chunkSize);
      chunks.push(piece);
      cur += this.chunkSize;
    }
    return chunks;
  }

  #calcHash = memoize(async () => {
    const chunks = this.#split();
    this.state$.next(EUploadClientState.CalculatingHash);
    const hash = await calculateChunksHashByWorker(chunks, (progress) => {
      this.progress$.next(progress);
    });

    return {
      hash,
      chunks,
    };
  });

  async #checkExists() {
    const { chunks, hash } = await this.#calcHash();

    this.state$.next(EUploadClientState.CheckingFileExists);
    const exists = await this.actions.fileExists(hash);

    return {
      exists,
      hash,
      chunks,
    };
  }

  async #initialAsyncQueue(hash: string, chunks: Blob[]) {
    this.#asyncQueue.kill();
    this.#asyncQueue = new AsyncQueue({ concurrency: this.concurrency });
    this.#asyncQueue.pause();

    const lastExistedChunkIndex = await this.actions.getLastExistedChunkIndex(
      hash
    );

    chunks.forEach((chunk, index) => {
      this.#asyncQueue.push(async () => {
        if (lastExistedChunkIndex >= index) {
          return;
        }

        const exists = await this.actions.chunkExists(hash, index);
        if (!exists) {
          await this.actions.uploadChunk(
            createFormData({ hash, chunk, index })
          );
        }
      });
    });

    this.#subscription.add(
      this.#asyncQueue.error$.subscribe((v) => this.#handleError(v))
    );

    this.#subscription.add(
      this.#asyncQueue.progress$.subscribe((v) => this.progress$.next(v))
    );

    this.#subscription.add(
      interval(100).subscribe(() => {
        this.poolElapse$.next(this.#asyncQueue.runningTime / 100);
      })
    );
  }

  #handleError = (error: unknown) => {
    this.state$.next(EUploadClientState.Error);
    this.error$.next(error);
    this.#asyncQueue.pause();
  };

  #run(autoUpload = false) {
    if (this.#destroyed) {
      throw ERRORS.upload.clientHasDestroyed;
    }

    this.#subscription.unsubscribe();
    this.#subscription = new Subscription();

    this.#subscription.add(
      from(this.#checkExists())
        .pipe(
          switchMap(({ chunks, exists, hash }) => {
            if (exists) {
              this.progress$.next(100);
              this.state$.next(EUploadClientState.FastUploaded);
              return EMPTY;
            }

            return from(this.#initialAsyncQueue(hash, chunks)).pipe(
              concatMap(() => {
                if (autoUpload) {
                  this.startPool();
                } else {
                  this.state$.next(EUploadClientState.WaitForUpload);
                }

                return from(this.#asyncQueue.drain()).pipe(
                  map(() => {
                    this.#asyncQueue.pause();
                    this.progress$.next(100);
                    this.state$.next(EUploadClientState.Merging);
                    return from(this.#merge(hash));
                  })
                );
              })
            );
          }),
          concatAll(),
          tap(() => this.state$.next(EUploadClientState.UploadSuccessfully)),
          take(1)
        )
        .subscribe({
          error: this.#handleError,
        })
    );
  }

  start = once(this.#run);

  restart = (autoUpload?: boolean) => {
    this.progress$.next(0);
    this.state$.next(EUploadClientState.Default);
    this.#run(autoUpload);
  };

  startPool() {
    this.#asyncQueue.resume();
    this.state$.next(EUploadClientState.Uploading);
  }

  stopPool() {
    this.#asyncQueue.pause();
    this.state$.next(EUploadClientState.UploadStopped);
  }

  #merge(hash: string) {
    return this.actions.merge(hash);
  }

  destroy() {
    this.#destroyed = true;
    this.progress$.complete();
    this.error$.complete();
    this.state$.complete();
    this.poolElapse$.complete();
    this.#subscription.unsubscribe();
    this.#asyncQueue.kill();
  }
}
