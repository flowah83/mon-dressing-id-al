// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const webgpuStub = fileURLToPath(new URL("./src/lib/onnx-webgpu-stub.ts", import.meta.url));

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // The segmentation model is fetched on demand in the browser. Keep it out of the server bundle.
    resolve: {
      alias: [
        // The package root is the WebGPU build and pulls a ~24 MB WASM into the client.
        // Background removal always asks for the CPU. The model CDN still serves the WASM.
        { find: /^onnxruntime-web$/, replacement: "onnxruntime-web/wasm" },
        { find: "onnxruntime-web/webgpu", replacement: webgpuStub },
      ],
    },
    optimizeDeps: {
      exclude: ["@imgly/background-removal", "onnxruntime-web"],
    },
    ssr: {
      external: ["@imgly/background-removal", "onnxruntime-web"],
    },
    worker: {
      format: "es",
    },
  },
});
