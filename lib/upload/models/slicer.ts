import { Readable } from "stream";
import { CHUNKS_DIR, COMBINED_FILE_NAME } from "../constants";
import { checkChunks } from "../utils/chunks";
import { pump } from "../utils/pump";
import { UploadStorage } from "./storage";

export class UploadSlicer {
  #rootDir: string;
  #chunksDir: string;
  constructor(private hash: string, private storage: UploadStorage) {
    this.#rootDir = this.storage.resolvePaths(this.hash);
    this.#chunksDir = this.storage.joinPaths(this.#rootDir, CHUNKS_DIR);
  }

  async #getSortedExistedChunkIndices() {
    return (await this.storage.readdir(this.#chunksDir))
      .map((x) => Number(x))
      .sort((a, b) => a - b);
  }

  getChunkPath(index: number) {
    return this.storage.joinPaths(this.#chunksDir, `${index}`);
  }

  getFilePath() {
    return this.storage.joinPaths(this.#rootDir, COMBINED_FILE_NAME);
  }

  async getLastExistedChunkIndex() {
    return (await this.#getSortedExistedChunkIndices()).pop() ?? -1;
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

  async #removeChunksDir() {
    await this.storage.rmdir(this.#chunksDir);
  }

  async merge() {
    const chunkIndices = await this.#getSortedExistedChunkIndices();
    checkChunks(chunkIndices);
    const sourcePaths = chunkIndices.map((basename) =>
      this.storage.joinPaths(this.#chunksDir, String(basename))
    );

    const dest = this.getFilePath();
    await this.storage.merge(sourcePaths, dest);

    await this.#removeChunksDir();
  }
}
