import { Readable } from "stream";
import { CHUNKS_DIR, COMBINED_FILE_NAME } from "../constants";
import { pump } from "../utils/pump";
import { UploadStorage } from "./storage";

export class UploadSlicer {
  #rootDir: string;
  #chunksDir: string;
  constructor(private hash: string, private storage: UploadStorage) {
    this.#rootDir = this.storage.resolvePaths(this.hash);
    this.#chunksDir = this.storage.joinPaths(this.#rootDir, CHUNKS_DIR);
  }

  getChunkPath(index: number) {
    return this.storage.joinPaths(this.#chunksDir, `${index}`);
  }

  getFilePath() {
    return this.storage.joinPaths(this.#rootDir, COMBINED_FILE_NAME);
  }

  async fileExists() {
    return this.storage.exists(this.getFilePath());
  }

  async chunkExists(index: number) {
    return this.storage.exists(this.getChunkPath(index));
  }

  async writeChunk(index: number, stream: Readable) {
    await pump(
      stream,
      await this.storage.createWriteStream(this.getChunkPath(index))
    );
  }

  async #rmRoot() {
    await this.storage.rmdir(this.#rootDir);
  }

  async merge() {
    const chunkIndices = (await this.storage.readdir(this.#chunksDir))
      .map((x) => Number(x))
      .sort((a, b) => a - b);

    const totalChunks = chunkIndices.length;
    if (totalChunks < 1) {
      await this.#rmRoot();
      throw new Error("no chunks found");
    }

    if (chunkIndices[0] !== 0) {
      await this.#rmRoot();
      throw new Error("chunk sequence is not correct");
    }

    // check the sequence is correct
    for (let i = 0; i < totalChunks - 1; i++) {
      if (chunkIndices[i] + 1 !== chunkIndices[i + 1]) {
        await this.#rmRoot();
        throw new Error("chunk sequence is not correct");
      }
    }

    const sourcePaths = chunkIndices.map((basename) =>
      this.storage.joinPaths(this.#chunksDir, String(basename))
    );

    const dest = this.getFilePath();
    return this.storage.merge(sourcePaths, dest);
  }
}
