# Custom Plan Add-ons Flow Analysis

## Current State & Issue

**Problem 1:** User with custom plan has `webhook` and `human_handoff` features enabled via admin override, but cannot access these settings in the dashboard customize page unless `custom_logo` is also enabled.

**Problem 2:** There is **no way to enable** "Quick Questions", "System Prompt", and "Company Tone" features for custom plan users via the admin panel, even though these are valuable features.

### Current Feature Flags (Admin Panel)
Six toggles in `/dashboard/settings/admin`:
1. **Human Handoff** - "Talk-to-human button + transcript email"
2. **Lead Capture** - "Collect visitor email/name in widget"
3. **White Label** - "Remove 'Powered by Sapybase'"
4. **Webhooks** - "Zapier / Make integration"
5. **Custom Logo** - "Upload own logo URL"
6. **Analytics** - "Insights & ROI reports"

**Missing:** No toggle for `advanced_bot` (controls System Prompt, Company Tone, Quick Questions)

---

## Root Cause Analysis

### In Admin Panel (`/dashboard/settings/admin/page.tsx`)
- All 6 features are **independent toggles** (lines 574-585)
- Each is stored independently in `custom_plan_config`
- No conditional logic preventing any combination

### In User-Facing UI (`/dashboard/settings/customize/page.tsx`)
- **Line 74:** `const isProUser = entitlements.canUseCustomLogo;`
- **Lines 297-334:** Entire "Integrations" section (webhook URL + human handoff URL) is gated by `!isProUser`
  ```tsx
  {!isProUser && (
    <div className="absolute -inset-4 z-40 backdrop-blur...">
      <span>Pro Required</span>
    </div>
  )}
  <div className={!isProUser ? 'opacity-40 pointer-events-none' : ''}>
    {/* Lead Capture Webhook URL input */}
    {/* Human Handoff URL input */}
  </div>
  ```

### In Entitlements Resolution (`/src/lib/auth/entitlements.ts`)
These features are **independently resolved** from custom plan config:
- `canUseCustomLogo` ← resolved from `custom_logo` flag (line 96)
- `canUseWebhooks` ← resolved from `webhooks` flag (line 98)
- `canUseHumanHandoff` ← resolved from `human_handoff` flag (line 99)
- `canUseLeadCapture` ← resolved from `lead_capture` flag (line 100)
- `canUseAdvancedBot` ← resolved from `advanced_bot` flag (line 102) **⚠️ MISSING FROM ADMIN**

Each feature can independently be true/false regardless of others.

---

## The Disconnect

### Issue #1: Integrations Section Gated by Wrong Feature
| Component | Behavior | Issue |
|-----------|----------|-------|
| **Admin Panel** | Treats all 6 features as independent toggles | ✓ Correct |
| **Entitlements Engine** | Resolves each feature independently | ✓ Correct |
| **User Dashboard UI** | Gates webhooks + handoff by **custom_logo** only | ✗ **WRONG** |

**The bug:** The customize page incorrectly uses `canUseCustomLogo` as the gate for the Integrations section (line 74: `const isProUser = entitlements.canUseCustomLogo;`), when it should use `canUseWebhooks` or `canUseLeadCapture` for webhooks, and `canUseHumanHandoff` for handoff.

### Issue #2: Missing `advanced_bot` Feature in Admin Panel
| Component | Behavior | Issue |
|-----------|----------|-------|
| **Admin Panel** | Only 6 feature toggles available | ✗ **MISSING `advanced_bot`** |
| **Entitlements Engine** | Tries to resolve `advanced_bot` from custom plan | ⚠️ Fails silently |
| **User Dashboard UI** | Advanced behavior locked unless STARTER+ tier | ✗ **Can't enable for custom plans** |

**The bug:** Admins cannot enable "System Prompt", "Company Tone", and "Quick Questions" for custom plan users because:
1. The `advanced_bot` feature is not in the admin panel toggles
2. Entitlements resolution tries to find it in custom plan features (line 102)
3. It falls back to tier defaults (FREE/BASIC users always have it locked)
4. Custom plan users get `canUseAdvancedBot = false` unless their original tier is STARTER+

**Result:** A FREE tier user given a custom plan cannot use advanced behavior features even if admin wants to grant them.

---

## Feature Dependencies & Logical Connections

