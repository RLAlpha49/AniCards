export function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(lt|gt|amp|quot|apos|#39|#x27|#\d+|#x[0-9a-fA-F]+);/g,
    (entity) => {
      switch (entity) {
        case "&lt;":
          return "<";
        case "&gt;":
          return ">";
        case "&amp;":
          return "&";
        case "&quot;":
          return '"';
        case "&apos;":
        case "&#39;":
        case "&#x27;":
          return "'";
        default: {
          if (entity.startsWith("&#x")) {
            const code = Number.parseInt(entity.slice(3, -1), 16);
            return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
              ? String.fromCodePoint(code)
              : entity;
          }

          if (entity.startsWith("&#")) {
            const code = Number.parseInt(entity.slice(2, -1), 10);
            return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
              ? String.fromCodePoint(code)
              : entity;
          }

          return entity;
        }
      }
    },
  );
}
