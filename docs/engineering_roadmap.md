# Engineering Roadmap — Editora Globo - Férias

**Date:** 2026-03-12  
**Based on:** system_audit.md, security_audit.md, performance_report.md.

---

## 1. Critical bug fixes

| # | Task | Priority | Files | Impact |
|---|------|----------|-------|--------|
| 1 | Sign session cookie (HMAC) and verify on read | P0 | lib/auth.ts | Prevents privilege escalation via forged cookie |
| 2 | Allow FUNCIONARIO to edit own pending request (level 1) | P0 | app/api/vacation-requests/[id]/update/route.ts | Fixes 403 for valid users |
| 3 | Fix overlap status list in update route | P0 | app/api/vacation-requests/[id]/update/route.ts | Prevents overlapping approved requests |
| 4 | Restrict delete to team visibility for coord/gerente | P0 | app/api/vacation-requests/[id]/delete/route.ts | Prevents cross-team delete |
| 5 | Pass userRole to RequestCard and use in canApproveRequest | P0 | app/dashboard/page.tsx | Correct Approve/Reject button visibility |
| 6 | Remove password hash from login failure logs | P0 | lib/auth.ts | Reduces sensitive data in logs |

---

## 2. Security improvements

| # | Task | Priority | Files | Impact |
|---|------|----------|-------|--------|
| 7 | Add COLABORADOR and GESTOR to PATCH users ROLES | P1 | app/api/users/[id]/route.ts | Schema/API consistency |
| 8 | (Future) Migrate password hashing to bcrypt + legacy SHA check | P1 | lib/auth.ts | Stronger credential protection |

---

## 3. Performance optimizations

| # | Task | Priority | Files | Impact |
|---|------|----------|-------|--------|
| 9 | Add buildManagedRequestsWhere and use in getData | P1 | lib/requestVisibility.ts, app/dashboard/page.tsx | Fewer rows from DB |
| 10 | Use same where in export route | P1 | app/api/vacation-requests/export/route.ts | Same |
| 11 | Add Prisma indexes (userId, status, managerId, dates) | P2 | prisma/schema.prisma | Faster queries at scale |

---

## 4. Architecture refactors

| # | Task | Priority | Files | Impact |
|---|------|----------|-------|--------|
| 12 | Extract request visibility to lib/requestVisibility.ts | P1 | lib/requestVisibility.ts, dashboard, export | Single source of truth |
| 13 | Split dashboard into smaller components (Sidebar, RequestCard, ManagerView) | P2 | components/dashboard/*, app/dashboard/page.tsx | Maintainability, <500 lines/page |

---

## 5. Code quality

| # | Task | Priority | Files | Impact |
|---|------|----------|-------|--------|
| 14 | Add types for request/filters (reduce any) | P2 | app/dashboard/page.tsx, lib types | Type safety |
| 15 | Centralize filter/buildExportQuery in lib | P2 | lib/dashboard-filters.ts | Less duplication |

---

## 6. UX improvements

| # | Task | Priority | Files | Impact |
|---|------|----------|-------|--------|
| 16 | (Done in prior work) Mobile/responsive and touch targets | - | - | Already addressed |

---

## Execution order (this run)

1. Sign session cookie + remove hash from logs (auth).
2. Update route: allow level 1, fix overlap statuses.
3. Delete route: hasTeamVisibility for level 2–3.
4. RequestCard: pass userRole, use in canApprove.
5. PATCH users: add COLABORADOR, GESTOR to ROLES.
6. Add lib/requestVisibility.ts and use in dashboard + export (buildWhere + filter).
7. Add Vitest and API tests for critical flows.
8. Extract dashboard components and types as feasible without breaking.

**End of roadmap.**
