import { CHUNKS_DIR, COMBINED_FILE_NAME } from "@/upload/constants";
import { range } from "lodash-es";

import { UploadSlicer } from "@/upload/models/slicer";
import { MemoryStorage } from "@/upload/models/storages/memory";

export function createSlicer() {
  const hash = "123456";
  const storage = new MemoryStorage();
  const slicer = new UploadSlicer(hash, storage);

  return {
    hash,
    storage,
    slicer,
    clear: () => MemoryStorage.clear(),
  };
}

import { MemoryReadableStream as CustomReadableStream } from "@/upload/models/storages/memory";

describe("UploadSlicer", () => {
  let { slicer, hash, storage, clear } = createSlicer();

  beforeEach(() => {
    const helpers = createSlicer();
    slicer = helpers.slicer;
    hash = helpers.hash;
    storage = helpers.storage;
    clear();
  });

  test("getChunkPath", () => {
    expect(slicer.getChunkPath(0)).toBe(
      storage.resolvePaths(hash, CHUNKS_DIR, "0")
    );
  });

  test("getFilePath", () => {
    expect(slicer.getFilePath()).toBe(
      storage.resolvePaths(hash, COMBINED_FILE_NAME)
    );
  });

  test("exists", async () => {
    expect(await slicer.fileExists()).toBeFalsy();
  });

  test("chunkExists", async () => {
    expect(await slicer.chunkExists(0)).toBeFalsy();
  });

  test("writeChunk", async () => {
    const stream = new CustomReadableStream("hello");
    await slicer.writeChunk(0, stream);

    expect(await slicer.chunkExists(0)).toBeTruthy();
  });

  test("getLastExistedChunkIndex", async () => {
    expect(await slicer.getLastExistedChunkIndex()).toBe(-1);

    const chunkCount = 3;
    await Promise.all(
      range(chunkCount).map((index) =>
        slicer.writeChunk(index, new CustomReadableStream(`${index}`))
      )
    );

    expect(await slicer.getLastExistedChunkIndex()).toBe(chunkCount - 1);
  });

  describe("merge", () => {
    test("should create new file", async () => {
      const chunkCount = 100;
      await Promise.all(
        range(chunkCount).map((index) =>
          slicer.writeChunk(index, new CustomReadableStream(`${index}`))
        )
      );

      expect(await slicer.fileExists()).toBeFalsy();

      await slicer.merge();

      expect(await slicer.fileExists()).toBeTruthy();
      expect(await storage.exists(slicer.getFilePath())).toBeTruthy();
    });

    test("should remove chunks", async () => {
      const chunkCount = 1;
      await Promise.all(
        range(chunkCount).map((index) =>
          slicer.writeChunk(0, new CustomReadableStream(`${index}`))
        )
      );

      expect(await storage.exists(slicer.getChunkPath(0))).toBeTruthy();
      await slicer.merge();
      expect(await storage.exists(slicer.getChunkPath(0))).toBeFalsy();
    });
  });
});
