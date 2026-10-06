import { defineGFileContent } from "../content/gfiles";

export default defineGFileContent({
  matches: ["https://docs.google.com/spreadsheets/*"],
  source: "GOOGLE_SHEETS",
  kind: "spreadsheets",
  contextPrefix: "gsheets",
  contextLabel: "this spreadsheet",
});
