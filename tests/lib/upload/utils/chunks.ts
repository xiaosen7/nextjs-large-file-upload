import { checkChunks } from "@/upload/utils/chunks";

describe("chunks", () => {
  describe("checkChunks", () => {
    test("should throw if no chunks", () => {
      expect(vi.fn(() => checkChunks([]))).toThrow("no chunks found");
    });

    test("should throw if first chunk index is not 0", () => {
      expect(vi.fn(() => checkChunks([1]))).toThrow(
        "first chunk index should be 0"
      );
    });

    test("should throw if not continuous", () => {
      expect(vi.fn(() => checkChunks([0, 1, 3]))).toThrow(
        "chunk sequence is not correct"
      );
    });

    test("should pass", () => {
      checkChunks([0, 1, 2, 3]);
      checkChunks([0]);
      checkChunks([0, 1]);
    });
  });
});
