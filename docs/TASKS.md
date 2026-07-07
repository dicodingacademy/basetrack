# Implementation Tasks: Basecamp Time Tracker

Berdasarkan `docs/PRD.md`, berikut adalah ekstraksi tugas (tasks) yang detail dan diurutkan secara logis agar proses implementasi lebih mudah dilakukan.

## Phase 1: Project Setup & Monorepo Infrastructure
- [x] **Task 1.1: Setup NPM Workspaces**
  - Inisialisasi root `package.json` dengan konfigurasi `npm workspaces` (misal: `"workspaces": ["apps/*", "packages/*"]`).
  - Siapkan folder `apps/` (untuk service utama) dan `packages/` (untuk shared logic/config jika diperlukan).
- [x] **Task 1.2: Setup Tracker App (React Router v7)**
  - Inisialisasi project React Router v7 (framework mode) di dalam folder `apps/tracker`.
  - Install dan konfigurasi Tailwind CSS beserta `shadcn/ui` di `apps/tracker`.
- [x] **Task 1.3: Setup Standalone WebSocket Server**
  - Inisialisasi service Node.js terpisah di dalam folder `apps/ws` untuk WebSocket (menggunakan `ws` atau `socket.io`), berjalan di port `3001`.
- [x] **Task 1.4: Setup Database & ORM**
  - Buat `docker-compose.yml` di root project untuk PostgreSQL.
  - Install Prisma ORM. (Sangat disarankan menempatkan Prisma di root atau shared package agar tipe DB bisa dipakai bersama oleh `tracker` dan `ws`).

## Phase 2: Database Schema & Models
- [x] **Task 2.1: Definisikan Prisma Schema**
  - Buat model `User` (termasuk access/refresh token & expiration).
  - Buat model `Session` untuk manajemen login.
  - Buat model `ActiveTimer` (1 to 1 relation dengan User).
  - Buat model `TimeEntry` dengan enum `StopReason` (MANUAL, WEBSOCKET_TIMEOUT) dan `SyncStatus` (PENDING, SYNCED, FAILED).
- [x] **Task 2.2: Database Migration**
  - Jalankan Prisma migration untuk membuat tabel-tabel di database Postgres.

## Phase 3: Basecamp OAuth & Authentication
- [x] **Task 3.1: Konfigurasi Launchpad App**
  - Setup OAuth App di 37signals Launchpad untuk mendapatkan `client_id` dan `client_secret`.
  - Simpan secrets di file `.env`.
- [x] **Task 3.2: Implementasi Login Route**
  - Buat endpoint/route untuk redirect user ke URL authorization Launchpad:
    `GET https://launchpad.37signals.com/authorization/new?type=web_server&client_id=...&redirect_uri=...`
- [x] **Task 3.3: Implementasi OAuth Callback**
  - Buat handler untuk menerima `code` dari Launchpad.
  - Lakukan pertukaran token:
    `POST https://launchpad.37signals.com/authorization/token` (dengan grant_type `authorization_code`).
- [x] **Task 3.4: Fetch Account Info & Create Session**
  - Ambil data akun Basecamp:
    `GET https://launchpad.37signals.com/authorization.json`
  - Ambil Account ID (product: "bc3") dan gunakan URL `href`-nya sebagai base URL API.
  - Simpan/Update data `User` di database (termasuk token) dan buat record `Session`.
- [x] **Task 3.5: Token Refresh Logic (Utility)**
  - Buat helper function untuk melakukan refresh token jika access_token mendekati expired:
    `POST https://launchpad.37signals.com/authorization/token` (dengan grant_type `refresh_token`).

## Phase 4: Basecamp API Integrations (Server-side)
- [x] **Task 4.1: Fetch My Assignments API**
  - Implementasi fungsi untuk memanggil `GET /my/assignments.json`.
  - Parsing response dan ekstrak `priorities` & `non_priorities`.
