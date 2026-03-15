# System Audit — Editora Globo - Férias

**Date:** 2026-03-12  
**Scope:** Full codebase — APIs, auth, approval workflow, Prisma, validations, dashboard, role permissions, CLT rules.

---

## Summary

| Severity | Count |
|----------|--------|
| Critical | 2 |
| High | 5 |
| Medium | 6 |
| Low | 4 |

---

## 1. Critical Issues

### 1.1 Unsigned session cookie — privilege escalation

| Field | Value |
|-------|--------|
| **Severity** | Critical |
| **Affected files** | `lib/auth.ts` |
| **Explanation** | Session is stored as raw JSON in a cookie (`JSON.stringify(user)`). Cookie is not signed or encrypted. An attacker can forge a cookie with arbitrary `id`, `email`, `role` (e.g. `RH`) and gain full access. |
| **Suggested fix** | Sign the cookie with HMAC (e.g. `HMAC-SHA256(secret, payload)`) and verify on read; or use a server-side session store with an opaque session ID in the cookie; or use a signed JWT in cookie/header. |

### 1.2 Weak password hashing

| Field | Value |
|-------|--------|
| **Severity** | Critical |
| **Affected files** | `lib/auth.ts` |
| **Explanation** | Passwords are hashed with SHA-256 only, no per-user salt. Vulnerable to rainbow tables and fast brute-force. Industry standard is bcrypt, scrypt, or argon2 with salt. |
| **Suggested fix** | Use bcrypt (or argon2) for new passwords; support verification of legacy SHA-256 hashes during transition; then migrate hashes. |

---

## 2. High Severity Issues

### 2.1 Update vacation request: only "COLABORADOR" can edit

| Field | Value |
|-------|--------|
| **Severity** | High |
| **Affected files** | `app/api/vacation-requests/[id]/update/route.ts` |
| **Explanation** | Route checks `user.role === "COLABORADOR"`. Users with role `FUNCIONARIO` (schema default) cannot edit their own pending request. Frontend shows "Editar período" for owner; API returns 403 for FUNCIONARIO. |
| **Suggested fix** | Allow any role with level 1: `getRoleLevel(user.role) === 1` (covers FUNCIONARIO and COLABORADOR). |

### 2.2 Update overlap check: missing statuses

| Field | Value |
|-------|--------|
| **Severity** | High |
| **Affected files** | `app/api/vacation-requests/[id]/update/route.ts` |
| **Explanation** | Overlap query uses status `in: ["PENDENTE", "APROVADO_GESTOR", "APROVADO_RH"]`. Missing `APROVADO_COORDENADOR` and `APROVADO_GERENTE`. User can change dates and overlap with an already approved (coord/gerente) request. |
| **Suggested fix** | Use all active statuses: `["PENDENTE", "APROVADO_COORDENADOR", "APROVADO_GESTOR", "APROVADO_GERENTE", "APROVADO_RH"]`. |

### 2.3 Delete request: no team visibility check

| Field | Value |
|-------|--------|
| **Severity** | High |
| **Affected files** | `app/api/vacation-requests/[id]/delete/route.ts` |
| **Explanation** | Any user with `ROLE_LEVEL >= 2` can delete any request. Coordenador/Gerente can delete requests from other teams. Only `isOwner` and `isApprover` are checked. |
| **Suggested fix** | For level 2 and 3, require `hasTeamVisibility(user.role, user.id, request)` before allowing delete; RH (level 4) can keep global delete. |

### 2.4 RequestCard: wrong role for Approve button

| Field | Value |
|-------|--------|
| **Severity** | High |
| **Affected files** | `app/dashboard/page.tsx` (RequestCard) |
| **Explanation** | `canApproveRequest` is called with `request._approverRole ?? "RH"`. Server never sends `_approverRole`, so approver role is effectively always "RH". UI shows Approve for Coordenador/Gerente on requests that only RH can approve (e.g. APROVADO_GERENTE); API then returns 403. |
| **Suggested fix** | Pass current user's role to RequestCard (e.g. `userRole={user.role}`) and call `canApproveRequest(userRole, userId, request)`. |

