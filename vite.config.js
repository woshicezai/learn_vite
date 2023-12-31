import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  output: {
    manualChunks: function (id) {
      console.log(id);
      if (id.includes("node_modules")) {
        return "vendor";
      }
    },
  },
});