- [x] **Task 4.2: Create Timesheet API**
  - Implementasi fungsi untuk memanggil `POST /recordings/{RECORDING_ID}/timesheet/entries.json`.
  - (Sesuai catatan PRD, pelajari payload yang benar untuk create timesheet entry dari API spec `timesheets.md`).

## Phase 5: UI/UX - Dashboard & Timer
- [x] **Task 5.1: Build Dashboard Layout**
  - Buat halaman utama dengan loader yang memanggil *Task 4.1*.
  - Tampilkan To-do list dan kelompokkan berdasarkan Project.
- [x] **Task 5.2: Komponen Timer**
  - Buat UI button "Start" dan "Stop".
  - Buat komponen display elapsed time (`HH:MM:SS`) yang berjalan setiap detik di sisi client jika timer aktif.
- [x] **Task 5.3: Start Timer Action**
  - Buat action route di React Router saat user klik "Start".
  - Logika: Hapus `ActiveTimer` lama (jika ada), lalu insert `ActiveTimer` baru ke database.
- [x] **Task 5.4: Stop Timer Action**
  - Buat action route saat user klik "Stop".
  - Logika: Ambil `ActiveTimer`, hapus dari DB, lalu insert ke tabel `TimeEntry` dengan status `PENDING` dan `stopReason: MANUAL`.

## Phase 6: Background Cron & Auto-Stop
- [x] **Task 6.1: Setup Cron Server**
  - Repurpose `apps/ws` menjadi `apps/cron` (atau biarkan sebagai worker service).
  - Setup `node-cron` atau `setInterval` untuk berjalan setiap menit.
- [x] **Task 6.2: Auto-Stop Logic**
  - Worker mencari `ActiveTimer` yang durasinya (`Date.now() - startedAt`) sudah melebihi `autoStopThresholdHours` milik `User`.
  - Hapus timer tersebut dan ubah menjadi `TimeEntry` dengan status `syncStatus: NEEDS_APPROVAL` dan `stopReason: AUTO_STOPPED`.
- [x] **Task 6.3: UI Pending Approval**
  - Tambahkan section di Dashboard untuk menampilkan daftar `TimeEntry` berstatus `NEEDS_APPROVAL`.
  - User bisa mengedit durasi/jam, lalu klik "Approve & Sync" untuk mengubahnya menjadi `PENDING` dan dikirim ke Basecamp.

## Phase 7: Sync ke Basecamp (Selesai secara Synchronous)
- [x] **Task 7.1: Sync Worker / Action**
  - Diimplementasikan secara langsung (synchronous) pada aksi `stopTimer` dan `approveTimeEntry`.
- [x] **Task 7.2: Handle Sync Result**
  - Database langsung diupdate menjadi `SYNCED` atau `FAILED` sesuai hasil respons dari Basecamp API.
- [x] **Task 7.3: Retry Mechanism**
  - Di-skip untuk V1. Jika gagal, User bisa melakukan penyesuaian manual (atau fitur retry bisa ditambahkan di versi berikutnya).

## Phase 8: API Key Authentication (Backend & Web UI)
- [x] **Task 8.1: Update Database Schema**
  - Update `schema.prisma` untuk menambahkan kolom `desktopApiKey` pada entitas `User`.
  - Jalankan `npm run db:migrate` untuk meng-apply perubahan.
- [x] **Task 8.2: API Key Management API**
  - Buat endpoint di `apps/tracker` untuk me-return API Key *current user*.
  - Buat endpoint untuk me-reset/generate ulang API Key.
- [x] **Task 8.3: Web Settings UI**
  - Buat halaman/modal Settings di web dashboard.
  - Tampilkan API Key ke user agar bisa di-copy ke Desktop App.

## Phase 9: WebSocket Server Infrastructure (Backend)
- [x] **Task 9.1: Inisialisasi WebSocket Server**
  - Install dependensi `ws` di `apps/ws` sebagai service mandiri.
