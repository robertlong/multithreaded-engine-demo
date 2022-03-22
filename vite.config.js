import { defineConfig } from "vite";
import crossOriginIsolation from "vite-plugin-cross-origin-isolation";
import worker, {bundleHelper} from "vite-plugin-worker";

export default defineConfig({
  plugins: [
    crossOriginIsolation(),
    bundleHelper(),
    worker()
  ],
});
