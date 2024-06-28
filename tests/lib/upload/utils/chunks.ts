import { ERRORS } from "@/upload/constants/errors";
import { validateChunkIndices } from "@/upload/utils/chunks";

describe("chunks", () => {
  describe("checkChunks", () => {
    test("should throw if no chunks", () => {
      expect(vi.fn(() => validateChunkIndices([]))).toThrow(
        ERRORS.noChunksFound
      );
    });

    test("should throw if first chunk index is not 0", () => {
      expect(vi.fn(() => validateChunkIndices([1]))).toThrow(
        ERRORS.invalidFirstChunk
      );
    });

    test("should throw if not continuous", () => {
      expect(vi.fn(() => validateChunkIndices([0, 1, 3]))).toThrow(
        ERRORS.invalidChunkSequence
      );
    });

    test("should pass", () => {
      validateChunkIndices([0, 1, 2, 3]);
      validateChunkIndices([0]);
      validateChunkIndices([0, 1]);
    });
  });
});