- [x] **Task 9.2: WebSocket Authentication**
  - Saat ada koneksi baru, wajibkan klien mengirim API Key. Validasi API Key tersebut terhadap tabel `User` di database.
  - Tolak koneksi (disconnect) jika API Key tidak valid.
- [x] **Task 9.3: Event Broadcasting Logic**
  - Buat mekanisme internal endpoint (`/internal/broadcast`) untuk melakukan *broadcast* event (`TIMER_STARTED`, `TIMER_STOPPED`).
  - Update action route web (saat user tekan Start/Stop di browser) dan worker cron (saat auto-stop) agar memicu broadcast ini ke semua *client* WebSocket yang sedang login.

## Phase 10: Desktop Companion App Initialization (Tauri)
- [x] **Task 10.1: Scaffold Project**
  - Buat project React+Vite di `apps/desktop`.
  - Install framework Tauri (`npm create tauri-app@latest`).
  - Konfigurasi `package.json` agar terintegrasi dengan root *workspaces*.
- [x] **Task 10.2: Konfigurasi Native Window**
  - Edit `tauri.conf.json`.
  - Set ukuran window menjadi mini (contoh: 300x120px).
  - Hilangkan tombol close/minimize bawaan OS (`decorations: false`).
  - Set window selalu muncul di depan (`alwaysOnTop: true`).

## Phase 11: Desktop Auth & WebSocket Client
- [x] **Task 11.1: API Key Form UI**
  - Buat tampilan awal Desktop App yang meminta user memasukkan API Key dari Web.
  - Simpan API Key secara persisten di lokal komputer (via `localStorage` atau Tauri store).
- [x] **Task 11.2: Koneksi WebSocket Client**
  - Tulis logika di *frontend* Desktop untuk menghubungi WebSocket Server menggunakan API Key.
  - Berikan indikator koneksi (titik hijau/merah) di UI desktop.
- [x] **Task 11.3: Reaksi Terhadap Event Server**
  - Sinkronkan *state* lokal (durasi timer, teks project/to-do) jika WebSocket menerima broadcast `TIMER_STARTED` atau `TIMER_STOPPED`.

## Phase 12: Desktop Timer Control (Write Operations)
- [x] **Task 12.1: UI Komponen Timer**
  - Buat tombol "Start" dan "Stop" berukuran proporsional untuk *widget* desktop.
  - Buat tampilan angka timer (`HH:MM:SS`) yang detiknya bertambah di sisi klien (optimistic UI).
- [x] **Task 12.2: Eksekusi Perintah ke Server**
  - Saat tombol "Start"/"Stop" ditekan di desktop, kirim request ke API server web (dengan header Authorization berisi API Key) untuk memodifikasi database.
  - Server yang memodifikasi database kemudian otomatis menjalankan *Task 9.3* (Broadcasting), sehingga Desktop dan Web tetap konsisten.

## Phase 13: Google OAuth & Token Management

- [x] **Task 13.1: Update Prisma Schema (Google Token Columns)**
  - Tambah kolom `googleAccessToken String?`, `googleRefreshToken String?`, `googleTokenExpiresAt DateTime?` pada model `User`.
  - Migration: `20260706131251_add_google_tokens`.

- [x] **Task 13.2: Setup Google Cloud Console OAuth App**
  - Buat OAuth 2.0 Web Application di Google Cloud Console.
  - Dapatkan `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET`.
  - Tambahkan `http://localhost:5173/auth/google/callback` ke Authorized Redirect URIs.
  - Simpan secrets di `.env`.

- [x] **Task 13.3: Create Google OAuth Utility (`google.server.ts`)**
  - `apps/tracker/app/utils/google.server.ts`.
  - Fungsi: `getGoogleAuthUrl(state)`, `exchangeGoogleCode(code)`, `refreshGoogleToken(refreshToken)`, `getValidGoogleToken(userId)`, `disconnectGoogle(userId)`, `revokeGoogleToken(accessToken)`.

