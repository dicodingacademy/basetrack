import { browser } from "wxt/browser";
import type { Message, ProjectsResponse, SimpleResponse, StartResponse, StateResponse } from "./types";

type ResponseFor<M extends Message> = M extends { type: "getState" }
  ? StateResponse
  : M extends { type: "getProjects" }
    ? ProjectsResponse
    : M extends { type: "start" }
      ? StartResponse
      : SimpleResponse;

export function send<M extends Message>(message: M): Promise<ResponseFor<M>> {
  return browser.runtime.sendMessage(message) as Promise<ResponseFor<M>>;
}
