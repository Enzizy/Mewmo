export function parsePageSelection(expression: string, pageCount: number) {
  if (!expression.trim()) throw new Error('Enter page numbers, for example 1-3, 5.');
  const pages: number[] = [];
  for (const rawToken of expression.split(',')) {
    const token = rawToken.trim();
    if (/^\d+$/.test(token)) pages.push(Number(token));
    else {
      const match = token.match(/^(\d+)\s*-\s*(\d+)$/);
      if (!match) throw new Error(`“${token}” is not a valid page or range.`);
      const start = Number(match[1]);
      const end = Number(match[2]);
      if (start > end) throw new Error(`Page range ${token} must run from lower to higher.`);
      for (let page = start; page <= end; page += 1) pages.push(page);
    }
  }
  if (!pages.length || pages.some((page) => page < 1 || page > pageCount)) throw new Error(`Choose pages from 1 to ${pageCount}.`);
  if (new Set(pages).size !== pages.length) throw new Error('Each page can be included only once.');
  return pages.map((page) => page - 1);
}
