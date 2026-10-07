import { query, queryAll } from "../dom";
import { textOf } from "../watch";

export const BASECAMP = {
  title: [".perma-header__title", "h1"],
  project: [".perma-toolbar__breadcrumb--bucket strong", ".perma-toolbar__breadcrumb--bucket"],
  actions: [".perma-toolbar__actions"],
  notes: ['article[class*="recordable--"] .formatted_content'],
  cardWraps: ['article[class*="kanban-card"]'],
  todoItems: ["li.todo"],
};

export type BasecampItem = {
  accountId: string;
  projectId: string;
  projectName: string;
  itemId: string;
  title: string;
  notes: string;
  url: string;
};

export function currentBasecampItem(): BasecampItem | null {
  const match = location.pathname.match(/^\/(\d+)\/buckets\/(\d+)\/(?:todos\/(\d+)|card_tables\/cards\/(\d+))/);
  if (!match) return null;
  const [, accountId, projectId, todoId, cardId] = match;
  const itemId = todoId ?? cardId;
  if (!accountId || !projectId || !itemId) return null;

  return {
    accountId,
    projectId,
    projectName: textOf(query<HTMLElement>(document, BASECAMP.project)) || `Project ${projectId}`,
    itemId,
    title: textOf(query<HTMLElement>(document, BASECAMP.title)) || document.title,
    notes: query<HTMLElement>(document, BASECAMP.notes)?.innerText.trim() ?? "",
    url: `${location.origin}${location.pathname}`,
  };
}

export function findActionsAnchor(): HTMLElement | null {
  return query<HTMLElement>(document, BASECAMP.actions);
}

export type BasecampCard = { itemId: string; title: string; host: HTMLElement };

export type BasecampBoard = { projectId: string; projectName: string; cards: BasecampCard[] };

export function currentBasecampBoard(): BasecampBoard | null {
  const match = location.pathname.match(/^\/(\d+)\/buckets\/(\d+)\/card_tables\/(\d+)/);
  if (!match) return null;
  const projectId = match[2]!;

  const cards: BasecampCard[] = [];
  for (const wrap of queryAll<HTMLElement>(document, BASECAMP.cardWraps)) {
    const href = wrap.querySelector<HTMLAnchorElement>('a[href*="/card_tables/cards/"]')?.getAttribute("href");
    const itemId = href?.match(/\/cards\/(\d+)/)?.[1];
    if (!itemId) continue;
    cards.push({
      itemId,
      title: textOf(wrap.querySelector<HTMLElement>(".kanban-card__title")),
      host: wrap,
    });
  }

  return {
    projectId,
    projectName: textOf(query<HTMLElement>(document, BASECAMP.project)) || `Project ${projectId}`,
    cards,
  };
}

export type BasecampTodo = { itemId: string; title: string; host: HTMLElement };

export type BasecampTodoList = { projectId: string; projectName: string; todos: BasecampTodo[] };

export function currentBasecampTodoList(): BasecampTodoList | null {
  const match = location.pathname.match(/^\/(\d+)\/buckets\/(\d+)\/(?:todolists|todosets)\/(\d+)/);
  if (!match) return null;
  const projectId = match[2]!;

  const todos: BasecampTodo[] = [];
  for (const li of queryAll<HTMLElement>(document, BASECAMP.todoItems)) {
    if (!li.getBoundingClientRect().width) continue;
    const href = li.querySelector<HTMLAnchorElement>('a[href*="/todos/"]')?.getAttribute("href");
    const itemId = href?.match(/\/todos\/(\d+)/)?.[1];
    if (!itemId) continue;
    todos.push({
      itemId,
      title: textOf(li.querySelector<HTMLElement>(".todo__content a")),
      host: li,
    });
  }

  return {
    projectId,
    projectName: textOf(query<HTMLElement>(document, BASECAMP.project)) || `Project ${projectId}`,
    todos,
  };
}