- [x] **Task 13.4: Google OAuth Route - Authorization**
  - `apps/tracker/app/routes/auth.google.tsx`.
  - Generate CSRF `state`, simpan di cookie session, redirect ke Google OAuth URL.
  - Scopes: `calendar.readonly`, `tasks.readonly`.

- [x] **Task 13.5: Google OAuth Route - Callback**
  - `apps/tracker/app/routes/auth.google.callback.tsx`.
  - Validasi CSRF `state`, exchange `code` → token, simpan ke DB.
  - Hanya bisa jika user sudah login Basecamp.

- [x] **Task 13.6: Register New Routes**
  - `apps/tracker/app/routes.ts`: tambah route `auth/google` dan `auth/google/callback`.

- [x] **Task 13.7: Update SettingsModal - Connect Google**
  - Section "Google Integration" di SettingsModal.
  - Status koneksi (Connected/Not connected).
  - Tombol "Connect Google Account" / "Disconnect Google".
  - Intent `DISCONNECT_GOOGLE` di action `home.tsx`.

## Phase 14: Google Calendar API Integration

- [x] **Task 14.1: Fetch Calendar Events**
  - `fetchCalendarEvents(accessToken, date)` di `google.server.ts`.
  - `GET /calendar/v3/calendars/primary/events` — timeMin/Max today, singleEvents, orderBy startTime.
  - Filter: exclude cancelled events.

- [x] **Task 14.2: Fetch Task Lists & Tasks**
  - `fetchTaskLists(accessToken)` → `GET /tasks/v1/users/@me/lists`.
  - `fetchTasks(accessToken, taskListId)` → `GET /tasks/v1/lists/{id}/tasks` — hide completed & hidden.
  - Return: `{ id, title }[]` untuk lists, `{ id, title, notes, due }[]` untuk tasks.

- [x] **Task 14.3: Define Google TypeScript Types**
  - `apps/tracker/app/types/google.ts`: `GoogleCalendarEvent`, `GoogleTaskList`, `GoogleTask`, `TimerSource`.

## Phase 15: Database Schema Update (Source Tracking)

- [x] **Task 15.1: Tambah Enum TimerSource**
  - Enum `TimerSource` di `schema.prisma`: `BASECAMP`, `GOOGLE_CALENDAR`, `GOOGLE_TASKS`.

- [x] **Task 15.2: Tambah Kolom `source` ke ActiveTimer & TimeEntry**
  - `ActiveTimer`: tambah field `source String @default("BASECAMP")`.
  - `TimeEntry`: tambah field `source String @default("BASECAMP")`.

## Phase 16: Update Timer Service (Multi-Source)

- [x] **Task 16.1: Update `startTimer` Function**
  - Parameter `source` opsional (default `BASECAMP`), disimpan ke `ActiveTimer.source`.

- [x] **Task 16.2: Update `stopTimer` Function**
  - Copy `source` dari `ActiveTimer` ke `TimeEntry`.
  - Cron auto-stop juga copy `source`.

## Phase 17: UI - Source Tabs & Google Items

- [x] **Task 17.1: Create ProjectPickerModal Component**
  - `apps/tracker/app/components/home/ProjectPickerModal.tsx`.
  - Dialog daftar project timesheet-enabled. OnClick project → callback + tutup modal.

- [x] **Task 17.2: Create GoogleItemCard Component**
  - `apps/tracker/app/components/home/GoogleItemCard.tsx`.
  - Menampilkan Calendar event / Task, source icon, waktu/due date.
  - Tombol Start → ProjectPickerModal → submit Form `START_GOOGLE_TIMER`.

- [x] **Task 17.3: Add Source Tabs to Home Dashboard**
  - Tab navigasi di `home.tsx` header: Basecamp | Calendar | Tasks.
  - Tab "Basecamp": sidebar project + TaskCard (existing).
  - Tab "Calendar": GoogleItemCard untuk event hari ini.
  - Tab "Tasks": GoogleItemCard untuk Google Tasks.