### Actual Functional Dependencies
```
Lead Capture Webhook URL
  ├─ Requires: lead_capture feature enabled (to collect data)
  ├─ Requires: webhook feature enabled (to send data somewhere)
  └─ Independent of: custom_logo, white_label, analytics

Human Handoff URL
  ├─ Requires: human_handoff feature enabled
  └─ Independent of: all other features

Custom Logo Upload
  ├─ Purely visual/branding
  └─ Independent of: all other features

White Label
  ├─ Purely visual/branding
  └─ Independent of: all other features

Analytics
  ├─ Purely reporting/insights
  └─ Independent of: all other features
```

### No Real Cross-Feature Dependencies
- **Custom Logo** doesn't unlock webhooks (no logical link)
- **Lead Capture** doesn't require Custom Logo
- **Webhooks** don't require Custom Logo
- **Human Handoff** doesn't require Custom Logo

---

## Recommended Feature Grouping & UX Flow

### Option 1: Strict Independence (Recommended)
**Philosophy:** Each feature is completely independent. Users enable exactly what they need.

**Admin Panel Flow:**
```
Custom Plan Builder
├── Resource Limits (max_bots, max_messages, max_chunks)
├── AI Model Config (gemini_model, max_output_tokens)
├── Feature Access (6 independent toggles)
│   ├── Human Handoff
│   ├── Lead Capture
│   ├── White Label
│   ├── Webhooks
│   ├── Custom Logo
│   └── Analytics
└── Polar Provisioning
```

**User Dashboard UI Flow:**
```
Customize Page
├── Section: Bot Appearance
│   ├── Bot Name (always available)
│   ├── Greeting (always available)
│   ├── White Label Toggle (gated by white_label)
│
├── Section: Logo & Avatar Shape
│   └── Custom Logo Uploader (gated by custom_logo)
│
├── Section: Advanced Behavior
│   ├── Company Tone (gated by advanced_bot)
│   ├── System Prompt (gated by advanced_bot)
│   └── Quick Questions (gated by advanced_bot)
│
├── Section: Integrations
│   ├── Lead Capture Webhook URL (gated by BOTH lead_capture AND webhook)
│   ├── Human Handoff URL (gated by human_handoff)
│   └── [Future: other integrations]
│
└── Section: Analytics
    └── Analytics Dashboard Link (gated by analytics)
```

**Gate Logic:**
- `isWhiteLabelEnabled = entitlements.canWhiteLabel`
- `isCustomLogoEnabled = entitlements.canUseCustomLogo`
- `isAdvancedBotEnabled = entitlements.canUseAdvancedBot`
- `isLeadCaptureWebhookEnabled = entitlements.canUseLeadCapture && entitlements.canUseWebhooks`
- `isHumanHandoffEnabled = entitlements.canUseHumanHandoff`
- `isAnalyticsEnabled = entitlements.canUseAnalytics`

---

### Option 2: Feature Bundles (Alternative)
**Philosophy:** Group related features into tiers or bundles.

**Bundles:**
```
Branding Bundle
├── White Label
├── Custom Logo
└── Analytics (optional)

Integrations Bundle
├── Lead Capture
├── Webhooks
└── Human Handoff
```

**Dependencies:**
```
To use Lead Capture Webhook:
  ├─ Must enable: Lead Capture (prerequisite)
  ├─ Must enable: Webhooks (prerequisite)
  └─ Optional: Custom Logo (visual enhancement)

To use Human Handoff:
  ├─ Must enable: Human Handoff
  └─ No prerequisites
```

**Admin UI Changes:**
```
Integrations Section
├── Lead Capture [toggle] (red dot: "requires webhook")
├── Webhooks [toggle] (red dot: "requires lead capture")
└── Human Handoff [toggle]

Branding Section
├── White Label [toggle]
├── Custom Logo [toggle]
└── Analytics [toggle]
```

---

## Confirmation: Advanced Behavior Features

**Question:** When custom_logo feature is enabled, are System Prompt, Company Tone, and Quick Questions enabled or locked?

**Answer:** They are **COMPLETELY INDEPENDENT**. Enabling custom_logo does **NOT** unlock them.

- `canUseCustomLogo` → gates Logo & Avatar section
- `canUseAdvancedBot` → gates System Prompt, Company Tone, Quick Questions sections (line 72)

These use different entitlements. However, **there's a critical gap:**

