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

- [ ] **Task 13.2: Setup Google Cloud Console OAuth App**
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

- [ ] **Task 18.4: Verifikasi End-to-End Flow**
  - Login Basecamp → konek Google → lihat event hari ini & tasks → pilih project → start timer → stop → cek timesheet di Basecamp.
  - Test auto-switch: start Google item saat Basecamp timer berjalan → timer lama auto-stop.
  - Test auto-stop cron pada timer dari Google source.

---
*Catatan: Open questions dari PRD (seperti retry strategy detail atau endpoint assignment) dapat dievaluasi lebih dalam saat memasuki Phase 4 dan Phase 7.*
