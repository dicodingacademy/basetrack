import { query } from "../dom";
import type { GFileKind } from "../../lib/types";

export const EDITOR = {
  titleInput: [".docs-title-input", ".docs-title-input-label-inner"],
  shareButton: ["#docs-titlebar-share-client-button", ".docs-titlebar-buttons"],
};

export type EditorFile = { fileId: string; title: string };

export function currentEditorFile(kind: GFileKind): EditorFile | null {
  const match = location.pathname.match(new RegExp(`/${kind}/(?:u/\\d+/)?d/([\\w-]+)`));
  if (!match?.[1]) return null;
  return { fileId: match[1], title: currentTitle() };
}

function currentTitle(): string {
  const title = query<HTMLElement>(document, EDITOR.titleInput);
  const fromTitle = title instanceof HTMLInputElement ? title.value.trim() : title?.textContent?.trim();
  if (fromTitle) return fromTitle;
  const docTitle = document.title;
  const cut = docTitle.lastIndexOf(" - ");
  return (cut > 0 ? docTitle.slice(0, cut) : docTitle).trim() || "Untitled file";
}

export function findShareAnchor(): HTMLElement | null {
  return query<HTMLElement>(document, EDITOR.shareButton);
}
