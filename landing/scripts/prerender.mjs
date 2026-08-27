/**
 * Turns the client-rendered bundle into a static HTML page.
 *
 * Runs after both Vite builds: it imports the SSR bundle, renders <App /> to a
 * string, injects it into dist/index.html together with the head tags and
 * JSON-LD, and writes robots.txt and sitemap.xml next to it. Crawlers then get
 * the whole page as markup, and the browser hydrates it instead of building it
 * from scratch.
 */
import { readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distIndex = resolve(root, "dist/index.html");
const serverEntry = resolve(root, "dist-server/entry-server.js");

const siteUrl = (process.env.VITE_SITE_URL ?? "https://tarot-aurum.pages.dev")
  .replace(/\/$/, "");

const { render } = await import(pathToFileURL(serverEntry).href);
const { html, head } = render();

let page = await readFile(distIndex, "utf8");

if (!page.includes('<div id="root"></div>')) {
  throw new Error(
    "dist/index.html no longer contains an empty <div id=\"root\"></div> — " +
      "prerender would silently produce a page with no content.",
  );
}

page = page
  .replace("</head>", `  ${head}\n  </head>`)
  .replace('<div id="root"></div>', `<div id="root">${html}</div>`);

await writeFile(distIndex, page, "utf8");

await writeFile(
  resolve(root, "dist/robots.txt"),
  [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n"),
  "utf8",
);

const today = new Date().toISOString().slice(0, 10);
await writeFile(
  resolve(root, "dist/sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`,
  "utf8",
);

/* The SSR bundle is a build artefact, not something to upload. */
await rm(resolve(root, "dist-server"), { recursive: true, force: true });

console.log(`prerendered dist/index.html (${html.length} chars of markup)`);
console.log(`robots.txt and sitemap.xml written for ${siteUrl}`);
