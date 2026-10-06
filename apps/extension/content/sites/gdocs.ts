import { query } from "../dom";

export const GDOCS = {
  titleInput: [".docs-title-input", ".docs-title-input-label-inner"],
  titleAnchor: [".docs-title-widget"],
};

export type GoogleDoc = { docId: string; title: string };

export function currentDoc(): GoogleDoc | null {
  const match = location.pathname.match(/\/document\/(?:u\/\d+\/)?d\/([\w-]+)/);
  if (!match?.[1]) return null;
  return { docId: match[1], title: currentTitle() };
}

function currentTitle(): string {
  const title = query<HTMLElement>(document, GDOCS.titleInput);
  const fromTitle = title instanceof HTMLInputElement ? title.value.trim() : title?.textContent?.trim();
  if (fromTitle) return fromTitle;
  const docTitle = document.title;
  const cut = docTitle.lastIndexOf(" - ");
  return (cut > 0 ? docTitle.slice(0, cut) : docTitle).trim() || "Untitled document";
}

export function findTitleAnchor(): HTMLElement | null {
  return query<HTMLElement>(document, GDOCS.titleAnchor);
}
