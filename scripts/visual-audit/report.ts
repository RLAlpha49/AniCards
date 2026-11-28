/**
 * Builds the standalone HTML report from a capture directory.
 *
 * The report is generated from `manifest.json` alone. It does not render
 * anything, does not read the source, and does not know which cards exist:
 * every number on the page comes from the manifest, and every panel from a
 * file the manifest lists. That keeps it usable after the fact, when the code
 * has moved on but an old capture has not.
 *
 * Images are inlined as base64 so the file opens without a server or a
 * sibling directory, which is the point of a capture you can email.
 *
 * Base64 hides text from search and from a reader that cannot see images, so
 * each capture also carries the text nodes and the `desc` its SVG renders, and
 * the whole manifest is repeated as JSON in `report.index.json` and in the
 * `audit-index` block at the end of the document. The page is then reviewable
 * three ways: visually, by reading the extracted text, and by parsing the
 * index.
 *
 * @source
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { escapeHtml } from "./indicators";
import type { Capture, Manifest } from "./types";

/** A capture paired with the markup for its panel and its index entry. @source */
type Panel = {
  capture: Capture;
  html: string;
  index: IndexEntry;
};

/** Status a panel is filtered by. @source */
type Status = "ok" | "fallback" | "duplicate" | "failed";

/** One capture as the machine-readable index describes it. @source */
type IndexEntry = {
  card: string;
  variation: string;
  status: Status;
  file: string | null;
  bytes: number | null;
  sha256: string | null;
  width: number | null;
  height: number | null;
  extras: Record<string, string>;
  title: string | null;
  description: string | null;
  text: string[];
  notes: string[];
};

/** Counts shown at the top of the report. @source */
type Summary = {
  variations: number;
  cards: number;
  failures: number;
  fallbacks: number;
  duplicates: number;
  bytes: number;
};

/**
 * Makes a string safe to use in an id or a URL fragment.
 * @param value - Raw text.
 * @returns Lowercase text with runs of punctuation replaced by a dash.
 * @source
 */
function slug(value: string): string {
  return value.replace(/[^\w-]+/g, "-").toLowerCase();
}

/**
 * Computes the headline counts.
 * @param manifest - Capture manifest.
 * @returns Counts for the summary row.
 * @source
 */
function summarise(manifest: Manifest): Summary {
  const captures = manifest.captures;
  return {
    variations: captures.length,
    cards: new Set(captures.map((item) => item.card)).size,
    failures: captures.filter((item) => item.error).length,
    fallbacks: captures.filter((item) => item.fallbackIndicators.length).length,
    duplicates: captures.filter((item) => item.identicalTo).length,
    bytes: captures.reduce((total, item) => total + (item.bytes ?? 0), 0),
  };
}

/**
 * Decodes the XML entities an SVG puts in its text nodes.
 * @param value - Escaped text.
 * @returns Plain text, with unknown entities left as written.
 * @source
 */
function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, code: string) => {
      if (code.startsWith("#")) {
        const codePoint =
          code[1].toLowerCase() === "x"
            ? Number.parseInt(code.slice(2), 16)
            : Number.parseInt(code.slice(1), 10);
        return Number.isFinite(codePoint) &&
          codePoint >= 0 &&
          codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : match;
      }
      return named[code.toLowerCase()] ?? match;
    },
  );
}

/**
 * Strips child markup, decodes entities, and collapses whitespace.
 * @param value - Raw inner markup of an SVG element.
 * @returns A single line of readable text.
 * @source
 */
function flatten(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Collects the visible text of a rendered SVG.
 *
 * The report shows captures as images, so their text is otherwise sealed
 * inside a base64 data URL: a search cannot find it and a reader that cannot
 * see the image cannot recover it. Pulling the text nodes out gives both the
 * same content the picture shows.
 *
 * @param svg - Rendered SVG source.
 * @returns One entry per non-empty text node, in document order.
 * @source
 */
function svgText(svg: string): string[] {
  return [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)]
    .map((match) => flatten(match[1]))
    .filter(Boolean);
}

