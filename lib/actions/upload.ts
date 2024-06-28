import { IWrapServerActions } from "@/shared/types/actions";
import { wrapAction } from "@/shared/utils/wrap-action";
import { IUploadChunkData, IUploadClientActions } from "@/upload/models/client";
import { UploadSlicer } from "@/upload/models/slicer";
import { UploadStorage } from "@/upload/models/storages/base";
import { deconstructFormData } from "@/upload/utils/type";

const globalThis = global as unknown as { storage: UploadStorage };

export const uploadActions = {
  uploadChunk: wrapAction(async (formData: FormData) => {
    "use server";
    const { hash, chunk, index } =
      deconstructFormData<IUploadChunkData>(formData);
    const slicer = new UploadSlicer(hash, globalThis.storage);

    const stream = (chunk as File).stream() as any;
    await slicer.writeChunk(index, stream);
  }),
  fileExists: wrapAction(async (hash: string) => {
    "use server";
    const slicer = new UploadSlicer(hash, globalThis.storage);
    return await slicer.fileExists();
  }),
  chunkExists: wrapAction(async (hash: string, index: number) => {
    "use server";
    const slicer = new UploadSlicer(hash, globalThis.storage);
    return await slicer.chunkExists(index);
  }),
  merge: wrapAction(async (hash: string) => {
    "use server";
    const slicer = new UploadSlicer(hash, globalThis.storage);
    await slicer.merge();
  }),
  getLastExistedChunkIndex: wrapAction(async (hash) => {
    "use server";
    const slicer = new UploadSlicer(hash, globalThis.storage);
    return slicer.getLastExistedChunkIndex();
  }),
  // @ts-ignore
} as const satisfies IWrapServerActions<IUploadClientActions>;
