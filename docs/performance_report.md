# Performance Report — Editora Globo - Férias

**Date:** 2026-03-12  
**Scope:** Database queries, server components, frontend filtering, Prisma usage.

---

## 1. Database Queries

### 1.1 Dashboard: fetch all requests for approvers — HIGH IMPACT

| Location | `app/dashboard/page.tsx` — `getData()` |
|----------|----------------------------------------|
| **Current behavior** | For Coordenador, Gerente, RH: `prisma.vacationRequest.findMany({ where: { ...q, status } })` with no team filter. All requests in DB are loaded. Then `managedRequests.filter(hasTeamVisibility)` in Node. |
| **Problem** | O(N) requests from DB and over the wire; O(N) filter in memory. With 10k requests, page load and memory grow unnecessarily. |
| **Suggestion** | Build `where` from role: e.g. for Coordenador `where: { user: { managerId: userId } }`; for Gerente `where: { user: { OR: [{ managerId: userId }, { manager: { managerId: userId } }] } }`; for RH no extra filter. Reuse in a shared `buildManagedRequestsWhere(userId, userRole, filters)` and call from getData. Optionally add `take`/`skip` for pagination. |

### 1.2 Export CSV: same pattern — HIGH IMPACT

| Location | `app/api/vacation-requests/export/route.ts` |
|----------|--------------------------------------------|
| **Current behavior** | `prisma.vacationRequest.findMany` with only optional q/department/status; then JS filter by role and view. |
| **Problem** | Same as dashboard: full table (or large subset) loaded and filtered in memory. |
| **Suggestion** | Use same visibility-aware `where` as dashboard; consider streaming CSV (e.g. cursor + write to response stream) for very large result sets. |

### 1.3 Reports balance — MEDIUM IMPACT

| Location | `app/api/reports/balance/route.ts` |
|----------|------------------------------------|
| **Current behavior** | `prisma.user.findMany` with `vacationRequests: { select: ... }` for all users. |
| **Problem** | One query but large payload if many users and many requests. |
| **Suggestion** | Acceptable for moderate size; for large orgs consider pagination or streaming CSV without loading all into memory. |

### 1.4 Vacation request creation — OK

| Location | `app/api/vacation-requests/route.ts` |
|----------|-------------------------------------|
| **Current behavior** | Parallel `blackoutPeriod.findMany` and `user.findUnique` with vacationRequests; then per-period overlap check (`findFirst` per period). |
| **Note** | Overlap check is sequential per period (up to 3); could be batched in one query (e.g. single findMany with OR conditions) to reduce round-trips. |

### 1.5 No N+1 in audit scope

- Approve/reject/delete: single findUnique + update. No N+1.
- Dashboard: one findMany for requests with includes; no per-row queries in the hot path.

---

## 2. Server Components & Payload

### 2.1 Large dashboard component — MEDIUM

| Location | `app/dashboard/page.tsx` |
|----------|---------------------------|
| **Current** | ~1163 lines; one Server Component that fetches and renders everything. |
| **Problem** | Hard to optimize in isolation; large tree re-renders on any data change. Not a direct runtime performance bug but limits future optimizations. |
| **Suggestion** | Split into smaller components and optionally move some data fetching to dedicated server functions or route handlers; keep main page thin. |

### 2.2 Data passed to client

| Component | Data |
|-----------|------|
| NewRequestCardClient | balance (small) |
| ActionButtonForm | action URL only |

No large props identified. Balance and request list are used on server-rendered cards; only balance and minimal state go to client for the new-request form.

---

## 3. Frontend Filtering

### 3.1 In-memory filter on full list — HIGH (same as 1.1)

| Location | Dashboard and export |
|----------|----------------------|
| **Current** | Load full (or lightly filtered) list, then filter by visibility and view. |
| **Suggestion** | Move visibility into DB query (see 1.1). Reduces both server memory and serialization cost. |

---

## 4. Prisma & Indexes

### 4.1 Schema (prisma/schema.prisma)

| Model | Suggested indexes (if not already present) |
|-------|-------------------------------------------|
| VacationRequest | `userId` (FK), `status`, composite `(userId, status)` for "my requests" and overlap checks |
| VacationRequestHistory | `vacationRequestId` (FK), `changedAt` if sorted by time |
| BlackoutPeriod | `startDate`, `endDate` if filtered by date range |
| User | `email` (unique), `managerId` (FK), `role` if filtered by role |

Prisma does not show explicit indexes in the provided schema; adding indexes on frequently filtered columns (userId, status, managerId, dates) will help as data grows.

### 4.2 Query patterns

- Overlap check: `userId`, `status in [...]`, `startDate`, `endDate` — index on `(userId, status)` and date range can help.
- "My requests": `userId` — index on `userId`.
- Managed requests by coord: `user.managerId` — index on User.managerId and/or VacationRequest via user relation.

---

## 5. Optimization Suggestions (prioritized)

1. **High:** Add visibility-based `where` for managed requests (dashboard + export) so DB returns only visible rows.
2. **High:** Avoid loading full request list in dashboard and export; consider pagination (e.g. 50–100 per page) for historico.
3. **Medium:** Add DB indexes on VacationRequest (userId, status), User (managerId, role), BlackoutPeriod (startDate, endDate).
4. **Medium:** Refactor dashboard into smaller components and shared filter/visibility layer for maintainability and future perf work.
5. **Low:** Batch overlap check in POST vacation-requests (one findMany with OR of period conditions) instead of up to 3 findFirst calls.

---

**End of performance report.**
