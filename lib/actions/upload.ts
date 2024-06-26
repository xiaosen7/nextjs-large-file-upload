import { IUploadChunkData, IUploadClientActions } from "@/upload/models/client";
import { UploadSlicer } from "@/upload/models/slicer";
import { UploadStorage } from "@/upload/models/storage";
import { deconstructFormData } from "@/upload/utils/type";

const globalThis = global as unknown as { storage: UploadStorage };

export const uploadActions: IUploadClientActions = {
  uploadChunk: async (formData: FormData) => {
    "use server";
    const { hash, chunk, index } =
      deconstructFormData<IUploadChunkData>(formData);
    const slicer = new UploadSlicer(hash, globalThis.storage);

    const stream = (chunk as File).stream() as any;
    await slicer.writeChunk(index, stream);
  },
  exists: async (hash: string) => {
    "use server";
    const slicer = new UploadSlicer(hash, globalThis.storage);
    return await slicer.exists();
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
};
