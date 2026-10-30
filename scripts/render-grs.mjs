import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fetchPublicStats } from "./public-stats.mjs";

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

const hasAnyPat = () => {
  return Object.keys(process.env).some((key) => {
    if (!/^PAT_\d+$/.test(key)) return false;
    const value = process.env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
};

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

export const validateSvg = (body, statusCode = 200) => {
  // Upstream handlers can return error cards with HTTP 200.
  if (statusCode >= 400 || typeof body !== "string" ||
      !/<svg\b/.test(body) || !/<\/svg>/.test(body) ||
      /data-testid=["']message["']|Something went wrong!|Resource not accessible by integration/i.test(body)) {
    throw new Error(`Refusing to publish invalid/error SVG (status ${statusCode})`);
  }
  return body;
};

export const handlerToSvg = async (handler, query) => {
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

  return validateSvg(body, res.statusCode);
};

const main = async () => {
  if (!hasAnyPat()) {
    throw new Error(
      "No GitHub API tokens found. github-readme-stats requires env var PAT_1 (or PAT_2...) to be set."
    );
  }

  const topLangsHandlerMod = await import(
    pathToFileURL(path.join(upstreamDir, "api", "top-langs.js")).href
  );

  const topLangsHandler = topLangsHandlerMod.default;

  if (typeof topLangsHandler !== "function") {
    throw new Error("Upstream top-langs handler is not a function");
  }

  await ensureDir(outDir);

  let statsSvg;
  if (process.env.GRS_PUBLIC_STATS === "true") {
    const { renderStatsCard } = await import(
      pathToFileURL(path.join(upstreamDir, "src", "cards", "stats.js")).href
    );
    const stats = await fetchPublicStats(username, process.env.PAT_1);
    // Upstream reads rank for CSS/accessibility even when the rank is hidden.
    statsSvg = validateSvg(renderStatsCard({ ...stats, rank: { level: "N/A", percentile: 100 } }, {
      theme,
      show_icons: true,
      hide: ["contribs"],
      hide_rank: true,
      include_all_commits: true,
      custom_title: `${username}'s GitHub Stats (public)`,
      card_width: 450,
    }));
  } else {
    const { default: statsHandler } = await import(
      pathToFileURL(path.join(upstreamDir, "api", "index.js")).href
    );
    statsSvg = await handlerToSvg(statsHandler, {
      username,
      show_icons: "true",
      theme,
    });
  }

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

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

