# Changelog

## [0.2.0] - 2026-10-06

### Added
- Google Sheets support: start a timer from a spreadsheet's title bar (context `gsheets:<id>`).
- Google Slides support: same for presentations (context `gslides:<id>`).
- GitHub Projects: the Start button now sits next to the item's state badge in the side pane (falls back to the floating pill when there is no state badge, e.g. drafts).

### Changed
- Google Docs widget moved next to the Share button; Docs, Sheets and Slides share one content-script and the widget is sized to match the Share button.

### Fixed
- Google Calendar: the Start button no longer blinks when the event popover opens or when switching between events.
- Widget no longer flashes a "Connect…" placeholder before its stored state is read.
- Hardened DOM scanning: Calendar uses stable hooks (`[role="dialog"][data-chips-dialog]`, `[role="heading"]`) instead of obfuscated ids, and a stale or malformed selector no longer aborts the page scan.

### Notes
- Sheets and Slides sources must also be registered on the Basetrack server (`EXTENSION_SOURCES` / source metadata).
- The Chrome/Firefox builds read `WXT_BASETRACK_URL` at build time.
