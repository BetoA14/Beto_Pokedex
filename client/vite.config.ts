import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Read the same optional root .env PORT as Express, so a port change needs one edit.
  const rootDirectory = fileURLToPath(new URL("../", import.meta.url));
  // Empty prefix reads server settings here; only VITE_-prefixed user variables reach the browser.
  const env = loadEnv(mode, rootDirectory, "");
  const port = env.PORT || "3001";
  const clientPort = Number(env.CLIENT_PORT || 5173);
  if (!Number.isInteger(clientPort) || clientPort < 1 || clientPort > 65535) {
    throw new Error("CLIENT_PORT must be an integer between 1 and 65535");
  }

  return {
    // Enable JSX compilation and React Fast Refresh during development.
    plugins: [react()],
    envDir: rootDirectory,
    server: {
      port: clientPort,
      // Keep the browser origin stable so its local-storage UUID does not change silently.
      strictPort: true,
      proxy: {
        // Keep /api in the forwarded path; Express owns routes with that same prefix.
        "/api": `http://127.0.0.1:${port}`,
      },
    },
  };
});
