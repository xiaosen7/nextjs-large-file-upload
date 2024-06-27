import { once } from "lodash-es";
import {
  BehaviorSubject,
  NEVER,
  Subject,
  Subscription,
  concatMap,
  filter,
  from,
  map,
  switchMap,
  take,
  tap,
} from "rxjs";
import { CHUNK_SIZE, CONCURRENCY } from "../constants";
import { PromisePool } from "../utils/promise-pool";
import { createFormData } from "../utils/type";
import { calculateChunksHashByWorker } from "../utils/workers";

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

  #pool: PromisePool<Blob, void> | null = null;
  #subscription = new Subscription();
  #destroyed = false;

  constructor(
    public readonly file: File,
    private actions: IUploadClientActions,
    private concurrency = CONCURRENCY,
    private chunkSize = CHUNK_SIZE
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

  #calcHash = async () => {
    const chunks = this.#split();
    this.state$.next(EUploadClientState.CalculatingHash);
    const hash = await calculateChunksHashByWorker(chunks, (progress) => {
      this.progress$.next(progress);
    });

    return {
      hash,
      chunks,
    };
  };

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
      data: chunks,
      concurrency: this.concurrency,
      process: async (chunk, index) => {
        if (lastExistedChunkIndex >= index) {
          return;
        }

        const exists = await this.actions.chunkExists(hash, index);
        if (!exists) {
          await this.actions.uploadChunk(
            createFormData({ hash, chunk, index })
          );
        }
      },
    });

    this.#subscription.add(this.#pool!.error$.subscribe(this.#handleError));
    this.#subscription.add(this.#pool!.progress$.subscribe(this.progress$));
  }

  #handleError = (error: unknown) => {
    this.state$.next(EUploadClientState.Error);
    this.error$.next(error);
    this.#pool?.stop();
  };

  #run(autoUpload = false) {
    if (this.#destroyed) {
      this.#handleError(new Error("UploadClient has been destroyed"));
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
              return NEVER; // Return a completed observable to end the chain
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
                  this.#pool!.state$.pipe(
                    filter((state) => state === PromisePool.EState.Complete),
                    map(() => {
                      this.state$.next(EUploadClientState.Merging);
                      return from(this.#merge(hash));
                    })
                  )
                )
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

  restart = this.#run;

  startPool() {
    if (this.#pool) {
      this.#pool.start();
      this.state$.next(EUploadClientState.Uploading);
    }
  }

  stopPool() {
    // TODO fix
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