- [x] **Task 17.4: Update Loader in `home.tsx`**
  - Fetch `timesheetProjects` dari `fetchProjectDetails` (filter `timesheet_enabled`).
  - Fetch Google Calendar events (hari ini) jika user terkoneksi Google.
  - Fetch Google Tasks jika user terkoneksi Google.
  - Return `timesheetProjects`, `calendarEvents`, `googleTasks`.

- [x] **Task 17.5: Add Action Intent `START_GOOGLE_TIMER`**
  - Handle intent di `action()`: source, itemId, itemTitle, projectId, projectName.
  - Panggil `startTimer(user.id, { ..., source })`.

- [x] **Task 17.6: Update ActiveTimerCard**
  - Badge source (Calendar icon / CheckSquare icon) di samping project name.
  - Hanya tampil jika source bukan BASECAMP.

## Phase 18: Polish & Edge Cases

- [x] **Task 18.1: Google Token Refresh di Cron Service**
  - Tidak diperlukan — cron hanya query `ActiveTimer` dari DB, tidak panggil Google API.

- [x] **Task 18.2: Error Handling Google API**
  - Semua Google API call di loader dibungkus try/catch — return empty array jika gagal.
  - Empty state UI: Calendar kosong ("No events today"), Tasks kosong ("No pending tasks"), Google not connected.
  - Token refresh otomatis via `getValidGoogleToken()` (5 menit sebelum expire).

- [x] **Task 18.3: Disconnect Google**
  - Intent `DISCONNECT_GOOGLE` di action `home.tsx` → `disconnectGoogle(userId)`.
  - Nullify token di DB + revoke via Google API.

- [x] **Task 18.4: Verifikasi End-to-End Flow**
  - Login Basecamp → konek Google → lihat event hari ini & tasks → pilih project → start timer → stop → cek timesheet di Basecamp.
  - Test auto-switch: start Google item saat Basecamp timer berjalan → timer lama auto-stop.
  - Test auto-stop cron pada timer dari Google source.

## Phase 19: Dynamic Auto-Stop Rules — Database Schema

- [x] **Task 19.1: Tambah Field `timezone` pada Model `User`**
  - Tambah kolom `timezone String @default("Asia/Jakarta")` pada model `User` di `packages/db/prisma/schema.prisma`.
  - Digunakan oleh cron untuk mengkonversi waktu UTC ke zona waktu user saat evaluasi kondisi `time_of_day` dan `day_of_week`.

- [x] **Task 19.2: Tambah Model `AutoStopRule`**
  - Buat model `AutoStopRule` di `packages/db/prisma/schema.prisma` dengan struktur:
    ```
    id         String   @id @default(uuid())
    userId     String
    enabled    Boolean  @default(true)
    name       String?
    conditions Json     // [{ "type": "...", "operator": "...", "value": ... }, ...]
    createdAt  DateTime @default(now())
    updatedAt  DateTime @updatedAt
    ```
  - Relasi: `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`.
  - Index pada `userId`.

- [x] **Task 19.3: Migrasi Data dari Threshold Lama**
  - Buat Prisma migration yang membaca nilai `autoStopThresholdHours` setiap user.
  - Untuk setiap user, buat 1 default `AutoStopRule` dengan kondisi:
    `[{ "type": "elapsed_hours", "operator": "gte", "value": <threshold_lama> }]`.
  - Hapus kolom `autoStopThresholdHours` dari model `User`.

- [x] **Task 19.4: Update Enum `StopReason` (Verifikasi)**
  - Enum `StopReason` sudah memiliki nilai `AUTO_STOPPED`. Verifikasi tidak ada perubahan tambahan yang diperlukan.

## Phase 20: Dynamic Auto-Stop Rules — Service & Route

