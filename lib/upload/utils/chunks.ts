export function checkChunks(chunkIndices: number[]) {
  const totalChunks = chunkIndices.length;
  if (totalChunks < 1) {
    throw new Error("no chunks found");
  }

  if (chunkIndices[0] !== 0) {
    throw new Error("first chunk index should be 0");
  }

  // check the sequence is correct
  for (let i = 0; i < totalChunks - 1; i++) {
    if (chunkIndices[i] + 1 !== chunkIndices[i + 1]) {
      throw new Error("chunk sequence is not correct");
    }
  }

  return chunkIndices;
}
