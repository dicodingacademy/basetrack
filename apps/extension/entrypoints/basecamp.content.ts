import { defineContentScript } from "wxt/utils/define-content-script";
import { createWidget, type Widget } from "../content/widget";
import { watchPage } from "../content/watch";
import {
  currentBasecampBoard,
  currentBasecampItem,
  currentBasecampTodoList,
  findActionsAnchor,
  type BasecampBoard,
  type BasecampTodoList,
} from "../content/sites/basecamp";

type Row = { itemId: string; title: string; host: HTMLElement };

export default defineContentScript({
  matches: ["https://app.basecamp.com/*", "https://3.basecamp.com/*"],
  runAt: "document_idle",
  main(ctx) {
    let itemWidget: Widget | null = null;
    let itemMode: "inline" | "floating" | null = null;
    const rowWidgets = new Map<HTMLElement, Widget>();

    function ensureItemWidget(next: "inline" | "floating", anchor: HTMLElement | null) {
      if (itemWidget && itemMode === next && itemWidget.host.isConnected) return itemWidget;
      itemWidget?.destroy();
      itemMode = next;
      itemWidget =
        next === "inline"
          ? createWidget({ placement: "below" })
          : createWidget({ placement: "above", floating: true });
      if (next === "inline" && anchor) {
        itemWidget.host.style.marginRight = "8px";
        itemWidget.host.style.alignSelf = "center";
        anchor.prepend(itemWidget.host);
      } else {
        document.body.append(itemWidget.host);
      }
      return itemWidget;
    }

    function itemScan() {
      const item = currentBasecampItem();
      if (!item) {
        itemWidget?.destroy();
        itemWidget = null;
        itemMode = null;
        return;
      }
      const anchor = findActionsAnchor();
      const w = ensureItemWidget(anchor ? "inline" : "floating", anchor);
      w.setItem({
        source: "BASECAMP",
        externalId: item.itemId,
        title: item.title,
        description: item.notes || undefined,
        context: { key: `basecamp:${item.projectId}`, label: item.projectName },
        project: { id: item.projectId, name: item.projectName },
      });
    }

    function syncRows(rows: Row[], projectId: string, projectName: string, mount: (widget: Widget, host: HTMLElement) => void) {
      const live = new Set(rows.map((r) => r.host));
      for (const [host, w] of rowWidgets) {
        if (!live.has(host) || !host.isConnected) {
          w.destroy();
          rowWidgets.delete(host);
        }
      }
      for (const row of rows) {
        let w = rowWidgets.get(row.host);
        if (!w) {
          w = createWidget({ placement: "below", mini: true });
          rowWidgets.set(row.host, w);
        }
        mount(w, row.host);
        w.setItem({
          source: "BASECAMP",
          externalId: row.itemId,
          title: row.title,
          context: { key: `basecamp:${projectId}`, label: projectName },
          project: { id: projectId, name: projectName },
        });
      }
    }

    function syncBoard(board: BasecampBoard) {
      syncRows(board.cards, board.projectId, board.projectName, (w, host) => {
        w.host.style.alignSelf = "flex-start";
        w.host.style.margin = "6px 0 0";
        const target = host.querySelector<HTMLElement>(".kanban-card__link") ?? host;
        if (w.host.parentElement !== target) target.append(w.host);
      });
    }

    function syncTodoList(list: BasecampTodoList) {
      syncRows(list.todos, list.projectId, list.projectName, (w, host) => {
        w.host.style.margin = "0 0 0 8px";
        w.host.style.verticalAlign = "middle";
        const target = host.querySelector<HTMLElement>(".todo__content") ?? host;
        if (w.host.parentElement !== target) target.append(w.host);
      });
    }

    function dropItem() {
      if (itemWidget) {
        itemWidget.destroy();
        itemWidget = null;
        itemMode = null;
      }
    }

    function scan() {
      const board = currentBasecampBoard();
      if (board) {
        dropItem();
        syncBoard(board);
        return;
      }
      const todoList = currentBasecampTodoList();
      if (todoList) {
        dropItem();
        syncTodoList(todoList);
        return;
      }
      if (rowWidgets.size) {
        for (const w of rowWidgets.values()) w.destroy();
        rowWidgets.clear();
      }
      itemScan();
    }

    watchPage(ctx, scan, { throttleMs: 600 });
    ctx.onInvalidated(() => {
      itemWidget?.destroy();
      for (const w of rowWidgets.values()) w.destroy();
    });
  },
});
