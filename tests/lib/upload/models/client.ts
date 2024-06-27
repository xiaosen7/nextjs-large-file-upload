import {
  EUploadClientState,
  IUploadClientActions,
  UploadClient,
} from "@/upload/models/client";
import { filter, firstValueFrom } from "rxjs";

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

function createClientTestUtils(
  partialActions: Partial<IUploadClientActions> = {}
) {
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
  const client = new UploadClient(file, actions);

  const stateObserver = vi.fn();
  client.state$.subscribe(stateObserver);

  const errorObserver = vi.fn();
  client.error$.subscribe(errorObserver);

  return {
    client,
    waitState: async (targetState: EUploadClientState) => {
      await firstValueFrom(
        client.state$.pipe(filter((state) => state === targetState))
      );
    },
    expectStateSequence: (expectedStateSequence: EUploadClientState[]) => {
      expect(stateObserver).toHaveBeenCalledTimes(expectedStateSequence.length);
      expectedStateSequence.forEach((state, index) => {
        expect(stateObserver).toHaveBeenNthCalledWith(index + 1, state);
      });
    },
    expectError: (expectedError: Error) => {
      expect(errorObserver).toHaveBeenCalledWith(expectedError);
    },
    expectProgress: (expectedProgress: number) => {
      expect(client.progress$.value).toBe(expectedProgress);
    },
  };
}

describe("UploadClient", () => {
  test("normal upload", async () => {
    const { client, expectStateSequence, waitState } = createClientTestUtils();

    client.start();
    await waitState(UploadClient.EState.WaitForUpload);
    client.startPool();
    await waitState(UploadClient.EState.UploadSuccessfully);

    const expectedStateSequence = [
      UploadClient.EState.Default,
      UploadClient.EState.CalculatingHash,
      UploadClient.EState.CheckingFileExists,
      UploadClient.EState.WaitForUpload,
      UploadClient.EState.Uploading,
      UploadClient.EState.Merging,
      UploadClient.EState.UploadSuccessfully,
    ];
    expectStateSequence(expectedStateSequence);
  });

  test("auto upload", async () => {
    const { client, waitState, expectStateSequence } = createClientTestUtils();

    const autoUpload = true;
    client.start(autoUpload);
    await waitState(UploadClient.EState.UploadSuccessfully);
    expectStateSequence([
      UploadClient.EState.Default,
      UploadClient.EState.CalculatingHash,
      UploadClient.EState.CheckingFileExists,
      UploadClient.EState.Uploading,
      UploadClient.EState.Merging,
      UploadClient.EState.UploadSuccessfully,
    ]);
  });

  test("fast upload", async () => {
    const { client, waitState, expectStateSequence } = createClientTestUtils({
      fileExists: async () => true,
    });

    client.start();
    await waitState(UploadClient.EState.FastUploaded);
    expectStateSequence([
      UploadClient.EState.Default,
      UploadClient.EState.CalculatingHash,
      UploadClient.EState.CheckingFileExists,
      UploadClient.EState.FastUploaded,
    ]);
  });

  test("error", async () => {
    const expectedError = new Error("error");
    const { client, waitState, expectError } = createClientTestUtils({
      fileExists: async () => {
        throw expectedError;
      },
    });

    client.start();
    await waitState(UploadClient.EState.Error);
    expectError(expectedError);
  });

  describe("progress", () => {
    test("normal upload", async () => {
      const { client, waitState, expectProgress } = createClientTestUtils();
      expectProgress(0);

      client.start();

      await waitState(UploadClient.EState.CheckingFileExists);
      expectProgress(0);

      await waitState(UploadClient.EState.WaitForUpload);
      expectProgress(0);

      client.startPool();

      await waitState(UploadClient.EState.Merging);
      expectProgress(100);

      await waitState(UploadClient.EState.UploadSuccessfully);
      expectProgress(100);
    });

    test("fast uploaded", async () => {
      const { client, waitState, expectProgress } = createClientTestUtils({
        fileExists: async () => true,
      });

      expectProgress(0);

      client.start();

      await waitState(UploadClient.EState.CheckingFileExists);
      expectProgress(0);

      await waitState(UploadClient.EState.FastUploaded);
      expectProgress(100);
    });
  });

  test("destroy", async () => {
    const { client, waitState } = createClientTestUtils({});

    client.start(true);
    await waitState(UploadClient.EState.Uploading);

    const completeFn = vi.fn();

    client.state$.subscribe({
      complete: completeFn,
    });
    client.progress$.subscribe({
      complete: completeFn,
    });
    client.error$.subscribe({
      complete: completeFn,
    });
    client.destroy();

    expect(completeFn).toHaveBeenCalledTimes(3);
  });
});
