export function removeClassTokensFromMarkup(
  svg: string,
  classTokens: string[],
): string {
  if (!classTokens || classTokens.length === 0) return svg;
  return svg.replaceAll(/class=(['"])(.*?)\1/gi, (match, quote, clsValue) => {
    const tokens = clsValue
      .split(/\s+/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    const remaining = tokens.filter((t: string) => !classTokens.includes(t));
    if (remaining.length === 0) return "";
    return `class=${quote}${remaining.join(" ")}${quote}`;
  });
}

export function sanitizeInlineStyleAttributes(svg: string): string {
  return svg.replaceAll(/style=(['"])(.*?)\1/gi, (m, quote, styleValue) => {
    const parts = styleValue
      .split(/;+/)
      .map((p: string) => p.trim())
      .filter(Boolean);
    const outParts: string[] = [];
    for (const p of parts) {
      const [rawName, ...rest] = p.split(":");
      if (!rawName || rest.length === 0) continue;
      const name = rawName.trim().toLowerCase();
      const val = rest.join(":").trim();
      if (/^(?:-webkit-|-moz-|-ms-)?animation(?:-.*)?$/i.test(name)) continue;
      let finalVal = val;
      if (name === "opacity" && /^\s*0+(?:\.\d+)?\s*$/.test(val))
        finalVal = "1";
      if (name === "visibility" && /^\s*hidden\s*$/i.test(val))
        finalVal = "visible";
      outParts.push(`${name}: ${finalVal}`);
    }
    if (outParts.length === 0) return "";
    return `style=${quote}${outParts.join("; ")}${quote}`;
  });
}