| Entitlement | Gated by | Status |
|-------------|----------|--------|
| `canUseCustomLogo` | custom_logo toggle (admin) | ✓ Works |
| `canUseWhiteLabel` | white_label toggle (admin) | ✓ Works |
| `canUseAnalytics` | analytics toggle (admin) | ✓ Works |
| `canUseWebhooks` | webhook toggle (admin) | ✓ Works (but wrongly gated) |
| `canUseHumanHandoff` | human_handoff toggle (admin) | ✓ Works (but wrongly gated) |
| `canUseLeadCapture` | lead_capture toggle (admin) | ✓ Works (but wrongly gated) |
| `canUseAdvancedBot` | advanced_bot toggle (admin) | ✗ **MISSING** |

**For custom plan users:** Advanced behavior is locked UNLESS their tier is STARTER or higher (because `advanced_bot` falls back to tier defaults).

---

## Recommended Solution

### Option 1 is Better Because:
1. **Simplicity:** No implicit dependencies. Admin controls exactly what users get.
2. **Flexibility:** Users can buy only what they need (custom logo without webhooks, webhooks without logo, etc.)
3. **Clear Mental Model:** Each feature is independent; entitlements are straightforward.
4. **Easier to Debug:** No hidden relationships between toggles.

### Implementation Changes Required:

#### 0. **Add `advanced_bot` Toggle to Admin Panel** (CRITICAL)
**File:** `/src/app/(app)/dashboard/settings/admin/page.tsx`

Add to FEATURE_FLAGS (line 63):
```typescript
const FEATURE_FLAGS = [
  { key: 'advanced_bot', label: 'Advanced Behavior', icon: 'psychology', desc: 'System Prompt, Tone, Quick Questions' },
  { key: 'human_handoff', label: 'Human Handoff', icon: 'support_agent', desc: 'Talk-to-human button + transcript email' },
  // ... rest of features
];
```

Add to BLANK_CUSTOM_CONFIG (line 87):
```typescript
const BLANK_CUSTOM_CONFIG = {
  // ...
  advanced_bot: false,  // ADD THIS
  human_handoff: false,
  // ...
};
```

This will allow admins to enable advanced behavior for custom plan users.

#### 1. **Fix UI Gates** (`/dashboard/settings/customize/page.tsx`)
Replace:
```typescript
const isProUser = entitlements.canUseCustomLogo; // WRONG: gates webhooks by logo

// ❌ Current: webhooks section gated by custom_logo
{!isProUser && <Locked msg="Pro Required" />}
```

With:
```typescript
// Separate gates for each feature
const canAccessIntegrations = 
  entitlements.canUseLeadCapture || 
  entitlements.canUseWebhooks || 
  entitlements.canUseHumanHandoff;

// Within Integrations section:
{!entitlements.canUseLeadCapture || !entitlements.canUseWebhooks ? (
  <Locked msg="Requires Lead Capture + Webhooks" />
) : (
  <input placeholder="Lead Capture Webhook URL" />
)}

{!entitlements.canUseHumanHandoff ? (
  <Locked msg="Requires Human Handoff" />
) : (
  <input placeholder="Human Handoff URL" />
)}
```

#### 2. **Reorganize UI Sections** (Optional but Recommended)
Group features by category:
- **Branding:** White Label + Custom Logo + Analytics
- **Integrations:** Lead Capture + Webhooks + Human Handoff
- **Advanced Behavior:** System Prompt, Tone, Quick Questions

#### 3. **Add Helper Text to Admin Panel** (UX Improvement)
```
Lead Capture [toggle]
  → "Collect visitor emails/names in widget"
  
Webhooks [toggle]
  → "Send lead data to external tools (Zapier, Make, etc.)"
  → "💡 Tip: Usually paired with Lead Capture"

Human Handoff [toggle]
  → "Add 'Talk to Human' button in widget"
  → "Requires a contact URL (WhatsApp, Calendly, etc.)"
```

---

## Summary Table: Current vs. Recommended

| Feature | Current Gate | Should Be | Reason |
|---------|--------------|-----------|--------|
| Custom Logo | `canUseCustomLogo` | `canUseCustomLogo` | ✓ Already correct |
| White Label | `canWhiteLabel` | `canWhiteLabel` | ✓ Already correct |
| Lead Capture Webhook URL | `canUseCustomLogo` | `canUseLeadCapture && canUseWebhooks` | ✗ **BROKEN** |
| Human Handoff URL | `canUseCustomLogo` | `canUseHumanHandoff` | ✗ **BROKEN** |
| System Prompt / Tone / Quick Questions | Tier-based (no admin control) | `canUseAdvancedBot` | ✗ **MISSING advanced_bot toggle** |
| Analytics | `canUseAnalytics` | `canUseAnalytics` | ✓ Already correct |

