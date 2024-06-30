import { ERRORS } from "@/shared/constants/errors";
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
  map,
  switchMap,
  take,
  tap,
} from "rxjs";
import { DEFAULTS } from "../constants/defaults";
import { PromisePool } from "../utils/promise-pool";
import { createFormData } from "../utils/type";
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
  chunk: Blob;
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

  #pool: PromisePool | null = null;
  #subscription = new Subscription();
  #destroyed = false;

  constructor(
    public readonly file: File,
    private actions: IUploadClientActions,
    private concurrency = DEFAULTS.concurrency,
    private chunkSize = DEFAULTS.chunkSize
  ) {}

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

  async #createPool(hash: string, chunks: Blob[]) {
    this.#pool?.destroy();

    const lastExistedChunkIndex = await this.actions.getLastExistedChunkIndex(
      hash
    );

    this.#pool = new PromisePool({
      concurrency: this.concurrency,
    });

    chunks.forEach((chunk, index) => {
      this.#pool!.append(async () => {
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
      this.#pool!.error$.subscribe(({ error }) => this.#handleError(error))
    );
    this.#subscription.add(
      this.#pool!.progress$.subscribe((v) => this.progress$.next(v))
    );
  }

  #handleError = (error: unknown) => {
    console.log(error);
    this.state$.next(EUploadClientState.Error);
    this.error$.next(error);
    this.#pool?.stop();
  };

  #run(autoUpload = false) {
    if (this.#destroyed) {
      this.#handleError(ERRORS.upload.clientHasDestroyed);
    }

    this.#subscription.unsubscribe();
    this.#pool?.destroy();
    this.#pool = null;
    this.#subscription = new Subscription();

    this.#subscription.add(
      from(this.#checkExists())
        .pipe(
          switchMap(({ chunks, exists, hash }) => {
            if (exists) {
              // Directly set the state
              this.state$.next(EUploadClientState.FastUploaded);
              this.progress$.next(100);
              return EMPTY;
            } else {
              // Transition to createPool using switchMap
              return from(this.#createPool(hash, chunks)).pipe(
                tap(() => {
                  if (autoUpload) {
                    this.startPool();
                  } else {
                    this.state$.next(EUploadClientState.WaitForUpload);
                  }
                }),
                concatMap(() =>
                  this.#pool!.finishAll$.pipe(
                    map(() => {
                      this.state$.next(EUploadClientState.Merging);
                      return from(this.#merge(hash));
                    })
                  )
                ),
                concatAll()
              );
            }
          }),
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
    if (this.#pool) {
      this.#pool.start();
      this.state$.next(EUploadClientState.Uploading);
    }
  }

  stopPool() {
    if (this.#pool) {
      this.#pool.stop();
      this.state$.next(EUploadClientState.UploadStopped);
    }
  }

  #merge(hash: string) {
    return this.actions.merge(hash);
  }

  destroy() {
    this.progress$.complete();
    this.error$.complete();
    this.state$.complete();
    this.#destroyed = true;
    this.#subscription.unsubscribe();
    this.#pool?.destroy();
  }
}
