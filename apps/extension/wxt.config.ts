import { defineConfig } from "wxt";
import { SITE_ORIGINS } from "./lib/sites";

// Public key that pins the Chrome extension ID (load unpacked) to
// eckbdmbimjfcecoklehepjbogmhnkooe, so the OAuth redirect URL stays stable:
// https://eckbdmbimjfcecoklehepjbogmhnkooe.chromiumapp.org/
const CHROME_PUBLIC_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuCbtsxtpejL+sagZeJsXaQ0YE+h2bEZb/OrhUf5coNMTl35Q7klAMwt9gbEoH1A3j0vypHI2rH+tisvjlAbRd2kKBcMfttGW5fhVtuaLhe+fiQ7EtlMGr7hh6iqVDng/PV4yWG1JTbi5C9pZgP+JGl/lj8Jx+mJX+80cnWuy/+8fn1du9Gc/h9bZqe1A4W8j1dr+cWxfednCFg23ZcrJvyiyZRF8/hOnw7qyO+AwJGJSBIdQ5lBngTqlZ7ErJqksmJ6AQHTAVy+XDHYkcFNUVANXuehhPJNJpAGpGjw+lMC3vy3rn6xlD7noMApzyB8L7Wk8KCWGi++AQSDbnQQ9iQIDAQAB";

// Firefox derives the redirect URL from this ID:
// https://b4edfe9ac7382a51c1341b4ba0fbdc6d85ff2b60.extensions.allizom.org/
const GECKO_ID = "extension@basetrack.dev";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: ({ browser }) => {
    const baseUrl = (import.meta.env.WXT_BASETRACK_URL || "http://localhost:5173").replace(/\/+$/, "");
    const origin = `${new URL(baseUrl).origin}/*`;

    return {
      name: "Basetrack",
      description: "Start Basetrack timers from Basecamp, Google Calendar, Docs, Sheets, Slides and GitHub Projects.",
      permissions: ["identity", "storage", "alarms"],
      host_permissions: [origin, ...SITE_ORIGINS],
      action: { default_title: "Basetrack" },
      ...(browser === "firefox"
        ? {
            browser_specific_settings: {
              gecko: {
                id: GECKO_ID,
                strict_min_version: "128.0",
                // Page titles (events, docs, issues) are sent to the Basetrack server.
                data_collection_permissions: { required: ["websiteContent"] },
              },
            },
          }
        : { key: CHROME_PUBLIC_KEY }),
    };
  },
});
