import { IUploaderProps } from "@/upload/components/upload";
import { IUploadChunkData } from "@/upload/models/client";
import { FileSlicer } from "@/upload/models/slicer";
import { FilesystemStorage } from "@/upload/models/storage";
import { deconstructFormData } from "@/upload/utils/base";
import * as fs from "fs/promises";
import path from "path";

function createFileSlicer(hash: string) {
  return new FileSlicer({
    hash,
    storage: new FilesystemStorage(fs, path),
    storageRoot: path.resolve("node_modules", ".cache"),
  });
}

export const uploadActions: IUploaderProps["actions"] = {
  uploadChunk: async (formData: FormData) => {
    "use server";
    const { hash, chunk, index } =
      deconstructFormData<IUploadChunkData>(formData);
    const slicer = createFileSlicer(hash);
    await slicer.writePiece(
      Buffer.from(await (chunk as File).arrayBuffer()),
      index
    );
  },
  exists: async (hash: string) => {
    "use server";
    const slicer = createFileSlicer(hash);
    return await slicer.exists();
  },
  chunkExists: async (hash: string, index: number) => {
    "use server";
    const slicer = createFileSlicer(hash);
    return await slicer.chunkExists(index);
  },
  mergeFile: async (hash: string) => {
    "use server";
    const slicer = createFileSlicer(hash);
    await slicer.merge();
  },
};
