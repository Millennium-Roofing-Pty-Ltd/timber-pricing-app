# Initial Code Review

Date: 2026-04-09  
Reviewer: Codex (GPT-5.3-Codex)  
Scope: Repository-wide static review, TypeScript compile check, and targeted code walkthrough.

## Review Method

1. Ran `npm run check` to validate TypeScript correctness across `client`, `server`, and `shared`.
2. Reviewed compile failures and traced each failure to concrete source locations.
3. Performed targeted risk scan for maintainability and operational safety (debug endpoints, upload handling, oversized route module).

---

## Executive Summary

The codebase currently fails TypeScript compilation and has several correctness risks that should be addressed before production hardening:

- **Build is red** due to strict typing and schema drift issues.
- **Schema/usage mismatch** exists in stock import helpers and stock insert field names.
- **A route references an unimported schema symbol**, which is an immediate compile stop.
- **A debug endpoint is exposed without environment gating**.

Overall status: **Not ready for production deployment** until findings below are remediated.

---

## Findings

### 1) TypeScript target mismatch breaks Set iteration in chart components
- **Severity:** High
- **Category:** Build / Frontend correctness
- **Evidence:** `tsconfig.json` has no explicit `compilerOptions.target`; chart code uses spread on `Set`.
- **Impact:** Type check fails on chart components (`TS2802`).
- **Recommendation:** Set `compilerOptions.target` to at least `ES2015` (prefer `ES2020` or newer) or enable `downlevelIteration`.

### 2) Recharts tooltip formatter signatures are too narrow
- **Severity:** High
- **Category:** Build / Frontend correctness
- **Evidence:** Tooltip formatters in chart components are typed as `(value: number | null)` and `(value: number | null, name: string)`, but Recharts expects broader `ValueType` input.
- **Impact:** Type check fails (`TS2769`), preventing successful compile.
- **Recommendation:** Widen formatter parameter types to Recharts-compatible types and coerce/guard inside formatter.

### 3) Nullable rate field parsed as non-null string in suppliers UI
- **Severity:** Medium
- **Category:** Runtime data correctness
- **Evidence:** `parseFloat(supplier.latestRate.ratePerM)` is called even though `ratePerM` is nullable in schema.
- **Impact:** Can produce `NaN` in UI and causes TypeScript strict-mode error (`TS2345`).
- **Recommendation:** Guard null values and provide fallback rendering (e.g., "No rate").

### 4) System rate calculation does not filter nullable rates
- **Severity:** Medium
- **Category:** Data correctness / import pipeline
- **Evidence:** Import script maps `parseFloat(r.ratePerM)` across all rows without null filtering.
- **Impact:** Null values can produce `NaN`, contaminating average/system rate calculations; also fails strict typing.
- **Recommendation:** Filter to non-null rates before parsing and skip update when no valid numeric values exist.

### 5) Stock import script is out of sync with shared schema
- **Severity:** High
- **Category:** Backend build / data import
- **Evidence:** Script inserts lookup rows using `description` where schema requires `name`, and inserts `cost` into `stock` while schema defines `supplierCost`, `averageCost`, `lastCost`, `highestCost`.
- **Impact:** Multiple compile failures (`TS2769`) and likely runtime import breakage if forced.
- **Recommendation:** Align import field mapping with schema and add a typed adapter layer for Excel column names.

### 6) Route uses `stockSupplierLinks` without importing it
- **Severity:** High
- **Category:** Backend build correctness
- **Evidence:** `/api/stock/:id/cost` handler queries `stockSupplierLinks`, but top-level schema import list omits it.
- **Impact:** Compile fails with `TS2304`.
- **Recommendation:** Import `stockSupplierLinks` from `@shared/schema` and add a route-level integration test for supplier authorization logic.

### 7) Unguarded debug endpoint in production route registration
- **Severity:** Medium
- **Category:** Operational / security hygiene
- **Evidence:** `/api/test-colours-debug` endpoint is always registered and returns raw table rows.
- **Impact:** Inadvertent data exposure and unnecessary attack surface in non-dev environments.
- **Recommendation:** Gate this endpoint behind `NODE_ENV === 'development'` and/or remove before production release.

### 8) `server/routes.ts` is overly large, increasing defect risk
- **Severity:** Medium
- **Category:** Maintainability
- **Evidence:** Single route module contains thousands of lines and mixes unrelated domains (timber, stock, imports, reports, diagnostics).
- **Impact:** Harder review/testing, increased merge conflicts, and greater chance of hidden regressions.
- **Recommendation:** Split by bounded context (`routes/timber.ts`, `routes/stock.ts`, `routes/imports.ts`) and centralize shared middleware/validators.

---

## Priority Remediation Plan

1. **Unblock compile immediately**
   - Add TS target / iteration fix.
   - Fix Recharts formatter types.
   - Import missing `stockSupplierLinks`.

2. **Fix data correctness risks**
   - Null-safe rate handling in UI.
   - Null-safe supplier rate averaging in import scripts.

3. **Resolve schema drift in stock import pipeline**
   - Update lookup/stock field mappings to current schema.
   - Add typed transformation tests using representative spreadsheet fixtures.

4. **Harden production runtime surface**
   - Remove or environment-gate debug endpoints.
   - Begin route modularization for testability.

---

## Commands Executed

- `npm run check`
- `rg -n "(TODO|FIXME|any\)|@ts-ignore|console\.log\(|process\.env|eval\(|innerHTML|dangerouslySetInnerHTML|password|secret|token)" client server shared scripts README.md`

