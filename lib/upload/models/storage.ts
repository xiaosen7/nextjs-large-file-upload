import { exists } from "fs";
import MultiStream from "multistream";
import { Readable, Writable } from "stream";
import { promisify } from "util";

const existsAsync = promisify(exists);

export abstract class UploadStorage {
  abstract exists(path: string): Promise<boolean>;
  abstract joinPaths(...paths: string[]): string;
  abstract resolvePaths(...paths: string[]): string;
  abstract createWriteStream(path: string): Promise<Writable>;
  abstract createReadStream(path: string): Promise<Readable>;
  abstract readdir(path: string): Promise<string[]>;

  async merge(sourceFilePaths: string[], destFilePath: string): Promise<void> {
    const output = await this.createWriteStream(destFilePath);
    const inputList = await Promise.all(
      sourceFilePaths.map((path) => {
        return this.createReadStream(path);
      })
    );
    return new Promise((resolve, reject) => {
      const input = new MultiStream(inputList);
      input.pipe(output);
      input.on("end", () => {
        output.end();
        resolve();
      });
      input.on("error", () => {
        output.end();
        reject();
      });
    });
  }
}
