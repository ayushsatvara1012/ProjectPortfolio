 Implementation Plan                                                                                                     
                                                                                                                          
  Issue 1 — Custom Logo upgrade prompt shows for BASIC users with a custom plan that grants custom_logo                   
                                                                                                                          
  Root cause                                                                                                              
                                                                                                                          
  src/app/(app)/dashboard/settings/customize/page.tsx:77                                                                  
                                                                                                                          
  const isProUser = ['PRO','BUSINESS','ENTERPRISE'].includes(userTier || '') || userRole === 'SUPER_ADMIN';               
                                                                                                                          
  This is a pure tier check. It ignores customPlanFeatures.custom_logo exposed by UserContext                             
  (src/lib/context/UserContext.tsx:18,60) and persisted by the admin Custom Plan editor (settings/admin/page.tsx:47,63 —  
  feature key custom_logo). Same blind spot exists on line 73 (isWhiteLabelUser) for the white_label flag and on line 69  
  (isAdvancedLocked) — any feature an admin grants via custom plan is overridden by the tier guard.

  Fix strategy

  1. Centralize a feature-resolver in UserContext (or a new src/lib/auth/entitlements.ts) that returns booleans per       
  capability:
    - canUseCustomLogo, canWhiteLabel, canUseWebhooks, canUseHumanHandoff, canUseLeadCapture, canUseAnalytics.            
    - Resolution order per capability: SUPER_ADMIN → customPlanFeatures[key] === true → tier-default matrix (current      
  hardcoded list).                                                                                                        
    - Normalize customPlanFeatures shape (it's typed unknown): parse defensively, accept both {custom_logo: true} and     
  snake/camel variants, ignore if not an object.                                                                          
  2. Expose entitlements via useUserRole() so consumers don't re-derive.
  3. Replace the local checks in settings/customize/page.tsx:                                                             
    - isProUser → canUseCustomLogo (drives the custom-logo upgrade overlay at line 301–309 and the LogoCustomizer         
  isProUser prop at line 204).                                                                                            
    - isWhiteLabelUser / canHideBranding → canWhiteLabel.                                                                 
    - isAdvancedLocked / showFullOverlay → derived from "has at least one advanced entitlement" instead of tier name. A   
  BASIC user with custom plan granting custom_logo should NOT see the full-page overlay (line 89), but should still see   
  locks for features the custom plan did NOT grant.                                                                       
  4. Backend parity check — confirm the API endpoint that powers the customize save (the one returning Upgrade required to
   save changes. on line 343) also honors custom_plan_features.custom_logo. If the server still rejects BASIC saves, the  
  UI fix will be cosmetic and saves will fail. Grep the FastAPI side (sapybase_ai_engine/) for the customize/settings save
   handler and ensure custom-plan features are merged into the entitlement check there too.                               
  5. /api/me payload — verify it actually returns custom_plan_features (mapper at UserContext.tsx:60 reads
  data.custom_plan_features). If the field is missing for some users, default to null cleanly so the resolver falls back  
  to tier defaults.
                                                                                                                          
  Edge cases to cover

  - Loading/SSR seed: UserContext SSR-seeds only role/tier; customPlanFeatures is null on first paint. Until /api/me      
  resolves, the resolver should return tier defaults — UI must not flash "unlocked" then re-lock (or vice versa). Use
  isLoading to render a neutral skeleton, or keep the lock until features load.                                           
  - Custom plan toggled OFF later: admin removes custom_logo from the custom plan. After refreshUser, the page must
  re-lock; ensure no component caches isProUser in local state.                                                           
  - Partial features: custom plan grants custom_logo but not white_label. Each section gates independently — do not
  collapse to a single "isCustomPlanUser" boolean.                                                                        
  - Empty/malformed customPlanFeatures: null, [], "true", or unexpected JSON. Resolver must treat anything non-object as
  "no overrides".                                                                                                         
  - SUPER_ADMIN with FREE tier: must continue to bypass everything (already handled; preserve in resolver).
  - Custom plan with no name: customPlanName may be null while features exist — still honor features; do not require a    
  name.                                                                                                                   
  - Tier value casing: userTier could be null, 'null' (string), or lowercased. Normalize before comparison.               
  - Save endpoint 403: if backend rejects despite UI allowing, surface a clear toast (existing alert at line 343) and     
  trigger refreshUser() so UI re-syncs with server truth.                                                                 
  - BotPreview / LogoCustomizer downstream: they receive isProUser; confirm they don't independently re-check tier.       
  - Other pages with the same anti-pattern: audit dashboard/insights/page.tsx, dashboard/bots/BotsClient.tsx,             
  dashboard/train/page.tsx, settings/account/page.tsx for tier-only gates and migrate them to the resolver in the same PR 
  (optional, but prevents recurrence).                                                                                    
                                                                                                                          
  ---             
  Issue 2 — iPad landscape: Settings dropdown in dashboard sidebar won't open
                                                                                                                          
  Root cause
                                                                                                                          
  src/app/components/AppLayout.tsx:344-351                                                                                
   
  The desktop <aside> has onClick={() => { if (window.matchMedia('(hover: none)').matches) setSidebarExpanded(p => !p);   
  }}. On iPad landscape, lg: breakpoint is active AND (hover: none) is true. When the user taps the Settings row to open
  its sub-menu (SidebarContent line 165: onClick={() => expanded && setSettingsOpen(p => !p)}), the click bubbles up to   
  the aside, which toggles the sidebar collapse. Then the effect at line 139 (if (!expanded) setSettingsOpen(false))
  immediately closes the dropdown — net result: dropdown never visibly opens. There is also a race where onMouseLeave can
  fire after a tap on touch devices and force-collapse.

  Fix strategy

  1. Stop the tap on inner controls from toggling the aside. Wrap the aside's tap-toggle so it only fires when the click  
  target is the aside chrome itself, not an interactive descendant. Two viable approaches:
    - Add onClick={(e) => e.stopPropagation()} on the Settings button and on SidebarContent root (cleaner), OR            
    - In the aside handler, check e.target === e.currentTarget (or closest('button,a') is null) before toggling.          
    - Prefer the first — explicit and local to interactive elements.                                                      
  2. Decouple expand/collapse from inner taps on touch. The aside-tap-to-toggle should be triggered by a dedicated        
  affordance (e.g. tapping the collapsed rail when w-16), not anywhere on the expanded sidebar. When sidebarExpanded is   
  true, tapping inside should not collapse it; collapse should require tapping outside or a chevron.                      
  3. Suppress onMouseLeave on touch devices. Wrap with if (!window.matchMedia('(hover: none)').matches) so a tap doesn't  
  immediately fire a synthetic mouseleave that collapses the sidebar before the dropdown renders.                         
  4. Detect iPad landscape explicitly only if needed. Better: feature-detect (hover: none) and (pointer: coarse) rather
  than viewport width — covers iPad portrait/landscape, Android tablets, and touch laptops.                               
  5. Ensure Settings sub-items are reachable inside the dropdown. The dropdown panel at line 184 uses expanded && 
  settingsOpen. After the propagation fix, taps on /dashboard/settings/account, /customize, /admin must also              
  stopPropagation so navigating doesn't accidentally collapse the sidebar mid-route-change.
                                                                                                                          
  Edge cases to cover

  - iPad portrait (still lg: width via Safari? actually 1024px landscape only) — verify both orientations. Portrait at    
  768px hits the mobile drawer, which already works (expanded={true} always at line 338).
  - Hybrid devices with both touch + hover (Surface, touchscreen laptops) — (hover: hover) true, (pointer: coarse) true.  
  Prefer hover-expand; tap-toggle should not interfere.                                                                   
  - Keyboard navigation: tabbing onto the Settings button should still toggle via Enter/Space without collapsing the
  sidebar. Make sure handlers are on <button>, not the wrapper, and the wrapper doesn't swallow focus.                    
  - Sidebar auto-collapse on route change: tapping a sub-item navigates; ensure we don't collapse the sidebar immediately
  on iPad (it'd be jarring). Confirm useEffect watching pathname only closes the mobile drawer (line 308), not the desktop
   expansion — currently correct; preserve it.
  - settingsOpen reset on collapse (line 139): keep this for the hover-collapse case, but make sure it doesn't fire from a
   stray tap event after the propagation fix.                                                                             
  - Outside-tap to collapse: add a click-outside listener on the desktop aside for touch devices so users can still
  collapse it when they want to (replacement for the current bubbling-tap behavior).                                      
  - Scroll inside the dropdown: the <nav> already has overflow-y-auto (line 157). Verify in iPad landscape that the
  expanded dropdown + footer don't get clipped at viewport heights ~820px (Settings panel adds 3 sub-rows — should fit,   
  but worth checking).
  - Animation jank: the dropdown likely uses framer-motion (line 184 region). After the fix, ensure the open animation    
  runs from a stable mounted state (no double-toggle from propagation).                                                   
  - Regression: collapsed-rail tap (when w-16) should still expand the sidebar on iPad — keep that behavior; only block
  the collapse-on-inner-tap path.                                                                                         
                  
  ---                                                                                                                     
  Suggested PR order
                    
  1. Backend entitlement parity audit (read-only) → confirms whether server already honors custom_plan_features.
  2. Frontend entitlement resolver + customize page wiring (Issue 1).                                                     
  3. Sidebar event-propagation + touch-handling fix (Issue 2).                                                            
  4. Manual QA matrix: BASIC+custom plan / FREE / PRO / SUPER_ADMIN × Desktop / iPad landscape / iPad portrait / mobile.