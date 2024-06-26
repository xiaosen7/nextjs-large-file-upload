import { UploadStorage } from "@/upload/models/storage";
import { get, set } from "lodash-es";
import path, { isAbsolute } from "path";
import { Readable, Writable } from "stream";

const data = {};

const splitPath = (path: string) => {
  return path.split("/").filter(Boolean);
};

class MemoryWritableStream extends Writable {
  constructor(private path: string) {
    super();
  }

  _write(chunk: Buffer, encoding: string, callback: () => void) {
    const paths = splitPath(this.path);
    set(data, paths, "1");
    callback();
  }
}

export class MemoryReadableStream extends Readable {
  #current: number;
  constructor(private data: string) {
    super();
    this.#current = 0;
  }

  _read(size: number) {
    if (this.#current === 0) {
      this.push(this.data);
      this.#current += 1;
      return;
    }

    this.push(null);
  }
}

/**
 * Memory storage for testing or Vercel deployment
 */
export class MemoryStorage extends UploadStorage {
  private root: string;

  constructor() {
    super();
    this.root = "/";
  }

  async exists(path: string): Promise<boolean> {
    return !!get(data, splitPath(path));
  }

  joinPaths(...paths: string[]): string {
    return path.join(...paths);
  }

  resolvePaths(...paths: string[]): string {
    if (isAbsolute(paths[0])) {
      return this.joinPaths(...paths);
    }

    return path.join(this.root, ...paths);
  }

  async createWriteStream(path: string) {
    if (!(await this.exists(path))) {
      set(data, splitPath(path), "");
    }
    return new MemoryWritableStream(path);
  }

  async readdir(path: string) {
    return Object.keys(get(data, splitPath(path), {}));
  }

  async rmdir(path: string): Promise<void> {
    set(data, splitPath(path), {});
  }

  async createReadStream(path: string): Promise<Readable> {
    return new MemoryReadableStream(get(data, splitPath(path)));
  }
}
