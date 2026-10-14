export type RichSpan = { text: string; bold?: boolean; italic?: boolean; code?: boolean };
export type RichBlock =
  | { type: 'paragraph'; spans: RichSpan[] }
  | { type: 'heading'; spans: RichSpan[] }
  | { type: 'bullet'; spans: RichSpan[]; depth: number }
  | { type: 'numbered'; marker: string; spans: RichSpan[]; depth: number };

const bulletLine = /^(\s*)[-*•]\s+(.*)$/;
const numberedLine = /^(\s*)(\d{1,3})[.)]\s+(.*)$/;
const headingLine = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
// Bold before italic so `**x**` is never read as two empty italics.
const inlineToken = /(`[^`\n]+`)|(\*\*(?=\S)[\s\S]*?\S\*\*)|(__(?=\S)[\s\S]*?\S__)|(\*(?=[^\s*])[^*\n]*?[^\s*]\*|\*[^\s*]\*)/g;

/**
 * Reads the small Markdown subset that chat models tend to produce — bold,
 * italic, inline code, headings, and bullet or numbered lists — so replies can
 * render with structure instead of showing raw asterisks. Anything else stays
 * literal text.
 */
export function parseRichText(source: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', spans: parseInline(paragraph.join('\n')) });
    paragraph = [];
  };

  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) { flush(); continue; }
    const heading = headingLine.exec(line);
    if (heading) { flush(); blocks.push({ type: 'heading', spans: parseInline(heading[1]) }); continue; }
    const bullet = bulletLine.exec(line);
    // A lone "*" or "-" line is a horizontal rule in Markdown; treat it as a break.
    if (bullet && bullet[2].trim()) { flush(); blocks.push({ type: 'bullet', spans: parseInline(bullet[2]), depth: indentDepth(bullet[1]) }); continue; }
    const numbered = numberedLine.exec(line);
    if (numbered) { flush(); blocks.push({ type: 'numbered', marker: `${numbered[2]}.`, spans: parseInline(numbered[3]), depth: indentDepth(numbered[1]) }); continue; }
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) { flush(); continue; }
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

export function parseInline(text: string): RichSpan[] {
  const spans: RichSpan[] = [];
  let cursor = 0;
  for (const match of text.matchAll(inlineToken)) {
    const index = match.index ?? 0;
    if (index > cursor) spans.push({ text: text.slice(cursor, index) });
    const [token] = match;
    if (match[1]) spans.push({ text: token.slice(1, -1), code: true });
    else if (match[2] || match[3]) spans.push(...parseInline(token.slice(2, -2)).map((span) => ({ ...span, bold: true })));
    else spans.push(...parseInline(token.slice(1, -1)).map((span) => ({ ...span, italic: true })));
    cursor = index + token.length;
  }
  if (cursor < text.length) spans.push({ text: text.slice(cursor) });
  return mergeAdjacent(spans);
}

/** The plain words of a reply, for accessibility labels and copying. */
export function richTextToPlain(source: string) {
  return parseRichText(source).map((block) => {
    const words = block.spans.map((span) => span.text).join('');
    if (block.type === 'bullet') return `• ${words}`;
    if (block.type === 'numbered') return `${block.marker} ${words}`;
    return words;
  }).join('\n');
}

function indentDepth(indent: string) {
  return Math.min(2, Math.floor(indent.replace(/\t/g, '  ').length / 2));
}

function mergeAdjacent(spans: RichSpan[]) {
  const merged: RichSpan[] = [];
  for (const span of spans) {
    if (!span.text) continue;
    const previous = merged.at(-1);
    if (previous && Boolean(previous.bold) === Boolean(span.bold) && Boolean(previous.italic) === Boolean(span.italic) && Boolean(previous.code) === Boolean(span.code)) previous.text += span.text;
    else merged.push({ ...span });
  }
  return merged;
}
