# PRD: Basecamp Time Tracker

## 1. Background & Problem Statement

Basecamp 4 tidak memiliki fitur time tracking native. Yang ada hanyalah fitur **Timesheet** — form manual yang harus diisi user setelah pekerjaan selesai. Proses ini ribet: user harus ingat berapa lama mereka mengerjakan sesuatu, lalu buka Basecamp, cari project yang tepat, isi form, submit.

Akibatnya, pencatatan waktu sering tidak akurat atau bahkan tidak dilakukan sama sekali.

**Solusi:** Aplikasi web yang memungkinkan user melakukan time tracking berbasis timer langsung dari To-do item Basecamp mereka, dengan auto-stop jika user tidak aktif, dan auto-submit ke Basecamp Timesheet saat selesai.

---

## 2. Goals

| # | Goal |
|---|------|
| G1 | User bisa start/stop timer pada To-do Basecamp tanpa meninggalkan app |
| G2 | Timer otomatis berhenti jika user tidak aktif (tab ditutup, laptop sleep, dll) |
| G3 | Setiap sesi yang berhenti tersimpan di database sebelum di-submit ke Basecamp |
| G4 | Submit timesheet ke Basecamp Timesheet dengan deskripsi yang di-generate otomatis |

## 3. Non-Goals (Explicit Out of Scope)

- ❌ Manual time entry / retroaktif input
- ❌ Edit atau delete time entry yang sudah di-submit ke Basecamp
- ❌ Multi-user / team visibility (siapa tracking apa)
- ❌ Reporting atau analytics
- ❌ Support Basecamp 3
- ❌ Mobile native app

---

## 4. User Stories

### Authentication
> **US-01:** Sebagai user, saya bisa login menggunakan akun Basecamp 4 (OAuth) agar data To-do saya bisa diakses.

### To-do List
> **US-02:** Sebagai user, setelah login saya melihat daftar To-do Basecamp yang di-assign ke saya, dikelompokkan per project.

### Timer
> **US-03:** Sebagai user, saya bisa klik "Start" pada sebuah To-do untuk memulai timer.

> **US-04:** Sebagai user, jika saya start To-do B saat To-do A sedang berjalan, timer A otomatis berhenti dan B mulai — tanpa konfirmasi.

> **US-05:** Sebagai user, saya bisa klik "Stop" untuk menghentikan timer yang sedang berjalan.

### Auto-stop
> **US-06:** Sebagai system, cron job berjalan berkala untuk mengecek timer yang aktif melebihi batas waktu (misal > 8 jam).
> **US-07:** Sebagai system, jika timer melebihi batas waktu, otomatis dihentikan dan masuk ke status `NEEDS_APPROVAL`.

### Submit ke Basecamp
> **US-08:** Sebagai user, setelah timer stop (manual atau auto), sesi time tracking di-submit otomatis ke Basecamp Timesheet dengan deskripsi berupa nama To-do item.

---

## 5. Functional Requirements

### 5.1 Auth (OAuth Basecamp 4)

| ID | Requirement |
|----|-------------|
| FR-01 | App menggunakan OAuth 2.0 Basecamp 4 untuk autentikasi |
| FR-02 | Access token dan refresh token disimpan di database (per user session) |
| FR-03 | Token di-refresh otomatis saat expired sebelum API call |

### 5.2 To-do List

| ID | Requirement |
|----|-------------|
| FR-04 | Fetch To-do items yang assigned ke user yang sedang login |
| FR-05 | To-do ditampilkan dikelompokkan per Project |
| FR-06 | Setiap To-do menampilkan: nama To-do, nama project, dan status timer (idle / running) |

### 5.3 Timer

| ID | Requirement |
|----|-------------|
| FR-07 | Hanya satu timer yang bisa aktif pada satu waktu per user |
| FR-08 | Saat user klik "Start" pada To-do B ketika To-do A sedang running, To-do A otomatis stop dan To-do B start — tanpa dialog konfirmasi |
| FR-09 | Timer menampilkan elapsed time dalam format `HH:MM:SS`, update setiap detik |
| FR-10 | State timer (To-do yang aktif, `started_at`) disimpan di Postgres |

### 5.4 Cron Auto-stop

| ID | Requirement |
|----|-------------|
| FR-11 | Terdapat Worker / Cron Service terpisah yang mengecek setiap menit |
| FR-12 | Mencari `ActiveTimer` yang telah berjalan melebihi `autoStopThresholdHours` milik User |
| FR-13 | Menghapus timer tersebut dan menyimpannya sebagai `TimeEntry` dengan status `NEEDS_APPROVAL` |
| FR-14 | `stopReason` di-set menjadi `AUTO_STOPPED` |
| FR-15 | User harus meng-approve time entry ini via UI sebelum di-sync ke Basecamp |