/**
 * Reads the text of a single metadata element from an SVG.
 * @param svg - Rendered SVG source.
 * @param tag - Element to read.
 * @returns Its text, or null when the element is absent or empty.
 * @source
 */
function svgElement(svg: string, tag: "title" | "desc"): string | null {
  const match = svg.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`));
  const value = match ? flatten(match[1]) : "";
  return value || null;
}

/**
 * Reads the pixel size an SVG declares on its root element.
 * @param svg - Rendered SVG source.
 * @returns Width and height, or null for each when it is not a plain number.
 * @source
 */
function svgSize(svg: string): { width: number | null; height: number | null } {
  const root = svg.match(/<svg\b[^>]*>/);
  if (!root) return { width: null, height: null };
  const width = root[0].match(/\swidth="(\d+(?:\.\d+)?)"/);
  const height = root[0].match(/\sheight="(\d+(?:\.\d+)?)"/);
  return {
    width: width ? Number(width[1]) : null,
    height: height ? Number(height[1]) : null,
  };
}

/**
 * Formats a byte count for display.
 * @param bytes - Size from the manifest.
 * @returns A short size, or a note when the manifest has none.
 * @source
 */
function formatBytes(bytes: number | undefined): string {
  if (typeof bytes !== "number") return "size unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Picks the single status a panel is filtered and badged by.
 * @param capture - The capture entry.
 * @returns The most serious condition the capture reports.
 * @source
 */
function statusOf(capture: Capture): Status {
  if (capture.error) return "failed";
  if (capture.fallbackIndicators.length) return "fallback";
  if (capture.identicalTo) return "duplicate";
  return "ok";
}

/**
 * Groups panels by card type, keeping manifest order inside each group.
 *
 * Variations of one card only mean something next to each other, so the page
 * is laid out by card rather than in capture order.
 *
 * @param panels - Panels in manifest order.
 * @returns One group per card, in first-appearance order.
 * @source
 */
function groupByCard(panels: Panel[]): { card: string; panels: Panel[] }[] {
  const groups = new Map<string, Panel[]>();
  for (const panel of panels) {
    const list = groups.get(panel.capture.card) ?? [];
    list.push(panel);
    groups.set(panel.capture.card, list);
  }
  return [...groups].map(([card, list]) => ({
    card,
    panels: [...list].sort(
      (a, b) =>
        Number(b.capture.variation === "default") -
          Number(a.capture.variation === "default") ||
        list.indexOf(a) - list.indexOf(b),
    ),
  }));
}

/**
 * Builds the machine-readable index for the whole report.
 *
 * Everything a reader would otherwise have to infer from the markup: status,
 * pixel size, the text each image renders, and the notes. Written both into
 * the HTML and to a sibling JSON file, so an agent can read the facts without
 * parsing nine megabytes of inlined images.
 *
 * @param manifest - Capture manifest.
 * @param panels - Panels in manifest order.
 * @returns A plain object ready for `JSON.stringify`.
 * @source
 */
function buildIndex(
  manifest: Manifest,
  panels: Panel[],
): Record<string, unknown> {
  return {
    generatedAt: manifest.generatedAt,
    fixedTime: manifest.fixedTime,
    timezone: manifest.timezone,
    source: manifest.source,
    style: manifest.style,
    caveats: manifest.caveats,
    summary: summarise(manifest),
    captures: panels.map((panel) => panel.index),
  };
}

/**
 * Reads one capture file and everything the report shows about it.
 *
 * The hash is re-checked here rather than trusted: a manifest and its files
 * can drift apart if a file is edited or a copy is partial, and a silently
 * wrong image is worse than a visible warning.
 *
 * @param capture - The capture entry.
 * @param cardsDir - Directory holding the SVGs.
 * @returns The data URL, the text the image shows, and any notes.
 * @source
 */
function readCapture(
  capture: Capture,
  cardsDir: string,
): {
  dataUrl: string;
  text: string[];
  title: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  notes: string[];
} {
  const empty = {
    dataUrl: "",
    text: [] as string[],
    title: null,
    description: null,
    width: null,
    height: null,
  };
  if (!capture.file) {
    return { ...empty, notes: [] };
  }
  if (!/^[\w.-]+\.svg$/.test(capture.file)) {
    return { ...empty, notes: ["Capture filename is unsafe to read."] };
  }
  try {
    const bytes = readFileSync(path.join(cardsDir, capture.file));
    const source = bytes.toString("utf8");
    const actual = createHash("sha256").update(bytes).digest("hex");
    const notes: string[] = [];
    if (!capture.sha256 || actual !== capture.sha256) {
      notes.push("The SVG hash does not match the manifest or is missing.");
    }
    return {
      dataUrl: `data:image/svg+xml;base64,${bytes.toString("base64")}`,
      text: svgText(source),
      title: svgElement(source, "title"),
      description: svgElement(source, "desc"),
      ...svgSize(source),
      notes,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...empty, notes: [`Could not read capture: ${message}`] };
  }
}

/**
 * Builds one capture panel.
 *
 * The panel carries its own metadata as data attributes so the filter can run
 * without walking the document, and so a script reading the page can list
 * captures without parsing the markup around them.
 *
 * @param capture - The capture entry.
 * @param cardsDir - Directory holding the SVGs.
 * @returns The panel, its markup, and its index entry.
 * @source
 */
function buildPanel(capture: Capture, cardsDir: string): Panel {
  const read = readCapture(capture, cardsDir);
  const status = statusOf(capture);
  const notes = [
    ...capture.fallbackIndicators,
    ...(capture.identicalTo
      ? [`Identical output to the ${capture.identicalTo} variation`]
      : []),
    ...(capture.error ? [`Capture error: ${capture.error}`] : []),
    ...read.notes,
  ];

  const id = `c-${slug(capture.card)}-${slug(capture.variation)}`;
  const image = read.dataUrl
    ? `<img loading="lazy" src="${read.dataUrl}" alt="${escapeHtml(
        `Capture of ${capture.card}, ${capture.variation} variation`,
      )}">`
    : '<p class="notice">No image available.</p>';
  const description = read.description
    ? `<p class="desc">${escapeHtml(read.description)}</p>`
    : "";
  const list = notes.length
    ? `<ul class="notes">${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>`
    : "";
  const text = read.text.length
    ? `<details><summary>Text &middot; ${read.text.length} nodes</summary><pre>${escapeHtml(
        read.text.join("\n"),
      )}</pre></details>`
    : "";
  const flag =
    status === "ok"
      ? ""
      : `<span class="flag ${status}">${
          status === "failed"
            ? "capture failed"
            : status === "fallback"
              ? "fallback"
              : "duplicate"
        }</span>`;
  const size =
    read.width && read.height
      ? `${read.width}\u00d7${read.height}`
      : "size unknown";
  const extras = Object.keys(capture.extras).length
    ? ` <code>${escapeHtml(JSON.stringify(capture.extras))}</code>`
    : "";
  const search = [
    capture.card,
    capture.variation,
    status === "ok"
      ? "ok"
      : `${status} ${status === "failed" ? "capture failed" : ""}`,
    ...notes,
    read.title ?? "",
    read.description ?? "",
    ...read.text,
  ]
    .join(" ")
    .toLowerCase();

  return {
    capture,
    index: {
      card: capture.card,
      variation: capture.variation,
      status,
      file: capture.file ?? null,
      bytes: capture.bytes ?? null,
      sha256: capture.sha256 ?? null,
      width: read.width,
      height: read.height,
      extras: capture.extras,
      title: read.title,
      description: read.description,
      text: read.text,
      notes,
    },
    html: `<figure class="capture" id="${id}" data-card="${escapeHtml(
      capture.card,
    )}" data-variation="${escapeHtml(
      capture.variation,
    )}" data-status="${status}" data-bytes="${capture.bytes ?? ""}" data-sha256="${
      capture.sha256 ?? ""
    }" data-search="${escapeHtml(search)}"><div class="plate">${image}</div><figcaption><span class="variation">${escapeHtml(
      capture.variation,
    )}</span><span class="meta">${escapeHtml(size)} &middot; ${escapeHtml(
      formatBytes(capture.bytes),
    )}${extras}</span>${flag}${description}${list}${text}</figcaption></figure>`,
  };
}

