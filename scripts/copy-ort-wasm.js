import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const runtimeDirectory = join(projectRoot, "node_modules", "onnxruntime-web", "dist");
const publicRuntimeDirectory = join(projectRoot, "public", "ort-wasm");
const runtimeFiles = [
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
];

mkdirSync(publicRuntimeDirectory, { recursive: true });

for (const fileName of runtimeFiles) {
  copyFileSync(join(runtimeDirectory, fileName), join(publicRuntimeDirectory, fileName));
}

console.log(`Copied ${runtimeFiles.length} ONNX Runtime WebAssembly assets to public/ort-wasm/.`);