### 5.5 Multi-tab Behavior

| ID | Requirement |
|----|-------------|
| FR-16 | Semua tab yang membuka app bisa terkoneksi ke WebSocket server secara bersamaan |
| FR-17 | Perubahan state timer (start/stop) dari satu tab di-broadcast ke semua tab aktif milik user yang sama |
| FR-18 | Database adalah single source of truth; tab baru yang dibuka langsung fetch state dari DB |

### 5.6 Submit ke Basecamp Timesheet

| ID | Requirement |
|----|-------------|
| FR-19 | Setiap sesi timer yang berhenti (manual atau auto) tersimpan sebagai record di tabel `time_entries` dengan status `PENDING` |
| FR-20 | Setelah entry tersimpan, **server** (bukan client) langsung membuat timesheet baru di Basecamp menggunakan OAuth token milik user yang tersimpan di database |
| FR-21 | Client tidak perlu terlibat dalam proses submit ke Basecamp — seluruh API call ke Basecamp dilakukan server-side |
| FR-22 | Deskripsi timesheet entry di-generate otomatis dari nama To-do item |
| FR-23 | Jika POST ke Basecamp gagal (network error, rate limit, expired token), entry tetap tersimpan di DB dengan status `FAILED` dan di-retry oleh server (max 3x) tanpa intervensi client |

---

## 6. Data Model (Postgres via Prisma)

```prisma
model User {
  id            String       @id @default(cuid())
  basecampId    String       @unique
  name          String
  email         String
  accessToken   String
  refreshToken  String
  tokenExpiresAt DateTime
  createdAt     DateTime     @default(now())
  sessions      Session[]
  timeEntries   TimeEntry[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
  expiresAt DateTime
}

model ActiveTimer {
  id          String   @id @default(cuid())
  userId      String   @unique     // satu user, satu timer aktif
  user        User     @relation(fields: [userId], references: [id])
  todoId      String               // Basecamp To-do ID
  todoTitle   String
  projectId   String               // Basecamp Project ID
  projectName String
  startedAt   DateTime @default(now())
  lastPingAt  DateTime @default(now())
}

model TimeEntry {
  id            String          @id @default(cuid())
  userId        String
  user          User            @relation(fields: [userId], references: [id])
  todoId        String
  todoTitle     String
  projectId     String
  projectName   String
  startedAt     DateTime
  stoppedAt     DateTime
  durationSec   Int
  stopReason    StopReason      // MANUAL | AUTO_STOPPED
  syncStatus    SyncStatus      // NEEDS_APPROVAL | PENDING | SYNCED | FAILED
  basecampEntryId String?       // ID dari Basecamp setelah berhasil sync
  createdAt     DateTime        @default(now())
}

enum StopReason {
  MANUAL
  WEBSOCKET_TIMEOUT
  AUTO_STOPPED
}

enum SyncStatus {
  NEEDS_APPROVAL
  PENDING
  SYNCED
  FAILED
}
```

---

## 7. Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Client)                  │
│  React Router v7 (framework mode)                   │
│  - Loaders: fetch To-do list, timer state           │
│  - Actions: start/stop timer, submit timesheet      │
│  - UI: Tailwind + shadcn/ui                         │
│  - WebSocket client: ping-pong, state sync          │
└────────────────┬───────────────────┬────────────────┘
                 │ HTTP              │ WebSocket
                 ▼                   ▼
┌────────────────────┐   ┌──────────────────────────┐
│  React Router v7   │   │     Worker / Cron         │
│  (Node.js server)  │   │   (Standalone service)    │
│                    │   │                           │
│  - Auth (OAuth)    │   │  - Berjalan tiap menit    │
│  - API routes      │   │  - Cek ActiveTimer > X hr │
│  - Prisma Client   │   │  - Stop ke NEEDS_APPROVAL │
└────────────────────┘   └──────────────────────────┘
             │                         │
             └──────────┬──────────────┘
                        ▼
              ┌──────────────────┐
              │   Postgres DB    │
              │   (via Prisma)   │
              │                  │
              │  - users         │
              │  - active_timer  │
              │  - time_entries  │
              └──────────────────┘