/**
 * Renders the settings the capture used, as label and value rows.
 *
 * A grid of rows rather than a sentence: a reviewer checks one value at a
 * time, and a reader that parses the page gets the same pairing.
 *
 * @param manifest - Capture manifest.
 * @returns Markup for the "settings" block.
 * @source
 */
function settingsBlock(manifest: Manifest): string {
  const { style } = manifest;
  const colours = Object.entries(style.colors);
  const rows = [
    ["style", `<code>${escapeHtml(style.name)}</code>`],
    ...(style.colorPreset
      ? [["preset", `<code>${escapeHtml(style.colorPreset)}</code>`]]
      : []),
    ["border radius", `${style.borderRadius}px`],
    ["favourites", style.showFavorites ? "on" : "off"],
    ["pie percentages", style.showPiePercentages ? "on" : "off"],
    ["favourites grid", `${style.gridCols} \u00d7 ${style.gridRows}`],
  ]
    .map(
      ([key, value]) =>
        `<div><dt>${escapeHtml(key)}</dt><dd>${value}</dd></div>`,
    )
    .join("");
  const swatches = colours.length
    ? colours
        .map(
          ([name, value]) =>
            `<div><dt>${escapeHtml(name.replace(/Color$/, ""))}</dt><dd><span class="swatch" style="background:${escapeHtml(
              String(value),
            )}" aria-hidden="true"></span><code>${escapeHtml(String(value))}</code></dd></div>`,
        )
        .join("")
    : `<div><dt>colours</dt><dd>the preset's own</dd></div>`;
  return `<div><h3>Render settings</h3><dl>${rows}${swatches}</dl></div>`;
}

