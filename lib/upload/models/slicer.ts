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

  async exists() {
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

  async merge() {
    const sourcePaths = (await this.storage.readdir(this.#chunksDir))
      .sort((a, b) => Number(a) - Number(b))
      .map((basename) => this.storage.joinPaths(this.#chunksDir, basename));

    console.log({ sourcePaths });
    const dest = this.getFilePath();
    return this.storage.merge(sourcePaths, dest);
  }
}
