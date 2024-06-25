import type * as fs from "fs/promises";
import type * as path from "path";
import { isValidString } from "../utils/base";

export abstract class Storage {
  abstract isFileExists(filename: string): Promise<boolean>;
  abstract isDirExists(dir: string): Promise<boolean>;

  abstract readFile(filename: string): Promise<Buffer>;
  abstract writeFile(filename: string, content: Buffer): Promise<void>;
  abstract ensureDir(dir: string): Promise<void>;
  // 浅度遍历某个目录下的文件列表
  abstract ls(dir: string): Promise<string[]>;

  async combind(files: string[], saveAs: string) {
    // 这里应该改成 stream api，防止文件过大导致 node crash
    if (files?.some((r) => !isValidString(r)) || !isValidString(saveAs)) {
      throw new Error(`Invalid file paths`);
    }

    const contents = await Promise.all(
      files.map(async (r) => {
        if ((await this.isFileExists(r)) !== true) {
          throw new Error(`file ${r} not exists`);
        }
        return this.readFile(r);
      })
    );
    const combindedContent = Buffer.concat(contents);
    await this.writeFile(saveAs, combindedContent);
  }
}

type IFS = typeof fs;
type IPath = typeof path;

export class FilesystemStorage extends Storage {
  constructor(private fs: IFS, private path: IPath) {
    super();
  }

  async isFileExists(filename: string) {
    try {
      const fStat = await this.fs.stat(filename);
      return fStat.isFile();
    } catch (e) {
      return false;
    }
  }

  async isDirExists(filename: string) {
    try {
      const fStat = await this.fs.stat(filename);
      return fStat.isDirectory();
    } catch (e) {
      return false;
    }
  }

  async ls(dir: string) {
    if (await this.isDirExists(dir)) {
      const res = await this.fs.readdir(dir);
      return res.map((r) => this.path.resolve(dir, r));
    }
    throw new Error(`Dir ${dir} not exists`);
  }

  readFile(filename: string) {
    return this.fs.readFile(filename);
  }

  async writeFile(filename: string, content: Buffer) {
    await this.fs.writeFile(filename, content);
  }

  async ensureDir(dir: string) {
    await this.fs.mkdir(dir, { recursive: true });
  }
}