### 2.5 Login failure logs sensitive data

| Field | Value |
|-------|--------|
| **Severity** | High |
| **Affected files** | `lib/auth.ts` |
| **Explanation** | On invalid password, `console.error` logs `hashed` and `stored` (password hashes). Logs may be collected and leak sensitive data. |
| **Suggested fix** | Remove hash from logs; log only high-level failure (e.g. "Invalid credentials for <email>") or omit PII in production. |

---

## 3. Medium Severity Issues

### 3.1 PATCH users: legacy roles not in allowlist

| Field | Value |
|-------|--------|
| **Severity** | Medium |
| **Affected files** | `app/api/users/[id]/route.ts` |
| **Explanation** | `ROLES` = `["FUNCIONARIO", "COORDENADOR", "GERENTE", "RH"]`. Schema also has COLABORADOR and GESTOR. API cannot set these roles; existing DB rows with them are valid but not editable via API. |
| **Suggested fix** | Add COLABORADOR and GESTOR to `ROLES` for schema compatibility. |

### 3.2 Dashboard loads all requests then filters in memory

| Field | Value |
|-------|--------|
| **Severity** | Medium |
| **Affected files** | `app/dashboard/page.tsx` (getData) |
| **Explanation** | For approvers, `managedRequestsPromise` fetches all vacation requests (only optional q/status in where). Team visibility is applied in memory via `hasTeamVisibility`. Scales poorly. |
| **Suggested fix** | Build Prisma `where` from role (e.g. by `user.managerId`, `user.manager.managerId`) so DB returns only visible requests; optionally add pagination. |

### 3.3 Export CSV: same pattern

| Field | Value |
|-------|--------|
| **Severity** | Medium |
| **Affected files** | `app/api/vacation-requests/export/route.ts` |
| **Explanation** | Fetches all requests then filters by role/view in memory. Same performance issue as dashboard. |
| **Suggested fix** | Use same visibility-aware `where` as dashboard/API layer; consider streaming CSV for large datasets. |

### 3.4 Monolithic dashboard file

| Field | Value |
|-------|--------|
| **Severity** | Medium |
| **Affected files** | `app/dashboard/page.tsx` (~1163 lines) |
| **Explanation** | Single file contains data fetching, sidebar, topbar, stats, blackout, list, ManagerView, FilterForm, RequestCard, StatusBadge, progress, history, actions, edit form, empty state, export, icons, filter helpers. Hard to maintain and test. |
| **Suggested fix** | Extract to components (e.g. AppSidebar, RequestCard, ManagerView, FilterForm) and lib (filterRequests, buildExportQuery); keep page under ~300 lines. |

### 3.5 Duplicate visibility/filter logic

| Field | Value |
|-------|--------|
| **Severity** | Medium |
| **Affected files** | `app/dashboard/page.tsx`, `app/api/vacation-requests/export/route.ts` |
| **Explanation** | "Who sees which requests" (coord/gerente/RH, inbox/historico) is implemented twice: in dashboard `filterRequests` + `hasTeamVisibility`, and in export's inline filter. Risk of drift. |
| **Suggested fix** | Centralize in a shared module (e.g. `lib/requestVisibility.ts` or `services/requestVisibility.ts`) and reuse in both dashboard and export. |

### 3.6 Blackout DELETE: no ownership

| Field | Value |
|-------|--------|
| **Severity** | Medium |
| **Affected files** | `app/api/blackout-periods/route.ts` |
| **Explanation** | Any user with level >= 3 can delete any blackout period. May be intentional (Gerente/RH as global admins); if not, restrict level-3 to `createdById === user.id`. |
| **Suggested fix** | Document as intended or restrict non-RH to own blackouts. |

