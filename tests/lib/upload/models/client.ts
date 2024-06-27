import {
  EUploadClientState,
  IUploadClientActions,
  UploadClient,
} from "@/upload/models/client";
import { filter } from "rxjs";

vi.mock("@/upload/utils/workers", () => {
  return {
    calculateChunksHashByWorker(
      chunks: Blob[],
      onProgress?: (percentage: number) => void
    ): Promise<string> {
      return Promise.resolve("hash");
    },
  };
});

describe("UploadClient", () => {
  const createClient = (partialActions: Partial<IUploadClientActions>) => {
    const file = new File(["hello world"], "test.name");
    const actions: IUploadClientActions = {
      async chunkExists(hash, index) {
        return false;
      },
      async uploadChunk(formData) {
        return;
      },
      async fileExists() {
        return false;
      },
      async merge(hash) {
        return;
      },
      async getLastExistedChunkIndex() {
        return -1;
      },
      ...partialActions,
    };
    return new UploadClient(file, actions);
  };

  const doTest = async ({
    partialActions,
    autoUpload,
    expectedStateSequence,
    onStuck,
    expectedError,
  }: {
    partialActions: Partial<IUploadClientActions>;
    autoUpload: boolean;
    expectedStateSequence: EUploadClientState[];
    onStuck?: (
      client: UploadClient,
      expectStateSequence: (expectedStateSequence: EUploadClientState[]) => void
    ) => Promise<void>;
    expectedError?: unknown;
  }) => {
    const client = createClient(partialActions);

    const stateObserver = vi.fn((state): void => {
      console.log(EUploadClientState[state]);
    });

    client.state$.subscribe(stateObserver);

    const progressObserver = vi.fn();
    client.progress$.subscribe(progressObserver);

    const errorObserver = vi.fn();
    client.error$.subscribe(errorObserver);

    await new Promise((resolve) => {
      if (autoUpload) {
        client.start(true);
      } else {
        client.start(false);
        client.state$
          .pipe(filter((state) => state === UploadClient.EState.WaitForUpload))
          .subscribe(resolve);
      }
    });

    const expectNextStateSequence = (
      expectedStateSequence: EUploadClientState[]
    ) => {
      fullStateSequence.push(...expectedStateSequence);
    };

    const fullStateSequence = expectedStateSequence.slice();
    await onStuck?.(client, expectNextStateSequence);

    expect(stateObserver).toHaveBeenCalledTimes(fullStateSequence.length);
    fullStateSequence.forEach((state, index) => {
      expect(stateObserver).toHaveBeenNthCalledWith(index + 1, state);
    });

    if (expectedError) {
      expect(errorObserver).toHaveBeenCalledWith(expectedError);
    } else {
      expect(progressObserver).toHaveBeenLastCalledWith(100);
    }

    return client;
  };
  test("upload normally", async () => {
    await doTest({
      partialActions: { fileExists: async () => false },
      autoUpload: true,
      expectedStateSequence: [
        UploadClient.EState.Default,
        UploadClient.EState.CalculatingHash,
        UploadClient.EState.CheckingFileExists,
        UploadClient.EState.Uploading,
        UploadClient.EState.Merging,
        UploadClient.EState.UploadSuccessfully,
      ],
    });
  });

  test("fast upload", async () => {
    const client = await doTest({
      partialActions: { fileExists: async () => true },
      autoUpload: true,
      expectedStateSequence: [
        UploadClient.EState.Default,
        UploadClient.EState.CalculatingHash,
        UploadClient.EState.CheckingFileExists,
        UploadClient.EState.FastUploaded,
      ],
    });

    client.startPool();
  });

  test("upload manually", async () => {
    await doTest({
      partialActions: { fileExists: async () => false },
      autoUpload: false,
      expectedStateSequence: [
        UploadClient.EState.Default,
        UploadClient.EState.CalculatingHash,
        UploadClient.EState.CheckingFileExists,
        UploadClient.EState.WaitForUpload,
      ],
      onStuck: async (client, expectNextStateSequence) => {
        client.startPool();
        client.stopPool();
        client.startPool();
        expectNextStateSequence([
          UploadClient.EState.Uploading,
          UploadClient.EState.UploadStopped,
          UploadClient.EState.Uploading,
          UploadClient.EState.Merging,
          UploadClient.EState.UploadSuccessfully,
        ]);
        await client.start();
      },
    });
  });

  test("error", async () => {
    const error = new Error("error");
    await doTest({
      partialActions: {
        fileExists: async () => {
          throw error;
        },
      },
      autoUpload: true,
      expectedStateSequence: [
        UploadClient.EState.Default,
        UploadClient.EState.CalculatingHash,
        UploadClient.EState.CheckingFileExists,
        UploadClient.EState.Error,
      ],
      expectedError: error,
    });
  });

  // test("destroy", async () => {
  //   const client = createClient({});
  //   client.destroy();
  //   expect(vi.fn(() => client.start())).rejects.toBeInstanceOf(Error);
  // });
});