- [ ] **Task 20.1: Buat Service `rules.server.ts`**
  - File: `apps/tracker/app/services/rules.server.ts`.
  - Fungsi:
    - `getRules(userId)` → fetch semua rule milik user, ordered by `createdAt`.
    - `saveRule(userId, id?, data)` → upsert rule (create jika `id` null, update jika `id` ada). Data: `{ name, enabled, conditions }`.
    - `deleteRule(ruleId, userId)` → hapus rule, pastikan ownership via `userId`.
    - `updateUserTimezone(userId, timezone)` → update `User.timezone`.

- [ ] **Task 20.2: Tambah Intent Handlers di `home.tsx`**
  - Intent `SAVE_RULE`:
    - Parse `ruleId` (null untuk create, ada string untuk update).
    - Parse `name` (string), `enabled` (boolean dari checkbox, default true).
    - Parse `conditions` dari formData (sebagai JSON string, lalu `JSON.parse`).
    - Panggil `saveRule(user.id, ruleId, { name, enabled, conditions })`.
  - Intent `DELETE_RULE`:
    - Parse `ruleId`.
    - Panggil `deleteRule(ruleId, user.id)`.
  - Intent `UPDATE_TIMEZONE`:
    - Parse `timezone` dari formData (string seperti `"Asia/Jakarta"`).
    - Panggil `updateUserTimezone(user.id, timezone)`.

- [ ] **Task 20.3: Update Loader di `home.tsx`**
  - Fetch `rules` via `getRules(user.id)`.
  - Return `rules` dan `user.timezone` dalam loader response.
  - Hapus return `user.autoStopThresholdHours`.

## Phase 21: Dynamic Auto-Stop Rules — Cron Rewrite

- [ ] **Task 21.1: Install Timezone Library di Cron**
  - Install `luxon` di `apps/cron/package.json` untuk konversi timezone (alternatif: `date-fns-tz`).

- [ ] **Task 21.2: Rewrite Evaluasi Auto-Stop**
  - File: `apps/cron/index.js`.
  - Logika baru menggantikan pengecekan sederhana `elapsedHours >= thresholdHours`:
    1. Fetch `ActiveTimer` dengan include `user` (`timezone`) dan `user.rules` (filter `enabled: true`).
    2. Konversi `now` (UTC) ke waktu lokal user menggunakan `luxon.DateTime.now().setZone(user.timezone)`.
    3. Untuk setiap rule, evaluasi semua kondisi (AND logic):
       - `elapsed_hours` / `gte`: hitung `elapsedMs` dari `timer.startedAt` ke `now`, konversi ke jam, bandingkan dengan `value`.
       - `time_of_day` / `gte`: bandingkan `nowInUserTz` dalam format HH:MM dengan `value`.
       - `time_of_day` / `lte`: bandingkan `nowInUserTz` dalam format HH:MM dengan `value`.
       - `time_of_day` / `between`: cek apakah `nowInUserTz` dalam rentang `value[0]` - `value[1]`. Jika `value[0] > value[1]` (overnight range), kondisi true jika `now >= value[0]` ATAU `now <= value[1]`.
       - `day_of_week` / `in`: cek apakah hari ini (0=Minggu, 1=Senin, ..., 6=Sabtu) termasuk dalam array `value`.
    4. Jika semua kondisi dalam satu rule terpenuhi → auto-stop timer.
    5. Jika tidak ada rule yang match, timer tetap berjalan.

- [ ] **Task 21.3: Verifikasi Notifikasi WebSocket Tetap Jalan**
  - Pastikan setelah rewrite, panggilan `notifyWebSocketServer` dengan event `TIMER_AUTO_STOPPED` tetap berfungsi.
  - Tidak ada perubahan pada format event atau endpoint broadcast.

## Phase 22: Dynamic Auto-Stop Rules — UI Rule Builder

