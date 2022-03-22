import { defineConfig } from "vite";
import crossOriginIsolation from "vite-plugin-cross-origin-isolation";
import worker, {pluginHelper} from "vite-plugin-worker";

export default defineConfig({
  plugins: [
    crossOriginIsolation(),
    pluginHelper(),
    worker({})
  ],
});
