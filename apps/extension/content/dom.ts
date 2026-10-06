export function query<T extends Element = Element>(root: ParentNode, selectors: readonly string[]): T | null {
  for (const selector of selectors) {
    try {
      const el = root.querySelector<T>(selector);
      if (el) return el;
    } catch {}
  }
  return null;
}

export function queryAll<T extends Element = Element>(root: ParentNode, selectors: readonly string[]): T[] {
  const found: T[] = [];
  const seen = new Set<Element>();
  for (const selector of selectors) {
    try {
      for (const el of root.querySelectorAll<T>(selector)) {
        if (seen.has(el)) continue;
        seen.add(el);
        found.push(el);
      }
    } catch {}
  }
  return found;
}
