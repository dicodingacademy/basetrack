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

## Phase 7: Background Sync ke Basecamp
- [ ] **Task 7.1: Sync Worker / Action**
  - Buat sistem untuk memproses `TimeEntry` yang berstatus `PENDING`.
  - Ambil `TimeEntry` dari DB, dan panggil API *Task 4.2* untuk membuat timesheet di Basecamp.
- [ ] **Task 7.2: Handle Sync Result**
  - Jika Sukses: Update `SyncStatus` menjadi `SYNCED` dan simpan `basecampEntryId`.
  - Jika Gagal: Update menjadi `FAILED`.
- [ ] **Task 7.3: Retry Mechanism**
  - Buat logika untuk melakukan retry (maksimal 3x) pada entry yang `FAILED` sebelum akhirnya diabaikan atau butuh intervensi manual.

---
*Catatan: Open questions dari PRD (seperti retry strategy detail atau endpoint assignment) dapat dievaluasi lebih dalam saat memasuki Phase 4 dan Phase 7.*
