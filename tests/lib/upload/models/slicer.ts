import { CHUNKS_DIR, COMBINED_FILE_NAME } from "@/upload/constants";
import { range } from "lodash-es";
import { CustomReadableStream, createSlicer } from "./test-utils";

describe("UploadSlicer", () => {
  let { slicer, hash, storage } = createSlicer();

  beforeEach(() => {
    const helpers = createSlicer();
    slicer = helpers.slicer;
    hash = helpers.hash;
    storage = helpers.storage;
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

  test("merge", async () => {
    const chunkCount = 100;
    await Promise.all(
      range(chunkCount).map((index) =>
        slicer.writeChunk(0, new CustomReadableStream(`${index}`))
      )
    );

    expect(await slicer.fileExists()).toBeFalsy();

    await slicer.merge();

    expect(await slicer.fileExists()).toBeTruthy();
    expect(await storage.exists(slicer.getFilePath())).toBeTruthy();
  });
});
