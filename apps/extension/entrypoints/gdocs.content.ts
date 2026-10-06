import { defineGFileContent } from "../content/gfiles";

export default defineGFileContent({
  matches: ["https://docs.google.com/document/*"],
  source: "GOOGLE_DOCS",
  kind: "document",
  contextPrefix: "gdocs",
  contextLabel: "this document",
});