```

### Service Breakdown (docker-compose)

| Service | Description |
|---------|-------------|
| `app` | React Router v7 server (port 3000) |
| `ws` | WebSocket server (port 3001) |
| `db` | Postgres (port 5432) |

---

## 8. Basecamp 4 API Integration

### OAuth Flow
- Authorization URL: `https://launchpad.37signals.com/authorization/new`
- Token URL: `https://launchpad.37signals.com/authorization/token`
- Scopes yang dibutuhkan: read To-dos, write Timesheet

### Endpoints yang Digunakan

| Action | Endpoint |
|--------|----------|
| Get user's accounts | `GET /authorization.json` |
| Get assigned To-dos | `GET /projects/{project_id}/todos/{todo_id}.json` (atau via People assignments) |
| Submit timesheet entry | `POST /projects/{project_id}/time_entries.json` |

### Timesheet Entry Payload
```json
{
  "date": "2026-07-03",
  "hours": 1.5,
  "description": "Nama To-do item (auto-generated)",
  "todoable_id": 123456,
  "todoable_type": "Todo"
}
```

---

## 9. Happy Path Flow

```
User buka app
    │
    ▼
[Login via Basecamp OAuth]
    │
    ▼
[Lihat daftar To-do yang di-assign]
    │
    ▼
[Klik "Start" pada To-do X]
    │── App simpan ActiveTimer ke DB
    │── WebSocket client konek ke WS server
    │── Timer mulai jalan di UI
    │
    ▼
[User bekerja... timer jalan]
    │── WS server ping tiap 1 menit
    │── Client balas pong → lastPingAt diupdate di DB
    │
    ▼
[User klik "Stop" (atau WS timeout)]
    │── ActiveTimer dihapus dari DB
    │── TimeEntry baru dibuat (status: PENDING)
    │── Server ambil OAuth token user dari DB
    │── Server POST ke Basecamp Timesheet API (server-side, bukan dari browser)
    │── TimeEntry diupdate (status: SYNCED + basecampEntryId)
    │
    ▼
[Selesai]
```

---

## 10. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Reliability** | Timer state harus survive server restart (persistent di Postgres) |
| **Consistency** | Multi-tab behavior: semua tab selalu reflect state yang sama dari DB |
| **Resilience** | Jika Basecamp API gagal saat submit, entry disimpan dengan status `FAILED` dan di-retry (max 3x) |
| **Security** | OAuth token disimpan encrypted di DB; tidak pernah di-expose ke client |
| **Code Quality** | Clean Architecture: separation antara domain logic, use case, dan infrastructure |

---

## 11. Architecture Decision Records (ADR)

### ADR-01: WebSocket sebagai Standalone Service
**Decision:** WS server dipisah dari React Router server.  
**Rationale:** React Router v7 framework mode tidak punya lifecycle hook yang bersih untuk attach WebSocket server. Memisahkan membuat keduanya bisa di-scale dan di-restart secara independen.

### ADR-02: Postgres sebagai Single Source of Truth untuk Timer State
**Decision:** Timer state (ActiveTimer) disimpan di Postgres, bukan in-memory di WS server.  
**Rationale:** Memungkinkan multi-tab sync, crash recovery, dan WS server bisa di-restart tanpa kehilangan state.

### ADR-03: One Active Timer Per User
**Decision:** Satu user hanya bisa punya satu timer aktif. Switch To-do = auto-stop yang lama.  
**Rationale:** Menyederhanakan state management dan data model. Parallel tracking is out of scope.

### ADR-04: Auto-submit ke Basecamp Setelah Stop
**Decision:** Tidak ada step konfirmasi; langsung submit setelah stop.  
**Rationale:** Deskripsi sudah auto-generate dari nama To-do. Menambah friction (konfirmasi) tidak memberi value untuk use case ini.

---

## 12. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| OQ-01 | Basecamp 4 API endpoint mana yang return semua To-do yang di-assign ke user? Perlu cek apakah ada endpoint aggregated atau harus loop per-project. | Dev | ❓ Open |
| OQ-02 | Retry strategy untuk failed Basecamp sync: manual trigger dari UI, atau background job? | Product | ❓ Open |
| OQ-03 | Apakah perlu halaman "History" untuk melihat time entries yang sudah di-submit? | Product | ❓ Open |

---

## 13. MVP Definition

**MVP selesai jika:**
1. ✅ User bisa login via Basecamp 4 OAuth
2. ✅ User melihat daftar To-do yang di-assign
3. ✅ User bisa start/stop timer, dengan auto-switch jika start To-do lain
4. ✅ Timer auto-stop jika WebSocket tidak aktif selama >2 menit
5. ✅ Setiap sesi tersimpan di Postgres
6. ✅ Entry otomatis di-submit ke Basecamp Timesheet setelah stop
