// UNVERIFIED SELECTORS — Google Docs class names are not a public API.
// Everything site-specific lives here so it can be fixed in one place.
export const GDOCS = {
  /** The editable document name in the title bar. */
  titleInput: ".docs-title-input",
  /** Share button container; the widget is inserted just before it. */
  shareButton: ["#docs-titlebar-share-client-button", ".docs-titlebar-buttons > *:last-child"],
};

export type GoogleDoc = { docId: string; title: string };

export function currentDoc(): GoogleDoc | null {
  // /document/d/<id>/edit and /document/u/0/d/<id>/edit
  const match = location.pathname.match(/\/document\/(?:u\/\d+\/)?d\/([\w-]+)/);
  if (!match?.[1]) return null;
  return { docId: match[1], title: currentTitle() };
}

function currentTitle(): string {
  const input = document.querySelector<HTMLInputElement>(GDOCS.titleInput);
  const fromInput = input?.value.trim();
  if (fromInput) return fromInput;
  // "<name> - Google Docs" (suffix is localized, e.g. "- Google Dokumen")
  const title = document.title;
  const cut = title.lastIndexOf(" - ");
  return (cut > 0 ? title.slice(0, cut) : title).trim() || "Untitled document";
}

export function findShareAnchor(): HTMLElement | null {
  for (const sel of GDOCS.shareButton) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el?.parentElement) return el;
  }
  return null;
}