- [ ] **Task 22.1: Buat Komponen `ConditionRow.tsx`**
  - File: `apps/tracker/app/components/home/ConditionRow.tsx`.
  - Props: `condition`, `index`, `onChange`, `onRemove`.
  - Render satu baris kondisi:
    - Dropdown tipe kondisi (`elapsed_hours`, `time_of_day`, `day_of_week`).
    - Dropdown operator (tergantung tipe: `gte`, `lte`, `between`, `in`).
    - Input value (tergantung tipe+operator): number input, time input, atau multi-select hari.
    - Tombol hapus (✕).

- [ ] **Task 22.2: Buat Komponen `RuleCard.tsx`**
  - File: `apps/tracker/app/components/home/RuleCard.tsx`.
  - Props: `rule`, `onSave`, `onDelete`.
  - Render satu kartu rule:
    - Header: toggle enable/disable, input nama rule, tombol delete.
    - Body: daftar `ConditionRow` untuk setiap kondisi.
    - Footer: tombol `+ Add Condition`.
  - State lokal untuk optimistic editing via `fetcher.submit` (intent `SAVE_RULE`).

- [ ] **Task 22.3: Buat Komponen `RuleList.tsx`**
  - File: `apps/tracker/app/components/home/RuleList.tsx`.
  - Props: `rules`, `userTimezone`.
  - Render daftar `RuleCard` + tombol "+ Add Rule" di atas.
  - Rule baru dibuat dengan 1 kondisi default (`elapsed_hours >= 8`).

- [ ] **Task 22.4: Update `SettingsModal.tsx`**
  - Hapus input `autoStopThresholdHours` dan label terkait.
  - Ganti props `defaultAutoStopHours` → `rules`, `userTimezone`.
  - Tambah section "Auto-Stop Rules" yang merender `RuleList`.
  - Kirim timezone browser saat dialog dibuka (deteksi `Intl.DateTimeFormat`).

## Phase 23: Dynamic Auto-Stop Rules — Timezone Detection

- [ ] **Task 23.1: Deteksi & Simpan Timezone Browser**
  - Di `SettingsModal.tsx`, saat mount, baca `Intl.DateTimeFormat().resolvedOptions().timeZone`.
  - Jika berbeda dengan `user.timezone` dari loader, kirim intent `UPDATE_TIMEZONE` via `fetcher.submit`.
  - Gunakan `useFetcher` agar tidak trigger navigasi.

## Phase 24: Dynamic Auto-Stop Rules — Cleanup

- [ ] **Task 24.1: Hapus Referensi Threshold Lama**
  - Hapus fungsi `updateUserSettings()` dari `apps/tracker/app/services/user.server.ts` jika tidak lagi digunakan untuk field lain.
  - Hapus parsing `autoStopThresholdHours` di intent `UPDATE_SETTINGS` pada action `home.tsx`.

- [ ] **Task 24.2: Evaluasi Intent `UPDATE_SETTINGS`**
  - Jika intent `UPDATE_SETTINGS` sudah tidak punya tanggung jawab lain (semua diganti intent spesifik: `SAVE_RULE`, `DELETE_RULE`, `GENERATE_API_KEY`, `DISCONNECT_GOOGLE`, `UPDATE_TIMEZONE`), hapus intent tersebut.

- [ ] **Task 24.3: Verifikasi End-to-End Dynamic Rules**
  - Buat 2-3 rule dengan kombinasi kondisi berbeda.
  - Start timer → tunggu cron detect → pastikan auto-stop terjadi sesuai rule yang match.
  - Verifikasi rule overnight range bekerja (22:00-02:00).
  - Verifikasi day filter bekerja (rule hanya aktif di hari tertentu).
  - Verifikasi enable/disable rule (rule disabled tidak trigger auto-stop).
  - Verifikasi edit rule langsung berefek di cron berikutnya.
  - Verifikasi WebSocket notification `TIMER_AUTO_STOPPED` diterima UI dan trigger revalidate.

---
*Catatan: Open questions dari PRD (seperti retry strategy detail atau endpoint assignment) dapat dievaluasi lebih dalam saat memasuki Phase 4 dan Phase 7.*
