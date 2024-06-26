import { once } from "lodash-es";
import { BehaviorSubject, Subject, Subscription, filter } from "rxjs";
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
}

export class UploadClient {
  static EState = EUploadClientState;

  state$ = new BehaviorSubject<EUploadClientState>(EUploadClientState.Default);
  progress$ = new BehaviorSubject<number>(0);
  error$ = new Subject();

  #pool: PromisePool<Blob, void> | null = null;
  #subscription = new Subscription();

  constructor(private file: File, private actions: IUploadClientActions) {}

  #calcHash = once(async () => {
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

  #createUploadChunksPool(hash: string, chunks: Blob[]) {
    this.#pool = new PromisePool({
      data: chunks,
      concurrency: CONCURRENCY,
      process: async (chunk, index) => {
        const exists = await this.actions.chunkExists(hash, index);
        if (!exists) {
          await this.actions.uploadChunk(
            createFormData({ hash, chunk, index })
          );
        }
      },
    });
  }

  #merge(hash: string) {
    return this.actions.merge(hash);
  }

  async #run(autoUpload = false) {
    // this.#pool?.destroy();
    this.#pool = null;
    this.#subscription.unsubscribe();
    this.#subscription = new Subscription();

    try {
      const { chunks, hash, exists } = await this.#checkExists();
      if (exists) {
        this.state$.next(EUploadClientState.FastUploaded);
        this.progress$.next(100);
        return;
      }

      return new Promise<void>((resolve) => {
        this.#createUploadChunksPool(hash, chunks);
        this.#subscription.add(
          this.#pool!.state$.pipe(
            filter((state) => state === PromisePool.EState.Complete)
          ).subscribe(() => {
            this.state$.next(EUploadClientState.Merging);
            resolve(
              this.#merge(hash)
                .then(() => {
                  this.state$.next(EUploadClientState.UploadSuccessfully);
                })
                .catch(this.#handleError)
            );
          })
        );

        this.#subscription.add(this.#pool!.error$.subscribe(this.#handleError));

        this.#subscription.add(this.#pool!.progress$.subscribe(this.progress$));

        if (autoUpload) {
          this.startPool();
        } else {
          this.state$.next(EUploadClientState.WaitForUpload);
        }
      });
    } catch (error) {
      this.#handleError(error);
    }
  }

  #handleError = (error: unknown) => {
    this.state$.next(EUploadClientState.Error);
    this.error$.next(error);
    this.#pool?.stop();
  };

  #split(chunkSize = CHUNK_SIZE) {
    const chunks: Blob[] = [];
    let cur = 0;
    while (cur < this.file.size) {
      const piece = this.file.slice(cur, cur + chunkSize);
      chunks.push(piece);
      cur += chunkSize;
    }
    return chunks;
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
    if (this.#pool) {
      this.#pool.stop();
      this.state$.next(EUploadClientState.UploadStopped);
    }
  }

  destroy() {
    this.#subscription.unsubscribe();
    this.#pool?.destroy();
  }
}
