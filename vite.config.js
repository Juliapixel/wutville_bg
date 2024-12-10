import { resolve } from "path";
import topLevelAwait from "vite-plugin-top-level-await";

/** @type {import("vite").UserConfig;} */
export default {
    resolve: {
        conditions: ["import"]
    },
    plugins: [
        topLevelAwait({
            // The export name of top-level await promise for each chunk module
            promiseExportName: "__tla",
            // The function to generate import names of top-level await promise in each chunk module
            promiseImportName: (i) => `__tla_${i}`
        })
    ],
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, "index.html")
            }
        }
    },
    appType: "mpa"
};
