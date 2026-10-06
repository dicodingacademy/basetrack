import { defineGFileContent } from "../content/gfiles";

export default defineGFileContent({
  matches: ["https://docs.google.com/presentation/*"],
  source: "GOOGLE_SLIDES",
  kind: "presentation",
  contextPrefix: "gslides",
  contextLabel: "this presentation",
});