---

## 4. Low Severity Issues

### 4.1 Type safety: `any` in request/history

| Field | Value |
|-------|--------|
| **Severity** | Low |
| **Affected files** | `app/dashboard/page.tsx`, various API handlers |
| **Explanation** | Request objects and filters use `any` in places (e.g. `r as any` for hasTeamVisibility). Reduces type safety. |
| **Suggested fix** | Define interfaces (e.g. `VacationRequestWithUser`, `DashboardFilters`) and use them in components and APIs. |

### 4.2 ActionButtonForm: no CSRF token

| Field | Value |
|-------|--------|
| **Severity** | Low |
| **Affected files** | `components/action-button-form.tsx` |
| **Explanation** | Form uses fetch POST without CSRF token. Next.js App Router with same-origin cookies has some protection; explicit CSRF would harden against misconfigured CORS. |
| **Suggested fix** | Optional: add CSRF token for state-changing requests if policy requires it. |

### 4.3 No rate limiting on login

| Field | Value |
|-------|--------|
| **Severity** | Low |
| **Affected files** | `app/api/login/route.ts` |
| **Explanation** | Login endpoint has no rate limiting; brute-force attempts are possible. |
| **Suggested fix** | Add rate limiting (e.g. by IP or email) for login attempts. |

### 4.4 Logout only accepts POST

| Field | Value |
|-------|--------|
| **Severity** | Low |
| **Affected files** | `app/api/logout/route.ts` |
| **Explanation** | Logout is POST-only. If "Sair" is implemented as a GET link somewhere, logout would not run. Current UI uses form POST; no bug if all exit paths use POST. |
| **Suggested fix** | Ensure all logout entry points use POST; optionally support GET with redirect for convenience. |

---

## 5. Role & Permission Logic

| Check | Status |
|-------|--------|
| Self-approval blocked | OK — `canApproveRequest` returns false when `request.userId === approverUserId` |
| Approve/reject by role and status | OK — API uses `canApproveRequest` and level checks |
| Coordenador: only direct reports | OK — approve checks `existing.user.managerId === user.id` |
| Gerente: direct + indirect reports | OK — checks managerId and manager.managerId |
| RH: all requests | OK — level 4 can approve APROVADO_GERENTE |
| Delete: owner or approver | Bug — approver can delete any request (see 2.3) |
| Update: only owner, pending | Bug — only COLABORADOR allowed (see 2.1) |

---

## 6. CLT Rules (lib/vacationRules.ts)

| Rule | Status |
|------|--------|
| Min 5 days per period | OK — validateCltPeriods |
| Max 30 days per period | OK |
| Max 3 periods | OK |
| One period >= 14 days | OK |
| Start not Friday/Saturday | OK |
| End not Saturday/Sunday | OK |
| 30-day advance notice | OK |
| Feriados SP (2 days before) | OK |
| Balance / entitled days | OK — used in POST and balance calculation |

No CLT violations identified in creation or validation. Update route uses single-period validation only.

---

## 7. Race Conditions & Data Consistency

- **Approve/reject:** Single update + history create; no optimistic locking. Two approvers could act concurrently; last write wins. Low risk for typical usage.
- **Create request:** Overlap and balance checked before transaction; transaction creates multiple requests. No obvious race.
- **Delete:** Direct delete; no race condition identified.

---

## 8. Server vs Client Components

- Dashboard page: async Server Component, uses getSessionUser and getData — correct.
- NewRequestCardClient, ActionButtonForm: "use client" — correct.
- RequestCard, ManagerView: no "use client", run on server as part of page — correct.

No misuse identified.

---

## 9. Null Safety & Error Handling

- APIs generally check `!user` and return 401/403.
- Prisma findUnique may return null; code checks before use.
- Some `as any` and optional chaining; no critical null-dereference found. Type tightening recommended (see 4.1).

---

**End of system audit.**
