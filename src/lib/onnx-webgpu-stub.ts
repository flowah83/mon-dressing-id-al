/**
 * Vestiaire always runs background removal on the CPU.
 * The WebGPU build of onnxruntime ships a ~24 MB WASM file that this app never loads
 * (the CPU runtime fetches its own WASM from the model CDN). This stub keeps that
 * file out of the client build. If the GPU path is ever taken, removal falls back
 * to the original photo.
 */
const ort = {
  env: { wasm: {} as Record<string, unknown> },
  Tensor: class Tensor {},
  InferenceSession: {
    async create(): Promise<never> {
      throw new Error("WebGPU n'est pas utilisé pour le détourage.");
    },
  },
};

export default ort;
