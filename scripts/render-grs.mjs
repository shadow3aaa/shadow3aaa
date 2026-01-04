import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const upstreamDir = process.env.GRS_DIR
  ? path.resolve(repoRoot, process.env.GRS_DIR)
  : path.resolve(repoRoot, "_grs");

const outDir = process.env.OUT_DIR
  ? path.resolve(repoRoot, process.env.OUT_DIR)
  : path.resolve(repoRoot, "assets");

const username = process.env.GRS_USERNAME || "shadow3aaa";
const theme = process.env.GRS_THEME || "radical";
const langsLayout = process.env.GRS_LANGS_LAYOUT || "donut";

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const handlerToSvg = async (handler, query) => {
  let body;
  const req = { query };
  const res = {
    setHeader() {},
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      body = payload;
      return payload;
    },
    end(payload) {
      body = payload;
      return payload;
    },
  };

  await handler(req, res);

  if (typeof body !== "string") {
    throw new Error(
      `Expected SVG string from handler, got: ${typeof body} (status ${
        res.statusCode
      })`
    );
  }

  return body;
};

const main = async () => {
  const statsHandlerMod = await import(
    pathToFileURL(path.join(upstreamDir, "api", "index.js")).href
  );
  const topLangsHandlerMod = await import(
    pathToFileURL(path.join(upstreamDir, "api", "top-langs.js")).href
  );

  const statsHandler = statsHandlerMod.default;
  const topLangsHandler = topLangsHandlerMod.default;

  if (typeof statsHandler !== "function") {
    throw new Error("Upstream stats handler is not a function");
  }
  if (typeof topLangsHandler !== "function") {
    throw new Error("Upstream top-langs handler is not a function");
  }

  await ensureDir(outDir);

  const statsSvg = await handlerToSvg(statsHandler, {
    username,
    show_icons: "true",
    theme,
  });

  const langsSvg = await handlerToSvg(topLangsHandler, {
    username,
    theme,
    layout: langsLayout,
  });

  await fs.writeFile(path.join(outDir, "github-stats.svg"), statsSvg, "utf8");
  await fs.writeFile(path.join(outDir, "top-langs.svg"), langsSvg, "utf8");

  // Helpful log for Actions
  // eslint-disable-next-line no-console
  console.log(
    `Rendered SVGs for ${username} -> ${path.relative(
      repoRoot,
      outDir
    )}/github-stats.svg, top-langs.svg`
  );
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
