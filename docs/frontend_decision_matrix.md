# Frontend Decision Matrix

**Question:** Can we deploy the current frontend as-is?  
**Answer:** ❌ **NO** — Critical bugs prevent any custom plan creation.

---

## Critical Bugs (Block Deployment)

| Bug | Location | Problem | Fix | Time |
|---|---|---|---|---|
| Wrong endpoint | `src/app/(app)/dashboard/settings/admin/page.tsx:498` | Calls `/limits` instead of `/users/{id}` | Change one line | 1 min |
| Price validation | `src/lib/validation/schemas.ts:44` | Allows $0 but backend rejects | Change `nonnegative` to `positive` | 1 min |
| No provision flow | `UserEditModal` | Only one button, no "Create in Polar" | Add two-step workflow | 2 hours |
| No checkout display | After provision call | URL not shown to admin | Add modal with copy button | 1 hour |

**Total time to fix:** ~3 hours (mostly the provision workflow)

**Impact if not fixed:** Users cannot create or provision custom plans.

---

## Missing Features (Block Full Functionality)

| Feature | User Impact | Complexity | Time | Priority |
|---|---|---|---|---|
| Custom plan dashboard | Admin can't see/monitor active plans | High | 4 hours | **P1** |
| Quick actions | Admin can't manage customer issues | Medium | 3 hours | **P1** |
| Metrics view | Admin can't see health/trends | Medium | 2 hours | **P2** |
| Reconciliation UI | Ops can't debug mismatches | Low | 1 hour | **P2** |
| Error handling | Bad UX on failures | Low | 1.5 hours | **P2** |

**Total time to implement:** ~11.5 hours

---

## Deployment Readiness

### Current State
```
Backend:         ✅✅✅ Complete (6 phases, 155 tests passing)
Frontend Admin:  ❌❌❌ Broken (endpoint bug + no provision flow)
Tests:           ✅✅✅ 99 new tests for backend
Frontend Tests:  ❌❌❌ None for frontend
```

### To Ship MVP (Minimum Custom Plans)
```
1. Fix endpoint bug          → 1 hour
2. Fix price validation      → 15 min
3. Add provision workflow    → 2 hours
4. Add checkout display      → 1 hour
5. Add error handling        → 1 hour
6. QA + testing              → 1.5 hours
───────────────────────────────────
Total: ~6.5 hours
```

### To Ship Full Feature (Recommended)
```
MVP above                    → 6.5 hours
+ Custom plan dashboard      → 4 hours
+ Quick actions              → 3 hours
+ Metrics view               → 2 hours
+ Reconciliation UI          → 1 hour
+ Full frontend QA           → 2 hours
───────────────────────────────────
Total: ~18.5 hours
```

---

## GO/NO-GO Decision Table

### Can Ship Now?
| Item | Status | Blocker? |
|---|---|---|
| Backend API | ✅ Done | No |
| Database schema | ✅ Done | No |
| Webhook handler | ✅ Done | No |
| Access gates | ✅ Done | No |
| Admin endpoints | ✅ Done | No |
| Backend tests | ✅ Done (155 pass) | No |
| **Frontend save/provision** | ❌ **BROKEN** | **YES** |
| Frontend dashboard | ❌ Missing | Yes (for monitoring) |
| Frontend tests | ❌ Missing | No (can follow-up) |
| Docs | ✅ Done | No |

**Verdict:** ❌ **CANNOT SHIP** — Endpoint bug blocks creation.

---

## Recommendation

### Option A: Fix & Ship MVP (6.5 hours)
**What you get:**
- Admins can create custom plans ✅
- Admins can send checkout links ✅
- Customers can complete checkout ✅
- Backend handles everything ✅

**What you don't get:**
- ❌ Admin can't monitor active plans (must check DB/logs)
- ❌ No quick-action UI for admins
- ❌ No metrics/health dashboard

**Timeline:** Fix bugs today → ship tomorrow

**Risk:** Low (only fixes + one new endpoint integration)

---

### Option B: Full Feature Release (18.5 hours)
**What you get:**
- Everything in Option A ✅
- Admin dashboard to view all custom plans ✅
- Quick actions (suspend, extend, etc.) ✅
- Metrics & health overview ✅
- Manual reconciliation UI ✅

**What you don't get:**
- Nothing major

**Timeline:** ~2.5 days of dev time

**Risk:** Medium (larger scope = more testing needed)

---

## Recommendation

**Suggested approach: Option A first, then Option B**

1. **Day 1:** Fix the 3 critical bugs (endpoint, validation, provision flow) — 3 hours
   - Test end-to-end: provision → checkout → customer payment
   - Deploy to prod

2. **Day 2-3:** Add Phase 2 features (dashboard, metrics, quick actions) — ~10 hours
   - More polished admin experience
   - Better monitoring capabilities

This lets you launch custom plans while you build the full admin tooling.

---

## Questions for You

1. **Timeline:** Do you need to ship custom plans ASAP, or can you wait for the full feature?
   - If ASAP → Do Option A only (3 hours)
   - If can wait → Do both (18.5 hours)

2. **Team capacity:** How many hours can your frontend dev spend this week?

3. **Testing:** Do you want to test in Polar sandbox before shipping?
   - Recommended: Yes (adds ~2 hours of QA)

4. **Rollout:** Ship to all admins immediately, or closed beta?

---

## Files to Read for Implementation

When ready to code, read in this order:

1. **`docs/frontend_analysis_summary.md`** — Quick 1-page overview
2. **`docs/frontend_implementation_analysis.md`** — Detailed gaps
3. **`docs/frontend_component_map.md`** — Component structure
4. **`docs/custom_plan_admin_ui_flow.md`** — Admin UX flow (for design reference)

---

## Sign-Off Checklist (Before Coding Starts)

- [ ] Team agrees on Option A vs B timeline
- [ ] Assign frontend dev
- [ ] Create GitHub issues for bugs + features
- [ ] Schedule Polar sandbox testing
- [ ] Notify support/sales team of target launch date

