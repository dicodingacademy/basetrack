# Basetrack Extension

Extension browser (Chrome + Firefox, Manifest V3) untuk memulai timer Basetrack langsung dari:

| Situs | Tempat tombol muncul | ID item (`todoId`) | Konteks mapping |
|---|---|---|---|
| Google Calendar | di dalam popover detail event; pill mengambang di halaman edit event | event id hasil decode `data-eventid` | `gcal:<calendarId>` |
| Google Docs | di title bar, sebelah judul dokumen (fallback: pill mengambang) | docId dari URL | `gdocs:<docId>` |
| GitHub Org Projects | di side pane item, sebelah badge status (fallback: pill mengambang) | `owner/repo#123` atau `draft:<itemId>` | `gh:<org>/<nomor project>` |

Semua request ke Basetrack lewat background script. Content script hanya membaca halaman dan mengirim pesan ke background.

## Setup

```bash
# dari root repo
npm install
cp apps/extension/.env.example apps/extension/.env   # set WXT_BASETRACK_URL
npm run build -w @basetrack/extension          # → apps/extension/.output/chrome-mv3
npm run build:firefox -w @basetrack/extension  # → apps/extension/.output/firefox-mv3
```

`WXT_BASETRACK_URL` dibaca saat build: dipakai untuk API call dan `host_permissions`. Ganti URL berarti build ulang dan reload extension.

Mode dev dengan hot reload: `npm run dev -w @basetrack/extension` (Chrome) atau `npm run dev:firefox -w @basetrack/extension`.

## Konfigurasi server

Tambahkan kedua redirect URL ini ke env tracker, `EXTENSION_REDIRECT_URIS` (dipisah koma):

```
EXTENSION_REDIRECT_URIS=https://eckbdmbimjfcecoklehepjbogmhnkooe.chromiumapp.org/,https://b4edfe9ac7382a51c1341b4ba0fbdc6d85ff2b60.extensions.allizom.org/
```

- **Chrome**: ID dikunci lewat field `key` di manifest (`wxt.config.ts`), jadi selalu `eckbdmbimjfcecoklehepjbogmhnkooe` walaupun di-load unpacked dari folder mana pun.
- **Firefox**: ID `extension@basetrack.dev` (`browser_specific_settings.gecko.id`). Redirect URL diturunkan dari SHA-1 ID tersebut.

Redirect URL yang benar-benar dipakai bisa dicek di halaman **Options → Connection details**.

## Install (load unpacked)

### Chrome / Edge / Brave
1. Buka `chrome://extensions`, aktifkan **Developer mode**.
2. **Load unpacked** → pilih `apps/extension/.output/chrome-mv3`.
3. Setelah build ulang, klik ikon reload di kartu extension.

### Firefox
1. Buka `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → pilih `apps/extension/.output/firefox-mv3/manifest.json`.
2. Kalau popup menampilkan **Grant access**, klik untuk memberi izin situs (Firefox MV3 bisa menahan host permission sampai disetujui user).

> **Catatan Firefox:** add-on temporary **hilang setiap Firefox di-restart**. Untuk instalasi permanen:
> - tanda tangani sebagai add-on *unlisted* lewat AMO (gratis, tidak dipublikasikan):
>   `npx web-ext sign --channel=unlisted --source-dir apps/extension/.output/firefox-mv3 --api-key=... --api-secret=...`
>   lalu install file `.xpi` yang dihasilkan; atau
> - pakai Firefox Developer Edition / Nightly / ESR dengan `xpinstall.signatures.required=false` di `about:config`, lalu install dari `npm run zip:firefox`.

## Cara pakai

1. Klik ikon Basetrack → **Connect to Basetrack**. Browser membuka halaman izin Basetrack (login Basecamp dulu kalau belum), lalu kembali ke extension.
2. Buka event, dokumen, atau item GitHub Project → klik **▶ Start**.
   - Kalau konteksnya sudah punya mapping, tombol menjadi **▶ Start · Nama Project**; klik ▾ untuk memilih project lain.
   - Kalau belum, picker project terbuka. Centang **Remember for …** supaya pilihan disimpan.
3. Kalau timer lain sedang jalan, server otomatis menghentikan dan menyimpannya (auto-switch).
4. **Options** (klik kanan ikon → Options, atau link di popup):
   - default project per sumber
   - daftar konteks yang pernah dipakai + project-nya
   - info koneksi (URL, redirect URL, extension ID)

Mapping disimpan di `storage.sync`, jadi ikut profil browser. Daftar konteks dan cache disimpan di `storage.local`.

## Struktur

```
entrypoints/
  background.ts         auth (PKCE + launchWebAuthFlow), API client, badge, cache
  popup/                status timer + Stop + Connect
  options/              mapping project & akun
  gcal.content.ts       Google Calendar
  gdocs.content.ts      Google Docs
  github.content.ts     GitHub Projects
content/
  widget.ts             tombol split + picker (Shadow DOM, vanilla TS)
  watch.ts              MutationObserver + polling URL untuk SPA
  sites/*.ts            selector per situs — BELUM diverifikasi di halaman asli
lib/                    api, storage, tipe, pkce, format
```

Selector DOM ada di `content/sites/*.ts`. Kalau Google/GitHub mengubah UI dan tombol tidak muncul, perbaiki di file tersebut.
