import { query } from "../dom";
import { textOf } from "../watch";

export const GITHUB = {
  paneTitle: [
    '[data-testid="issue-title"]',
    '[data-testid="issue-title-sticky"]',
    '[data-testid="issue-header"] .markdown-title',
  ],
  headerState: ['[data-testid="header-state"]'],
};

export type ProjectItem = {
  org: string;
  projectNumber: string;
  projectName: string;
  externalId: string;
  title: string;
  issueTitle: string;
  url: string;
};

export function currentProjectItem(): ProjectItem | null {
  const route = location.pathname.match(/^\/orgs\/([^/]+)\/projects\/(\d+)/);
  const org = route?.[1];
  const projectNumber = route?.[2];
  if (!org || !projectNumber) return null;

  const params = new URLSearchParams(location.search);
  if (params.get("pane") !== "issue") return null;

  const issue = params.get("issue")?.split("|");
  const itemId = params.get("itemId");

  let ref: string | null = null;
  let url: string | null = null;
  if (issue && issue.length === 3 && issue.every(Boolean)) {
    ref = `${issue[0]}/${issue[1]}#${issue[2]}`;
    url = `https://github.com/${issue[0]}/${issue[1]}/issues/${issue[2]}`;
  } else if (itemId) {
    ref = `draft:${itemId}`;
    url = `https://github.com/orgs/${org}/projects/${projectNumber}?pane=issue&itemId=${itemId}`;
  }
  if (!ref || !url) return null;

  const issueTitle = textOf(query(document, GITHUB.paneTitle));
  if (!issueTitle) return null;

  return {
    org,
    projectNumber,
    projectName: projectNameFromTitle(org, projectNumber),
    externalId: ref,
    title: ref.startsWith("draft:") ? issueTitle : `${ref} ${issueTitle}`,
    issueTitle,
    url,
  };
}

function projectNameFromTitle(org: string, projectNumber: string): string {
  const name = document.title.split(" · ")[0]?.trim();
  return name && name !== "GitHub" ? name : `${org} project #${projectNumber}`;
}
