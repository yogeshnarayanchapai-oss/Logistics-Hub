import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", router);

// Serve system documentation page
const __dirnameApp = path.dirname(fileURLToPath(import.meta.url));
const docsFilePaths = [
  path.resolve(__dirnameApp, "../../../artifacts/logistics/public/system-docs.html"),
  path.resolve(__dirnameApp, "../../../artifacts/logistics/dist/public/system-docs.html"),
];
const docsFilePath = docsFilePaths.find(p => existsSync(p));
if (docsFilePath) {
  app.get("/docs", (_req, res) => res.sendFile(docsFilePath));
  app.get("/system-docs.html", (_req, res) => res.sendFile(docsFilePath));
}

// Serve the built frontend if available (production deployment)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Compiled file lives at artifacts/api-server/dist/ — 3 levels up = workspace root
const staticDir = path.resolve(__dirname, "../../../artifacts/logistics/dist/public");
logger.info({ staticDir, exists: existsSync(staticDir), NODE_ENV: process.env.NODE_ENV }, "Static files check");
if (existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
} else {
  logger.warn({ staticDir }, "Frontend dist not found — skipping static file serving");
}

export default app;
