import { UploadSlicer } from "@/upload/models/slicer";
import { MemoryStorage } from "@/upload/models/storages/memory";

export function createSlicer() {
  const hash = "123456";
  const storage = new MemoryStorage();
  const slicer = new UploadSlicer(hash, storage);

  return {
    hash,
    storage,
    slicer,
    clear: () => MemoryStorage.clear(),
  };
}

export { MemoryReadableStream as CustomReadableStream } from "@/upload/models/storages/memory";
