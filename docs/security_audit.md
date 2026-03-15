# Security Audit — Editora Globo - Férias

**Date:** 2026-03-12  
**Scope:** Authentication, session handling, authorization, input validation, API security.

---

## 1. Authentication

### 1.1 Session handling — CRITICAL

| Issue | Unsigned session cookie |
|-------|-------------------------|
| **Location** | `lib/auth.ts` — `createSession`, `getSessionUser` |
| **Detail** | Session payload (user id, email, role) is stored in a cookie as plain JSON. No signature, no encryption. Attacker can set `ds-ferias-session` to `{"id":"victim-id","email":"victim@x.com","role":"RH"}` and gain full access. |
| **Impact** | Full privilege escalation; any user can become RH or access another user's context. |
| **Remediation** | Sign payload with server secret (e.g. HMAC-SHA256) and verify on read; or move to server-side session store with opaque ID; or use signed JWT. |

### 1.2 Password hashing — CRITICAL

| Issue | Weak hash (SHA-256, no salt) |
|-------|-----------------------------|
| **Location** | `lib/auth.ts` — `hashPassword`, `verifyCredentials` |
| **Detail** | `crypto.createHash("sha256").update(password).digest("hex")`. Same password → same hash; no per-user salt. Fast to brute-force; rainbow tables applicable. |
| **Impact** | Credential compromise if DB or logs leak; shared passwords across users identifiable. |
| **Remediation** | Use bcrypt (or argon2/scrypt) with cost factor; verify legacy hashes during transition; migrate stored hashes over time. |

### 1.3 Login failure logging — HIGH

| Issue | Password hash in logs |
|-------|------------------------|
| **Location** | `lib/auth.ts` — `verifyCredentials` (console.error on invalid password) |
| **Detail** | Logs `hashed` and `stored` (hash values). If logs are aggregated or accessible, hashes could be used for offline attacks. |
| **Remediation** | Do not log hashes; log only generic "Invalid credentials" or at most email (if acceptable by privacy policy). |

### 1.4 Cookie attributes

| Attribute | Current | Recommendation |
|-----------|---------|----------------|
| httpOnly | Yes | Keep — prevents XSS access |
| sameSite | lax | OK — CSRF mitigation |
| secure | In production | Keep — HTTPS only in prod |
| path | / | OK |
| maxAge | 8h | OK; consider shorter for high-privilege roles if needed |

---

## 2. Authorization

### 2.1 API authorization — HIGH (delete)

| Issue | Delete request without team scope |
|-------|-----------------------------------|
| **Location** | `app/api/vacation-requests/[id]/delete/route.ts` |
| **Detail** | Any user with `ROLE_LEVEL >= 2` can delete any vacation request. Coordenador/Gerente can delete requests outside their team. |
| **Impact** | Unauthorized deletion of other teams' data; possible abuse or mistake. |
| **Remediation** | For level 2 and 3, enforce `hasTeamVisibility(user.role, user.id, request)`; allow global delete only for RH (level 4). |

### 2.2 Update request — HIGH (role check)

| Issue | Only COLABORADOR can edit own pending request |
|-------|-----------------------------------------------|
| **Location** | `app/api/vacation-requests/[id]/update/route.ts` |
| **Detail** | `user.role !== "COLABORADOR"` returns 403. FUNCIONARIO (same level) cannot edit; inconsistent with schema and UX. |
| **Impact** | Legitimate users (FUNCIONARIO) cannot correct their own pending request. |
| **Remediation** | Allow `getRoleLevel(user.role) === 1` (FUNCIONARIO or COLABORADOR). |

### 2.3 Approve / Reject

| Check | Status |
|-------|--------|
| Role level >= 2 | Enforced |
| canApproveRequest (no self-approval) | Enforced |
| Coordenador: direct report only | Enforced |
| Gerente: direct + indirect | Enforced |
| RH: any request in right status | Enforced |

No privilege escalation found on approve/reject.

### 2.4 Users & reports (RH only)

| Endpoint | Restriction |
|----------|-------------|
| GET/PATCH /api/users | getRoleLevel(user.role) < 4 → 403 |
| GET /api/reports/balance | Same |

OK.

### 2.5 Blackout periods

| Action | Restriction |
|--------|-------------|
| GET | Authenticated |
| POST | Level >= 3 (Gerente, RH) |
| DELETE | Level >= 3, any blackout |

DELETE any blackout by any Gerente/RH — document as intended or restrict to creator for Gerente.

---

## 3. Input Validation

### 3.1 Vacation request creation (POST)

| Input | Validation |
|-------|------------|
| periods[] | Length 1–3, dates valid, CLT rules (validateCltPeriods) |
| Blackout | checkBlackoutPeriods |
| Overlap | hasOverlappingRequest per period |
| Balance | availableDays, hasEntitlement |

No SQL injection (Prisma parameterized). Body parsed safely.

### 3.2 Vacation request update (POST)

| Input | Validation |
|-------|------------|
| startDate, endDate | Required, valid dates, validateCltPeriod (single period) |
| Overlap | Status list incomplete (see system audit) |

Fix overlap status list.

### 3.3 Login (POST)

| Input | Validation |
|-------|------------|
| email, password | Type check (string); no length/sanitization beyond usage |

Acceptable; avoid logging raw password or hash.

### 3.4 PATCH user

| Input | Validation |
|-------|------------|
| name, role, department, hireDate, managerId | Type/allowlist (ROLES); role from fixed list |

OK. Prisma prevents SQL injection.

---

## 4. SQL Injection & Prisma

- All DB access via Prisma; no raw SQL with user input. **Risk: Low.**

---

## 5. API Misuse & Abuse

| Risk | Mitigation |
|------|------------|
| Brute-force login | None — add rate limiting (IP or email) |
| Session fixation | New session on login; no reuse of existing cookie value for new login — OK |
| CSRF on state-changing APIs | sameSite=lax + same-origin requests; consider CSRF token for strict policy |
| Mass request creation | No rate limit on POST vacation-requests; consider per-user limits if needed |

---

## 6. Summary

| Category | Finding | Severity |
|----------|---------|----------|
| Session | Unsigned cookie | Critical |
| Passwords | SHA-256, no salt | Critical |
| Logging | Hash in logs | High |
| Authorization | Delete without team check | High |
| Authorization | Update only COLABORADOR | High |
| Input | Overlap status list in update | High |
| Rate limiting | Login | Low |
| CSRF | Optional hardening | Low |

**End of security audit.**
