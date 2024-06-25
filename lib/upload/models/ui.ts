import { once } from "lodash-es";
import { BehaviorSubject, Subject, filter } from "rxjs";
import { IFilePiece } from "../types";
import { PromisePool } from "../utils/promise-pool";
import { IUploadClientApi, UploadClient } from "./client";

enum EUploadUIState {
  Default,
  CalculatingHash,
  CheckingFileExists,
  FastUploaded,
  WaitForUpload,
  Uploading,
  UploadStopped,
  Merging,
  UploadSuccessfully,
}

export class UploadUI {
  static EState = EUploadUIState;

  state$ = new BehaviorSubject<EUploadUIState>(EUploadUIState.Default);
  progress$ = new Subject<number>();
  #uploadClient: UploadClient;
  #pool?: PromisePool<IFilePiece, void>;

  constructor(private file: File, private api: IUploadClientApi) {
    this.#uploadClient = new UploadClient(this.file, this.api);
  }

  start = once(async () => {
    const { chunks, hash, isFileExists } = await this.#checkExists();

    if (isFileExists) {
      this.state$.next(EUploadUIState.FastUploaded);
      return;
    }

    return new Promise((resolve) => {
      const pool = this.#createPool(hash, chunks);
      pool.state$
        .pipe(filter((state) => state === PromisePool.EState.Complete))
        .subscribe(() => {
          this.state$.next(EUploadUIState.Merging);
          resolve(
            this.#merge(hash).then(() => {
              this.state$.next(EUploadUIState.UploadSuccessfully);
            })
          );
        });

      pool.progress$.subscribe(this.progress$);

      this.#pool = pool;
      this.state$.next(EUploadUIState.WaitForUpload);
    });
  });

  startPool() {
    this.#pool?.start();
    this.state$.next(EUploadUIState.Uploading);
  }

  stopPool() {
    this.state$.next(EUploadUIState.UploadStopped);
    this.#pool?.stop();
  }

  async #checkExists() {
    const chunks = await this.#uploadClient.split();
    this.state$.next(EUploadUIState.CalculatingHash);
    const hash = await this.#uploadClient.calHash({
      chunks,
      onTick: (progress) => {
        this.progress$.next(progress);
      },
    });

    this.state$.next(EUploadUIState.CheckingFileExists);

    return {
      isFileExists: await this.api.exists(hash),
      hash,
      chunks,
    };
  }

  #createPool(hash: string, chunks: IFilePiece[]) {
    return this.#uploadClient.uploadChunks({
      hash,
      pieces: chunks,
    });
  }

  #merge(hash: string) {
    return this.#uploadClient.merge(hash);
  }
}