/**
 * Renders where the audited record came from, plus the capture's caveats.
 * @param manifest - Capture manifest.
 * @returns Markup for the "source" block.
 * @source
 */
function sourceBlock(manifest: Manifest): string {
  const { source } = manifest;
  const rows = [
    ["user", escapeHtml(source.username || "unknown")],
    ["user id", `<code>${escapeHtml(source.userId)}</code>`],
    ["redis", `<code>${escapeHtml(source.redisHost)}</code>`],
    ["captured", escapeHtml(manifest.generatedAt)],
    ["frozen clock", escapeHtml(manifest.fixedTime)],
    ["timezone", escapeHtml(manifest.timezone)],
  ]
    .map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`)
    .join("");
  const caveats = manifest.caveats
    .map((caveat) => `<li>${escapeHtml(caveat)}</li>`)
    .join("");
  return `<div><h3>Source data</h3><dl>${rows}</dl><ul class="caveats">${caveats}</ul></div>`;
}

/**
 * The stylesheet. Inlined because the report is a single file.
 *
 * Prose is a serif and anything copyable (ids, sizes, hashes, extracted text)
 * is monospace. Panels sit in a grid so a card's variations can be compared
 * without scrolling past each other.
 * @source
 */
const STYLES = `
  :root{color-scheme:light;--ink:#16202b;--muted:#5c6a75;--paper:#f2f0ea;--plate:#fff;--line:#d3d7d3;--rule:#b9c0ba;--accent:#a94332;--teal:#145d59;--mono:ui-monospace,'Cascadia Mono',Menlo,monospace}
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 Georgia,'Iowan Old Style',serif}
  a{color:inherit}
  a:focus-visible,input:focus-visible,button:focus-visible,summary:focus-visible,select:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
  code,pre{font:12.5px/1.5 var(--mono)}
  code{background:#e6e3d8;padding:.1em .32em;border-radius:3px}
  pre{margin:.5rem 0 0;padding:.6rem .7rem;background:#f4f2ea;border-left:2px solid var(--rule);overflow:auto;white-space:pre-wrap;max-height:18rem}
  .hero{background:var(--ink);color:#faf7ed;padding:3.5rem max(1.25rem,calc((100vw - 1360px)/2)) 2.75rem}
  .eyebrow{font:700 .72rem/1.3 var(--mono);letter-spacing:.18em;text-transform:uppercase;color:#e8a892}
  .hero h1{font-size:clamp(2.4rem,5.5vw,4.4rem);line-height:1.02;letter-spacing:-.035em;margin:.65rem 0 1rem;font-weight:400}
  .hero h1 em{font-style:italic;color:#f0c9b4}
  .hero p{max-width:44rem;color:#cfd8d5;margin:0}
  .hero nav{display:flex;flex-wrap:wrap;gap:.5rem 1.4rem;margin-top:1.4rem;font:600 .82rem var(--mono);text-transform:uppercase;letter-spacing:.08em}
  .hero nav a{color:#fff;text-decoration:none;border-bottom:1px solid #7b8b95;padding-bottom:.15rem}
  .hero nav a:hover{border-color:#fff}
  main{max-width:1360px;margin:auto;padding:2rem 1.25rem 5rem}
  .summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:1px;background:var(--rule);border:1px solid var(--rule);margin:0 0 2rem}
  .summary div{background:var(--plate);padding:.9rem 1rem}
  .summary strong{display:block;font:400 1.9rem/1.1 Georgia,serif}
  .summary span{font:600 .68rem/1.4 var(--mono);text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
  .summary .alert strong{color:var(--accent)}
  h2{font-size:1.7rem;line-height:1.2;margin:0 0 .35rem;font-weight:400}
  h3{margin:0;font-size:1.05rem;font-weight:400}
  p,li{overflow-wrap:anywhere}
  section{scroll-margin-top:1rem}
  .method{display:grid;grid-template-columns:repeat(auto-fit,minmax(18rem,1fr));gap:0 2.5rem;border-top:1px solid var(--rule);padding-top:1.4rem}
  .method>div{border-top:3px solid var(--teal);padding:.9rem 0 0;margin-bottom:1.5rem}
  .method h3{font:700 .78rem var(--mono);text-transform:uppercase;letter-spacing:.12em;color:var(--teal);margin-bottom:.7rem}
  .method p{font-size:.92rem;color:#3d4a54;margin:.6rem 0}
  dl{margin:0;display:grid;gap:.3rem 1rem}
  dl>div{display:grid;grid-template-columns:minmax(6.5rem,auto) 1fr;gap:.8rem;align-items:baseline;border-bottom:1px dotted var(--rule);padding-bottom:.3rem}
  dt{font:600 .7rem var(--mono);text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}
  dd{margin:0;font-size:.9rem;overflow-wrap:anywhere}
  .swatch{display:inline-block;width:.85rem;height:.85rem;border-radius:2px;border:1px solid #0003;vertical-align:-1px;margin-right:.4rem}
  .caveats{margin:.9rem 0 0;padding-left:1.1rem;font-size:.86rem;color:#4b5850}
  .caveats li{margin-bottom:.35rem}
  .controls{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:.75rem 1rem;align-items:end;background:var(--paper);border-bottom:1px solid var(--rule);padding:.8rem 0;margin-bottom:1.2rem}
  .controls .field{display:flex;flex-direction:column}
  label{font:700 .68rem var(--mono);text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:.25rem}
  input[type=search],select{font:14px var(--mono);color:var(--ink);background:var(--plate);border:1px solid #97a3a0;border-radius:3px;padding:.42rem .5rem}
  input[type=search]{min-width:18rem}
  .statusline{font:600 .78rem var(--mono);color:var(--muted);margin:0 0 .5rem auto}
  .type{border-top:2px solid var(--ink);padding-top:.9rem;margin-bottom:2.6rem}
  .type-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:.5rem 1rem}
  .type-head h3{font:400 1.35rem Georgia,serif}
  .type-head .count{font:600 .7rem var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
  .type-head a{font:600 .7rem var(--mono);text-transform:uppercase;letter-spacing:.08em;text-decoration:none;color:var(--teal);border-bottom:1px solid #9dbcb8}
  .type-nav{display:flex;flex-wrap:wrap;gap:.3rem .9rem;margin:.6rem 0 0;font:12.5px var(--mono)}
  .type-nav a{color:var(--teal);text-decoration:none;border-bottom:1px solid #c2d3cf;padding-bottom:.1rem}
  .type-nav a:hover{border-color:var(--teal)}
  .variations{display:grid;grid-template-columns:repeat(auto-fill,minmax(21rem,1fr));gap:1.1rem;margin-top:1rem}
  .capture{margin:0;background:var(--plate);border:1px solid var(--line);display:flex;flex-direction:column}
  .capture .plate{flex:1;display:flex;align-items:center;justify-content:center;padding:.9rem;background:#e9ece7;border-bottom:1px solid var(--line);min-height:7rem}
  .capture img{display:block;max-width:100%;height:auto}
  .capture figcaption{padding:.7rem .8rem .8rem;font-size:.82rem;display:flex;flex-direction:column;gap:.4rem}
  .capture .variation{font:700 .78rem var(--mono);text-transform:uppercase;letter-spacing:.06em}
  .capture .meta{font:11.5px var(--mono);color:var(--muted)}
  .capture .desc{margin:0;font-size:.8rem;color:#46525b}
  .flag{align-self:start;font:700 .64rem var(--mono);text-transform:uppercase;letter-spacing:.08em;padding:.16rem .45rem;border-radius:2px;background:#fbf0d4;color:#7a5312}
  .flag.failed{background:#f7e0d7;color:#8b3320}
  .flag.duplicate{background:#e3e8f0;color:#3a4a66}
  .notes{margin:0;padding-left:1rem;font-size:.78rem;color:#554b3c}
  details summary{cursor:pointer;font:600 .7rem var(--mono);text-transform:uppercase;letter-spacing:.07em;color:var(--teal)}
  .notice{margin:0;padding:1rem;background:#f6f2e8;font-size:.85rem}
  .empty{margin:0;padding:2rem 0;color:var(--muted);font-size:.9rem}
  .table-scroll{overflow-x:auto;border-bottom:1px solid var(--line)}
  table{width:100%;border-collapse:collapse;font:12.5px var(--mono);margin-top:1rem}
  th,td{text-align:left;padding:.4rem .5rem;border-bottom:1px solid var(--line);vertical-align:top}
  th{font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
  tbody tr:hover{background:#e9ece7}
  [hidden]{display:none!important}
  @media(max-width:640px){.hero{padding-top:2.4rem}.variations{grid-template-columns:1fr}.statusline{margin-left:0}}
  @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;

/**
 * The filter script. Inlined for the same reason as the stylesheet.
 *
 * Filtering reads `data-search` rather than `textContent`, so a match does not
 * depend on whether a details block is open and is not slowed by the base64
 * image inside the panel.
 * @source
 */
const SCRIPT = `
const filter=document.getElementById('filter');
const status=document.getElementById('status-filter');
const captures=[...document.querySelectorAll('.capture')];
const types=[...document.querySelectorAll('.type')];
const count=document.getElementById('visible-count');
const noMatch=document.getElementById('no-match');
function apply(){
  const q=filter.value.trim().toLowerCase();
  const want=status.value;
  let visible=0;
  for(const item of captures){
    const okQuery=q===''||item.dataset.search.includes(q);
    const okStatus=want==='all'||item.dataset.status===want;
    item.hidden=!(okQuery&&okStatus);
    if(!item.hidden)visible++;
  }
  for(const type of types){
    type.hidden=!type.querySelector('.capture:not([hidden])');
  }
  noMatch.hidden=visible!==0;
  count.textContent='Showing '+visible+' of '+captures.length+' captures.';
}
filter.addEventListener('input',apply);
status.addEventListener('change',apply);
`;

/**
 * Builds the full HTML document.
 *
 * Layout order is: counts, then method and limits, then the cards grouped by
 * card type, then an index table. Grouping matters because variations of one
 * card only mean something next to each other.
 *
 * @param manifest - Capture manifest.
 * @param panels - One panel per capture, in manifest order.
 * @returns The report as a string.
 * @source
 */
function renderHtml(manifest: Manifest, panels: Panel[]): string {
  const summary = summarise(manifest);
  const index = buildIndex(manifest, panels);
  const groups = groupByCard(panels);
  const typeNav = groups
    .map(
      (group) =>
        `<a href="#t-${slug(group.card)}">${escapeHtml(group.card)}</a>`,
    )
    .join("");
  const sections = groups
    .map((group) => {
      const flagged = group.panels.filter(
        (panel) => panel.index.status !== "ok",
      ).length;
      return `<section class="type" id="t-${slug(group.card)}"><div class="type-head"><h3>${escapeHtml(
        group.card,
      )}</h3><span class="count">${group.panels.length} variation${
        group.panels.length === 1 ? "" : "s"
      }${flagged ? ` &middot; ${flagged} flagged` : ""}</span><a href="#index">index &uarr;</a></div><div class="variations">${group.panels
        .map((panel) => panel.html)
        .join("")}</div></section>`;
    })
    .join("\n");
  const rows = [...panels]
    .sort(
      (a, b) =>
        a.index.card.localeCompare(b.index.card) ||
        a.index.variation.localeCompare(b.index.variation),
    )
    .map(
      (panel) =>
        `<tr><td><a href="#${panelAnchor(panel)}">${escapeHtml(
          panel.index.card,
        )}</a></td><td>${escapeHtml(panel.index.variation)}</td><td>${
          panel.index.status
        }</td><td>${
          panel.index.width && panel.index.height
            ? `${panel.index.width}&times;${panel.index.height}`
            : "?"
        }</td><td>${panel.index.bytes ?? "?"}</td><td><code>${
          panel.index.sha256 ? panel.index.sha256.slice(0, 12) : "?"
        }</code></td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>AniCards visual audit</title>
<style>${STYLES}</style>
</head>
<body>
<header class="hero"><div class="eyebrow">AniCards / visual audit</div><h1>Every card,<br><em>from real data.</em></h1><p>Every registered card variation, rendered from one real stored account so long titles, six-digit counters, and crowded lists are visible. Images, the text inside them, and the capture settings are all in this one file.</p><nav aria-label="Sections"><a href="#method">Method</a><a href="#cards">Cards</a><a href="#index">Index</a></nav></header>
<main>
<div class="summary" aria-label="Capture counts">
<div><strong>${summary.variations}</strong><span>variations</span></div>
<div><strong>${summary.cards}</strong><span>card types</span></div>
<div${summary.failures ? ' class="alert"' : ""}><strong>${summary.failures}</strong><span>failed</span></div>
<div${summary.fallbacks ? ' class="alert"' : ""}><strong>${summary.fallbacks}</strong><span>fallbacks</span></div>
<div><strong>${summary.duplicates}</strong><span>duplicates</span></div>
<div><strong>${formatBytes(summary.bytes)}</strong><span>svg total</span></div>
</div>
<section id="method" aria-labelledby="method-heading"><h2 id="method-heading">Method and limits</h2>
<p>The capture reads one stored user record from Redis and renders every registered card variation from it, using a frozen clock, seeded randomness, and a named style. Reading happens before the network is blocked, so rendering itself makes no requests; cover art is cached first, then embedded as data URLs. Each SVG's SHA-256 hash is checked against the manifest before it is shown.</p>
<p>Determinism is the point of freezing the clock and seeding randomness: two runs of the same code against the same record produce byte-identical SVGs, so a hash that changed means the code changed. That holds only while the record is the same, and this record is a point-in-time copy. Re-capture before comparing two runs, or the data will look like a code change.</p>
<p>Fallback indicators are text and placeholder markers found in the output, not a judgement about whether the card looks right. A card can show an empty state correctly, and a card with no indicator can still be wrong.</p>
<div class="method">${sourceBlock(manifest)}${settingsBlock(manifest)}</div>
</section>
<section id="cards" aria-labelledby="cards-heading">
<div class="controls"><div class="field"><h2 id="cards-heading">Cards</h2></div><div class="field"><label for="filter">Filter</label><input id="filter" type="search" placeholder="card, variation, or any text in the image"></div><div class="field"><label for="status-filter">Status</label><select id="status-filter"><option value="all">all</option><option value="fallback">fallback</option><option value="duplicate">duplicate</option><option value="failed">failed</option><option value="ok">ok only</option></select></div><p class="statusline" id="visible-count" aria-live="polite">Showing all ${panels.length} captures.</p></div>
<p class="empty" id="no-match" hidden>No capture matches that filter.</p>
${sections}
</section>
<section id="index" aria-labelledby="index-heading"><h2 id="index-heading">Index</h2>
<p>One row per capture. <code>report.index.json</code> holds the same data as JSON, and the <code>audit-index</code> script block at the end of this document holds it again for a parser that only has the HTML.</p>
<p>Jump to a card:</p>
<nav class="type-nav" aria-label="Card types">${typeNav}</nav>
<div class="table-scroll"><table><thead><tr><th>card</th><th>variation</th><th>status</th><th>size</th><th>bytes</th><th>sha256</th></tr></thead><tbody>${rows}</tbody></table></div>
</section>
</main>
<script type="application/json" id="audit-index">${JSON.stringify(index).replace(/</g, "\\u003c")}</script>
<script>${SCRIPT}</script>
</body></html>`;
}

/**
 * The id a capture panel carries, so links and the index agree.
 * @param panel - The panel.
 * @returns An id safe for a URL fragment.
 * @source
 */
function panelAnchor(panel: Panel): string {
  return `c-${slug(panel.index.card)}-${slug(panel.index.variation)}`;
}

/** Result of building a report. @source */
type ReportResult = {
  output: string;
  index: string;
  summary: Summary;
};

/**
 * Reads a capture directory and writes the report.
 *
 * @param cardsDir - Directory holding `manifest.json` and the SVGs.
 * @param output - Where to write the HTML file.
 * @returns The paths written and the summary counts.
 * @source
 */
export function writeReport(cardsDir: string, output: string): ReportResult {
  const manifest = JSON.parse(
    readFileSync(path.join(cardsDir, "manifest.json"), "utf8"),
  ) as Manifest;

  const panels = manifest.captures.map((capture) =>
    buildPanel(capture, cardsDir),
  );
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, renderHtml(manifest, panels));

  const index = output.replace(/\.html?$/i, "") + ".index.json";
  writeFileSync(
    index,
    `${JSON.stringify(buildIndex(manifest, panels), null, 1)}\n`,
  );

  return { output, index, summary: summarise(manifest) };
}
