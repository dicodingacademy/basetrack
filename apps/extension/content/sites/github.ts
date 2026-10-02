import { textOf } from "../watch";

// UNVERIFIED SELECTORS — GitHub Projects (v2) is a React app whose markup
// changes often. The URL is the primary signal; DOM is only used for titles.
export const GITHUB = {
  /** Issue/PR title inside the item side pane (shared with the new issue view). */
  paneTitle: ['[data-testid="issue-title"]', '[data-testid="side-panel"] h2', '[role="dialog"] h2', "bdi.markdown-title"],
};

export type ProjectItem = {
  org: string;
  projectNumber: string;
  projectName: string;
  externalId: string; // owner/repo#123 or draft:<itemId>
  title: string;
};

/** Returns the item open in the project side pane, or null. */
export function currentProjectItem(): ProjectItem | null {
  const route = location.pathname.match(/^\/orgs\/([^/]+)\/projects\/(\d+)/);
  const org = route?.[1];
  const projectNumber = route?.[2];
  if (!org || !projectNumber) return null;

  const params = new URLSearchParams(location.search);
  if (params.get("pane") !== "issue") return null;

  // URLSearchParams already decodes %7C → "|"
  const issue = params.get("issue")?.split("|");
  const itemId = params.get("itemId");

  let ref: string | null = null;
  if (issue && issue.length === 3 && issue.every(Boolean)) ref = `${issue[0]}/${issue[1]}#${issue[2]}`;
  else if (itemId) ref = `draft:${itemId}`;
  if (!ref) return null;

  let titleEl: Element | null = null;
  for (const sel of GITHUB.paneTitle) {
    titleEl = document.querySelector(sel);
    if (titleEl) break;
  }
  const issueTitle = textOf(titleEl);
  // Wait for the pane to render its title instead of tracking "Untitled".
  if (!issueTitle) return null;

  return {
    org,
    projectNumber,
    projectName: projectNameFromTitle(org, projectNumber),
    externalId: ref,
    title: ref.startsWith("draft:") ? issueTitle : `${ref} ${issueTitle}`,
  };
}

function projectNameFromTitle(org: string, projectNumber: string): string {
  // e.g. "Roadmap · dicoding" — keep the part before the first " · "
  const name = document.title.split(" · ")[0]?.trim();
  return name && name !== "GitHub" ? name : `${org} project #${projectNumber}`;
}
