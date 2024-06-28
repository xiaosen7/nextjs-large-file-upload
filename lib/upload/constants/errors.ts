export const ERRORS = {
  clientHasDestroyed: new Error("UploadClient has been destroyed"),
  hashValidationFailed: new Error("Hash validation failed"),
  noChunksFound: new Error("No chunks found"),
  invalidFirstChunk: new Error("Invalid first chunk"),
  invalidChunkSequence: new Error("Invalid chunk sequence"),
  fileReadFailed: new Error("File read failed"),
  invalidConcurrencyType: new Error("Invalid concurrency type"),
};