### Issues Summary

| Issue # | Problem | Impact | Priority |
|---------|---------|--------|----------|
| **#1** | Webhooks/handoff gated by custom_logo instead of own entitlements | User faltu109@gmail.com can't use webhook/handoff even though enabled | **HIGH** |
| **#2** | No `advanced_bot` toggle in admin panel | Admins can't enable System Prompt/Tone/Questions for custom plans | **MEDIUM** |

---

## Test Case for User faltu109@gmail.com

### Test 1: Webhooks & Handoff Access

**Current Behavior (Broken):**
```
Admin enables:
  custom_logo = false
  webhook = true
  human_handoff = true
  
User logs in:
  ❌ Integrations section shows: "Pro Required" (locked)
  ❌ Cannot enter webhook URL
  ❌ Cannot enter handoff URL
```

**After Fix (Correct):**
```
Admin enables:
  custom_logo = false
  webhook = true
  human_handoff = true
  
User logs in:
  ✓ Integrations section is UNLOCKED
  ✓ Can enter webhook URL (gated by webhook feature)
  ✓ Can enter handoff URL (gated by handoff feature)
  ✓ Custom logo section remains locked (not enabled)
```

### Test 2: Advanced Behavior Access

**Current Behavior (Broken):**
```
Assume user faltu109@gmail.com is on FREE tier, given custom plan.

Admin wants to enable: advanced_bot = true (BUT NO TOGGLE EXISTS!)
  
User logs in:
  ❌ System Prompt section: "Starter or Pro Required" (locked)
  ❌ Company Tone section: "Starter or Pro Required" (locked)
  ❌ Quick Questions section: "Starter or Pro Required" (locked)
  ✓ Cannot be fixed by admin because advanced_bot toggle doesn't exist
```

**After Fix (Correct):**
```
Assume user faltu109@gmail.com is on FREE tier, given custom plan.

Admin enables:
  advanced_bot = true (NEW TOGGLE AVAILABLE!)
  
User logs in:
  ✓ System Prompt section: UNLOCKED
  ✓ Company Tone section: UNLOCKED
  ✓ Quick Questions section: UNLOCKED
  ✓ User can customize their bot's behavior
```

---

## Detailed Answer: Advanced Behavior & Custom Logo Relationship

### What Gates What?

In the customize page (`/dashboard/settings/customize/page.tsx`), there are **THREE independent gates** (lines 72-74):

```typescript
const isAdvancedLocked = !entitlements.canUseAdvancedBot;      // System Prompt, Tone, Questions
const canHideBranding = entitlements.canWhiteLabel;             // White Label toggle
const isProUser = entitlements.canUseCustomLogo;                // Webhook URL, Handoff URL
```

### Your Question: Does Enabling Custom Logo Unlock Advanced Behavior?

**Answer: NO. They are completely independent.**

| Feature | Gate | Control |
|---------|------|---------|
| Custom Logo Upload | `canUseCustomLogo` | custom_logo toggle |
| White Label Branding | `canWhiteLabel` | white_label toggle |
| **System Prompt** | **`canUseAdvancedBot`** | **⚠️ NOT AVAILABLE IN ADMIN** |
| **Company Tone** | **`canUseAdvancedBot`** | **⚠️ NOT AVAILABLE IN ADMIN** |
| **Quick Questions** | **`canUseAdvancedBot`** | **⚠️ NOT AVAILABLE IN ADMIN** |
| Webhook URL | `canUseCustomLogo` *(WRONG)* | webhook toggle *(BROKEN GATE)* |
| Human Handoff URL | `canUseCustomLogo` *(WRONG)* | human_handoff toggle *(BROKEN GATE)* |

### Why Custom Plan Users Get Locked Out of Advanced Behavior

For a FREE tier user converted to a custom plan:
1. Admin has no `advanced_bot` toggle (missing from panel)
2. Entitlements falls back to tier default: `canUseAdvancedBot = false` (because FREE tier has it false)
3. User sees "Starter or Pro Required" overlay on advanced behavior section
4. **Result:** User cannot use system prompt, tone, or quick questions—even with a paid custom plan

**This is a major limitation.** A customer on a custom plan should be able to use advanced features if the admin grants them.

---

## Action Items

1. **Frontend Fix:** Update customize page gates to use correct entitlements
2. **Optional: Reorganize Sections** to group related features
3. **Optional: Add Admin UX Hints** showing feature relationships
4. **Testing:** Verify all feature combinations work independently
