import { IUploadChunkData, IUploadClientActions } from "@/upload/models/client";
import { UploadSlicer } from "@/upload/models/slicer";
import { UploadStorage } from "@/upload/models/storage";
import { deconstructFormData } from "@/upload/utils/type";
import { filesize } from "filesize";

const globalThis = global as unknown as { storage: UploadStorage };

export const uploadActions: IUploadClientActions = {
  uploadChunk: async (formData: FormData) => {
    "use server";
    const { hash, chunk, index } =
      deconstructFormData<IUploadChunkData>(formData);
    const slicer = new UploadSlicer(hash, globalThis.storage);

    const chunkSize = filesize(chunk.size, { standard: "jedec" });
    console.log("index", index);
    console.log("chunk size", chunkSize);

    const stream = (chunk as File).stream() as any;
    await slicer.writeChunk(index, stream);
  },
  fileExists: async (hash: string) => {
    "use server";
    const slicer = new UploadSlicer(hash, globalThis.storage);
    return await slicer.fileExists();
  },
  chunkExists: async (hash: string, index: number) => {
    "use server";
    const slicer = new UploadSlicer(hash, globalThis.storage);
    return await slicer.chunkExists(index);
  },
  merge: async (hash: string) => {
    "use server";
    const slicer = new UploadSlicer(hash, globalThis.storage);
    await slicer.merge();
  },
  getLastExistedChunkIndex: async (hash) => {
    "use server";
    const slicer = new UploadSlicer(hash, globalThis.storage);
    return slicer.getLastExistedChunkIndex();
  },
};
