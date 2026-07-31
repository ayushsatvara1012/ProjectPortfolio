# COA confidential access - plan

Chemical vertical.
Amendment to `docs/coa-finder-plan.md`, which shipped a deliberately open, search-first certificate lookup.
The client has since classified COAs as confidential, so the lookup becomes an exact retrieval: you get your certificate or you get nothing, and nothing about the library is discoverable by typing.

## 0. Status - 2026-07-30

**All five phases - A, B, C, D and E - are built and uncommitted, plus L2 (the handoff button) which the owner asked for on top.**
The COA finder itself is complete and committed on `feature/coa-finder` (all five phases), and this amendment changes its visitor-facing half.
Suite green: backend 2033, frontend 541, tsc 0, lint 0 errors.
The owner's four rulings on the deferred list are recorded at the top of §14, and **the browser pass has now run** (§0.1.2).

§14 holds everything deliberately postponed, so it does not have to be re-derived.

What Phase A changed:

- `search()` is gone. `lookup()` replaces it, returning one `CoaDocument` or `None`, with `_matches()` private beneath it so the match *count* cannot leave the module (C3).
- `MAX_RESULTS`, `MIN_QUERY_CHARS` and the four `MATCH_*` strengths are deleted along with the ranking sorts, the fallback pass and the `truncated` flag.
- `MIN_QUERY_TOKENS = 2` replaces the character floor.
- `resolve()` returns `Optional[CoaDocument]`, and re-walks only on a *zero-match* query - see below.
- `/api/widget/coa` returns `{results: [0 or 1 rows], configured}`.
- `get_coa`'s `multiple` status is deleted, and no count reaches the model.

Two things found while building it:

**The forced re-walk had to be keyed on "nothing matched", not "nothing released".**
The obvious port of the old `if not results` would have re-walked Drive on every ambiguous query, because an ambiguous query now returns `None` exactly like a miss does.
A re-walk exists for the certificate uploaded two minutes ago; an ambiguous query has already found its documents and refused them, so walking again returns the same ones.
`resolve()` therefore looks at the private match list rather than at its own return value.

**Conversational phrasing no longer resolves, which makes Phase D load-bearing rather than tidy-up.**
§7.1 of the finder plan taught the matcher to survive prose by keeping the best-matching tier; that fallback is deleted, so "I have a drum of acetone, batch 100.26R016" now matches nothing at all.
Phase D has to make the model send the identifiers alone instead of the visitor's sentence.
Until it does, the chat path answers `not_found` for phrasing that used to work - asserted in `TestLookupRefuses.test_conversational_phrasing_is_refused` so the reversal is deliberate and visible rather than a regression someone rediscovers.

### 0.1 What Phases B, C and D changed

**Phase B** is a new module, `services/coa_throttle.py`, plus the gate in `/api/widget/coa`.
Not part of `coa_drive` because none of it is about Drive: it counts refusals and holds a cooldown.

- `lockout_seconds(company, visitor, ip)` runs *before* the lookup, so a locked-out visitor costs no Drive call and no cache read.
- `record_miss(...)` runs only when a lookup released nothing, and returns the lockout it just earned.
- Keys are `coa:{miss,lock}:{v,ip}:{company_id}:{sha256(identity)[:32]}`.

Four decisions the plan did not settle:

**Identities are hashed into the key.**
`visitor_id` arrives from the browser, so raw it could carry a megabyte, or a `:` that walks into another company's key space.
Hashing fixes the length, removes the separator problem, and keeps a raw IP out of Redis for free.

**A release does NOT clear the miss counter.**
The tempting version - "a success proves you are legitimate" - is the whole attack: anyone probing this library holds one certificate they know exists, so they would reset their allowance by alternating one known-good query with each guess.
That is §11 residual 3 exactly, and it would have made the throttle decorative against the only person it targets.

**The miss that trips the limit answers 429, not the refusal.**
The visitor learns on the attempt that earned it rather than wasting one more, which is the §5.1 argument for a visible lockout applied one request earlier.

**Neither a Drive outage nor an unconfigured folder counts as a miss.**
An outage is our failure, and counting it would lock out the customers who kept trying during it - exactly when they most need the handoff.

Both counters are maintained whether or not Redis answers (C8).
They enforce the same rule, so the in-process one can only ever trip *later* than the shared one - its window is per worker - and can never manufacture a lockout Redis would not have reached.
A Redis error is logged and read as "not locked": the security property is uniqueness, so an outage must cost a throttle, never a certificate.

The widget now sends `visitor_id` on the lookup.
Without it only the per-IP backstop can bind, which is also exactly the case that backstop exists for.

**Phase C** made the panel a lookup rather than a search.

- `CoaPicker` takes one field, one **Request** button, and renders exactly one of seven states.
- Search-as-you-type is gone: the 300ms debounce, the effect keyed on `coaQuery`, the live list, the "Other matches" section, the pinned-row split and the cap hint are all deleted.
- `coaListState` is replaced by `coaPanelState`, which takes an object rather than four positional arguments and adds `locked` and `refused`.
- `coaPinnedRow` and `COA_MIN_QUERY_CHARS` are deleted - there is nothing to pin between and no client-side floor (below).
- `parseCoaEvent` returns one `CoaRow` or `null`, and **refuses a payload carrying more than one row** rather than showing its first.
- The three visitor-facing strings are now exported constants (`COA_REFUSED_MESSAGE`, `COA_LOCKED_MESSAGE`, `COA_OUTAGE_MESSAGE`) so the tests assert the source text rather than a copy of it.
- `CoaPicker` is exported so the tests render the real component; `coa-picker.test.ts` became `.tsx`.
- §6's format sentence is split rather than repeated twice: the placeholder carries the shape (`e.g. 100RG 100.26R016`) and the helper line under the field carries the instruction ("Enter your product code and batch number, exactly as printed on your drum, label or invoice").

Three decisions worth keeping:

**The client does not mirror the two-token floor.**
It would need the tokenizer to count tokens correctly - NFKC, uppercase, split on every run of non-alphanumerics - and a second implementation of the matching rule in TypeScript is exactly the drift D2 and the single-resolver invariant exist to prevent.
So the button is enabled whenever the box is non-blank and the server decides everything else.
The cost is that a customer typing one word spends a request, and after Phase B a miss; the alternative is two rules that can disagree.

**Typing does not clear a previous outcome.**
A released certificate stays on screen while the visitor types their next lookup, and is cleared when Request fires.
Clearing on edit would take the Open and Download buttons away from someone who merely touched the field, which is the persistent-panel behaviour the SDS panel already established (Option A).

**Phase C fixed the lockout wire format, because the panel reads it, and Phase B implements it.**
§5.1 requires the disabled state to be derived from the server's answer, so the client needs a signal:

> A locked-out lookup returns **HTTP 429** with `{"detail": {"code": "COA_LOCKED_OUT", "message": …, "retry_after": <seconds>}}`.

`coaLockoutMs` reads `retry_after` from either nesting, clamps it to at most an hour, and falls back to 15 minutes when it is missing or unusable.
That timer is the *interface* catching up with the server, never the rule: the backend refuses a locked-out request whatever the field shows, so a fallback that guesses low costs a refusal rather than an unearned certificate.

`coaOutcome(status, body)` was extracted while wiring B in, so "a 429 is the lockout and every other failure is the outage" is a tested rule rather than a branch inside a `.then()`.
A 429 falling through to the outage branch would leave a locked-out visitor pressing Retry against a backend that had already stopped answering, and the field would never disable - the class of wiring defect the Phase 3 browser pass found four of.

The widget was not broken between A and C: the old list UI was already receiving at most one row.

**Phase D** made the conversation obey every rule the panel does (C6), and moved the extraction the matcher stopped doing onto the model.

- `get_coa` takes `visitor_id` and the client IP from the chat request and shares B's counters, so a visitor locked out in the panel is locked out in the chat and vice versa.
- `missing_identifier` is deleted, folded into `not_found` (§7), and `locked_out` is added.
- The refusal and lockout instructions are module constants, so the two paths that can produce them cannot drift apart.
- `parseCoaLockout` carries a cooldown earned in conversation to the panel, which then opens disabled.
- The `get_coa` tool description now requires the identifiers alone, with a worked example, and forbids inventing the half the visitor did not give.

Four more decisions:

**The model does the extraction, and that is the only place it can happen.**
§0's second finding made this load-bearing: the matcher refuses prose, so without extraction the chat answers "not found" to every sentence.
Doing it ourselves would mean parsing English into "product code" and "batch", which is a filename grammar by another name (D2).
The model is the only component here that reads English, so the instruction lives in the tool description - and is asserted in `TestGetCoaToolContract`, because a description is data and a silent edit to it would show up as nothing but a drop in successful lookups.

**A blank call from the model costs the visitor nothing.**
The model calling its own tool with no identifier is the model's mistake; charging a miss for it would let a confused conversation lock a customer out of a certificate they can name perfectly well.
The model still cannot tell that outcome apart from a real refusal - it receives the identical `not_found`.

**A lockout does not open the panel.**
The model's own reply is the visitor-facing message, and a panel that opened only to say "restricted" would be a worse way to hear it.
The cooldown is applied anyway, so the field is already disabled whenever they do reach the panel (§7).

**The model is told to stop, not to wait.**
The lockout instruction forbids retrying, explaining the limit, or suggesting they wait - and carries no number, because the model would read it out, which is the "wait it out" invitation §5.1 refuses to extend.

### 0.1.1 What Phase E changed

The tripwire (§8), and the smallest phase: a daily Redis counter, one field on the report endpoint, one row in `CoaLibraryPanel`.

- `coa_throttle` gains `ledger_key`, `recent_misses` and a private `_record_ledger`, plus `MISS_LEDGER_DAYS = 7` and an 8-day TTL.
- The ledger is written from **inside `record_miss`**, not from the two endpoints.
- `/api/companies/{id}/coa/report` gains `failed_lookups` (nullable) and `failed_lookups_days`.
- `parseCoaReport` gains `failedLookups: number | null` and `failedLookupsDays`, read by a new strict parser rather than by `num`.
- The panel renders a "Failed lookups" row between the stat grid and the notices, and renders nothing at all when the count is `null`.

Four decisions:

**`None` is not zero, and the whole phase turns on it.**
`num()` folds a missing value onto 0, which would have rendered "0 failed lookups" for a company whose Redis is unreachable - telling the owner nobody is guessing at their batch numbers, which is the single assurance §8 exists to avoid giving falsely.
So an absent or failing Redis reads as unknown, the field is `null`, and the panel omits the row entirely.
A quiet week reports 0, and 0 is only reassuring because the unknown case does not borrow it.

**Redis only - deliberately no in-process fallback, unlike the throttle's counters.**
C8's fallback is right for a *control*, where a per-worker approximation still slows someone down.
It is wrong for a *report*: this number is written by every worker and read by one, so an in-process counter would show the owner a fraction of the truth formatted as the whole of it.
Losing an outage's worth of counts is the honest failure (L8).

**The ledger is written from `record_miss`, so it cannot drift from what the throttle counts.**
Written from the endpoints instead, it would have needed the same four exclusions repeated twice: a Drive outage, an unconfigured folder, a lockout-blocked attempt and the model's own blank call are none of them someone guessing, and all of them already fail to reach `record_miss`.

**The key carries no visitor identity.**
`coa:missday:{company_id}:{YYYY-MM-DD}`, a count and nothing else.
Surfacing *who* missed is the privacy decision L1 declines to make in passing, and it is not needed to see a batch sequence being walked.
UTC days, and the panel states a rolling window rather than "today", so an owner in IST never sees a boundary that disagrees with their clock.

### 0.1.2 The browser pass - 2026-07-30

Done, and it found **one defect the whole suite was green through**, which is the same rate the Phase 3 pass hit.

Harness as recorded in `coa-finder-plan.md` §0.1, simplified: the real backend was never started, so a stub on `127.0.0.1:8000` (the dev proxy target `next.config.mjs` hardcodes) served `/api/config`, `/api/widget/coa` and `/api/handoff`, backed by the **real** `coa_drive.lookup`, the **real** `coa_throttle` and the **real** chemical pack's hub cards over the §3 fixture filenames.
No worktree was needed because the working tree is what was under test and nothing shared had to be edited.
The owner panel was viewed through a temporary `/coa-panel-preview` route, since the dashboard is behind Clerk; that route has been deleted.

| Defect | Why no test caught it |
|---|---|
| **The lockout panel rendered the literal word "lock" at 30px** instead of a padlock. `MIcon` falls back to `<span>{name}</span>` for a name in neither icon registry, and the widget ships its own SVG paths rather than the Material Symbols font, so Phase C's `lock` never existed | The icons are `aria-hidden`, so nothing queried by role or text can see one. Fixed by adding the path, and closed as a class: a new source-level test asserts every `MIcon name="…"` in the widget resolves in a registry - `lock` was the only one that did not |

One copy change fell out of it: the outage message ended "…or ask us in the chat", which was the route out while the panel had no button.
With L2's button next to it that was two instructions beside two buttons, so it now reads "Please try again in a moment."

Confirmed working, both themes: the panel opens on the prompt with no list (D1); **16 keystrokes fired zero requests and Request fired exactly one** (C7); `100RG 100.26R016` released the one certificate with Open and Download; a released certificate survives typing and is cleared by the next Request; `acetone` gave the single refusal with no count and a live field; **the Contact support button closed the panel, pushed the real handoff form into the chat, and the submission reached the backend**; three misses locked the panel with no countdown and both controls disabled; the button then read "Team notified ✓" and was inert; **the lockout is enforced by the backend** - `curl` with the locked visitor's own `visitorId` and a perfectly valid query answered 429 while a different visitor got 200 for the same query; a Drive outage rendered the outage copy with Retry beside the support button and cost no miss; the unconfigured state disabled both controls and offered the handoff; and the owner panel showed "Failed lookups 12", showed `0` for a quiet week, and rendered **nothing at all** when the count was null.

Still unproven, and not provable here: whether the model actually strips a sentence down to bare identifiers (Phase D).
That needs a real Gemini call, so it waits for a Vercel preview or the first real bot.

### 0.2 Where to resume

Branch `feature/coa-finder`, which already carries the whole COA finder (five phases, committed through `b017ae70` plus the Phase 4 / H5 / H15 commit).
**Nothing in this amendment is committed.**
The working tree holds Phases A-E plus this plan file:

```
M docs/coa-finder-plan.md                            amendment pointer at the top
M sapybase_ai_engine/main.py                         endpoint payload, throttle gate, get_coa statuses, report tripwire
M sapybase_ai_engine/services/coa_drive.py           lookup/_matches/_hits, resolve
M sapybase_ai_engine/packs/chemical.py               get_coa description: identifiers only
M sapybase_ai_engine/tests/test_coa_cache.py         search → lookup
M sapybase_ai_engine/tests/test_coa_drive.py         the lookup suites, rewritten
M sapybase_ai_engine/tests/test_coa_endpoint.py      visitor_id, throttle reset, the D suites
M sapybase_ai_engine/tests/test_coa_resilience.py    resolve returns Optional now
M sapybase_ai_engine/tests/test_coa_report.py        Phase E: the tripwire through the endpoint
M src/components/chat/panels.ts                      coaPanelState, coaOutcome, parseCoaLockout, the messages
M src/components/chat/ChatWidget.tsx                 CoaPicker rewritten, submitCoaLookup replaces the debounce, CoaSupportButton (L2)
M src/components/dashboard/coaReport.ts              failedLookups (nullable), failedLookupsDays
M src/components/dashboard/CoaLibraryPanel.tsx       the Failed lookups row
M src/__tests__/coa-report.test.ts                   Phase E parsing
M src/__tests__/coa-library-panel.test.tsx           Phase E rendering
R src/__tests__/coa-picker.test.ts → .tsx            renders the real CoaPicker now
?? sapybase_ai_engine/services/coa_throttle.py       Phases B + E
?? sapybase_ai_engine/tests/test_coa_throttle.py     Phases B + E, 41 tests
?? docs/coa-confidential-access-plan.md              this file
```

Next: **nothing is left to build.** What remains before this can merge is the browser pass below, the client conversations in L6, and the L5 check on the forwarded client address.

The browser pass is done - see §0.1.2 for what it found and what is still unproven.

Verifying:

```bash
sapybase_ai_engine/venv/bin/python -m pytest tests/ -q
```

```bash
npx tsc --noEmit && npm run test && npm run lint
```

The COA suites are `test_coa_drive.py`, `test_coa_endpoint.py`, `test_coa_cache.py`, `test_coa_resilience.py`, `test_coa_report.py`, `test_coa_config.py`, `test_coa_test_connection.py`, `test_config_coa_folder_leak.py`.

Nothing merges to `MainV2` until this amendment is finished: the `coa` hub card is already enabled, so merging today would ship the open, browsable search this plan exists to remove.

**Path 1 is chosen** (§2.1): the Drive folder stays link-shared and customers keep opening certificates directly on Google.
Path 2 (private folder, files proxied through our backend) is specified in §13 and is not being built.

## 1. The requirement

From the client, 2026-07-30:

- A certificate is released only when the customer enters their product code and batch number correctly.
- No related results, no suggestions, no partial matches - only the certificate they asked for.
- Someone entering wrong values repeatedly is exploring, not shopping, and should be slowed down.
- Every failure tells them to contact support, and says nothing else.

The customer-facing goal is that a person who has a drum in front of them gets their certificate in one action, and a person who does not cannot learn anything about the library at all.

## 2. What is wrong with the shipped design

The shipped search is generous on purpose, and the generosity is the leak.

`search()` matches exact, prefix **or substring**, across every token in the filename - product code, batch, grade and product name (D3).
A second fallback pass returns near-misses when nothing matches strictly, so typos degrade into suggestions.
The floor is two characters.

Measured on the client's real 1,781-document corpus: `EP` returns 48 rows, `acetone` fills the 50-row cap, `chloroform` returns 18.
Every row renders `100RG · 100.26R016 · ACETONE RG` plus a release date, so the result list leaks the production history - which products, which batches, how many, when - without a single PDF being opened.

Reachability is not a meaningful barrier.
`/api/widget/coa` sits behind `verify_api_key_and_origin`, but the widget's API key is in the page the visitor loaded, and `Origin` is only unforgeable from inside a browser.
At the current 30/min per IP, a dictionary of a few hundred chemical names drains the entire library in minutes.

D1's "search-first, never browsable" was a defence against *rendering a listing*.
It was never a defence against *guessing*, and D7 says so in as many words: "search-first is a speed bump, not a gate."
The client has now contradicted D7, which is their call to make.

### 2.1 The fork that was decided - Path 1

Hiding the Drive URL and keeping the folder private are the same decision, not two.

A `webViewLink` opens Google's own viewer, and Google enforces permissions there.
The moment the folder is set to Restricted, that link returns a "request access" page to an anonymous customer.
So a private folder forces every file to be fetched by our backend and streamed to the customer, and a public folder is what makes a direct link work at all.

Three coherent combinations existed:

| | Folder | How the customer opens it | Accepted cost |
|---|---|---|---|
| Path 1 - **chosen** | Link-shared publicly | Direct Google link | The folder is readable by anyone who obtains its URL, and every released link is permanent and unexpirable |
| Path 2 | Private, via service account | Streamed through our backend | One Drive call and a few hundred KB of egress per certificate viewed |
| Path 3 | Private, each requested file made public on demand | Direct Google link | We would need write access to the client's Drive and would leave a growing trail of individually public files |

Path 1 was chosen because the client does not want certificate files passing through the backend.
Path 3 was rejected: it is the only option where we mutate the client's Drive rather than read it.

**Consequence to state plainly to the client:** this plan stops the bot from being a way to browse the library.
It does not make the library private.
The folder link is now an internal secret and has to be treated as one.

## 3. Locked decisions

| # | Decision | Rationale |
|---|---|---|
| C1 | **One input field, not two.** Exact token matches only - no prefix, no substring, no typo fallback | Two labelled fields impose which value goes where, so a customer who reverses them burns a wrong attempt for a cosmetic reason. One box also takes a paste from an invoice in any format, because separators are already ignored |
| C2 | **Release only when the query resolves to exactly one certificate**, and only when it contains at least two tokens | Uniqueness is the actual security property; the field count never was. Zero matches and two hundred matches are both "not released" |
| C3 | **One identical refusal for every content outcome** - nothing found, several found, malformed | A refusal that varies is an oracle telling a guesser when they are warm. This covers what the *library* contains. The throttle state is deliberately outside it - see C4 |
| C4 | **Throttle: 3 misses in 5 minutes → 15-minute lockout, and the lockout is visible.** The input is disabled and the panel says the lookup is restricted. Bound to the visitor, with a wide per-IP ceiling underneath | §5. Reversed 2026-07-30 from the silent cooldown originally planned, on the client's instruction and on the merits - §5.1. The numbers were re-confirmed by the owner on 2026-07-30 against looser (5/10) and stricter (3/60) alternatives, to be retuned once Phase E's count shows what normal looks like |
| C5 | **Direct Drive links stand.** D8 and D10 are unchanged and the folder stays link-shared | Path 1, §2.1 |
| C6 | **The chat path obeys every rule above identically** | `get_coa` and the panel already share one resolver; a laxer conversational path would be a bypass that the model could be talked into |
| C7 | **Misses are counted only on an explicit submission**, never on a keystroke | The panel loses search-as-you-type entirely, so a customer correcting a typo mid-entry cannot burn their allowance |
| C8 | **Counters degrade open when Redis is unavailable** | Availability over a soft control, matching H13's precedent, with an in-process fallback so an outage degrades to "a few tries per worker" rather than "no limit" |

Superseded from `coa-finder-plan.md`: **D1** (search-first browsing), **D3** (every token searchable), **D5** (show every match, visitor picks), **D7** (open to anyone, no gating).
Unchanged: **D2** (no filename grammar), **D4**, **D6**, **D8**, **D9**, **D10**, **D11**, **D12**, **D13**.

D2 survives intact and that matters.
Nothing here parses a filename or knows what a "product code" looks like.
The rule is "every token you typed must match a token in the filename exactly, and only one file may survive," which is as convention-agnostic as the original tokenizer.

## 4. The matching rule

Replaces §7 of `coa-finder-plan.md`.

`search()` is rewritten in place rather than forked, because both visitor paths call it and the single-resolver invariant is what keeps the panel and the bot from disagreeing.
The owner-facing report and Test Connection do not call it and are unaffected.

Given a query:

1. Tokenize as today - NFKC, uppercase, split on every run of non-alphanumerics, drop the extension.
2. **Refuse if fewer than 2 tokens survive.**
3. Match each query token against document tokens by **exact equality only**, plus the existing leading-zero numeric normalization so `26R16` still equals `26R016`.
4. Keep only documents where **every** query token matched.
5. **Release only if exactly one document survives.** Zero, two or two hundred all return nothing.

Everything that made the old function a search is deleted: `MATCH_PREFIX`, `MATCH_SUBSTRING`, the fallback pass, the ranking sorts, the 50-row cap and the `truncated` flag.
Ranking becomes meaningless when the answer is one row or none.

Dedupe stays and becomes load-bearing.
F4 files the same certificate in two month folders, and without collapsing those the correct query would resolve to two documents and be refused.

Worked examples on the real corpus:

| Typed | Tokens | Result |
|---|---|---|
| `100RG 100.26R016` | `100RG`, `100`, `26R016` | the one certificate |
| `100RG_100.26R016` | same | the one certificate - separators never mattered |
| `100.26R016` | `100`, `26R016` | three grades survive → refused |
| `acetone` | one token | refused before matching |
| `acetone LR` | `ACETONE`, `LR` | 16 survive → refused |
| `EP` | one token | refused before matching |
| `100RG 100.26R999` | valid shape | nothing survives → refused |

### 4.1 The two-token floor is weaker than it reads

A dotted batch number tokenizes into two parts on its own, so `100.26R016` satisfies the floor without a product code ever being typed.
The floor therefore does not implement "code and batch" literally - **uniqueness does**.

On this client's data that gap is closed by their own convention: a batch spans several grades (F1), so a batch alone is never unique and is always refused.
That is a property of their filenames, not a rule we enforce, and it is written down here so nobody later reads the floor as a guarantee it is not.

If a client ever appears whose batch numbers are unique per certificate, a batch alone will release that certificate.
Closing that properly needs a notion of what a product code is, which D2 forbids.

## 5. The throttle

New. Replaces nothing.

**Bound to the visitor, not the session, and not primarily to the IP.**

The widget already carries two identities: `sessionId`, which rotates every time someone starts a new conversation, and `visitorId`, which is device-local and persists across conversations ([ChatWidget.tsx:1549](src/components/chat/ChatWidget.tsx:1549)).
Binding to `sessionId` would be defeated by clicking "New conversation," so the counter binds to `visitorId`, which is the identity that actually corresponds one-to-one with a browser.
`visitorId` is already sent to the backend for session history, so no new client-side identity is introduced.

Per IP is deliberately *not* the primary axis.
Corporate offices and mobile carriers put many people behind one address, so a tight per-IP rule punishes exactly the bystanders it is meant to protect, while the person it targets rotates addresses for free.

Two counters:

| Counter | Key | Rule | Purpose |
|---|---|---|---|
| Primary | `coa:miss:v:{company_id}:{hash(visitor_id)}` | 3 misses in 5 minutes → 15-minute cooldown | The tripwire for random typing. Hits only the person who earned it |
| Backstop | `coa:miss:ip:{company_id}:{hash(ip)}` | 20 misses per hour → 15-minute cooldown | Catches a script that clears its `visitorId` between attempts. Loose enough that a shared office never reaches it |

The lock lives in a second key (`coa:lock:…`) rather than in the counter, because the cooldown outlives the counting window and its remaining TTL is what the 429 reports.
Identities are hashed (§0.1).

Both live in Redis and both fall back to an in-process counter when Redis is down (C8).

The panel is already written against the wire format, so Phase B has to emit exactly this: a locked-out lookup returns **HTTP 429** with `{"detail": {"code": "COA_LOCKED_OUT", "retry_after": <seconds>}}`.
`retry_after` is what re-enables the field; leaving it out is not fatal, the panel just falls back to 15 minutes (§0.1).

No timing oracle is introduced: a real miss searches the in-process memo in about 0.02ms, so a short-circuit is not measurably faster.

### 5.1 The lockout is visible - reversed 2026-07-30

This plan originally specified a **silent** cooldown: a throttled request would return the same refusal as a genuine miss, so a guesser could not tell the two apart.
The client asked for the opposite - disable the input so the customer can see the lookup is restricted rather than typing into a box that can no longer answer.

That is the right call, and the security cost is smaller than the original design implied.

**Silence was already detectable by the only person it was meant to fool.**
Anyone probing the library has at least one certificate they know exists - that is how they got the batch format in the first place.
Submitting that known-good query while throttled returns a refusal, which tells them immediately that a limit exists and that they are inside it.
So the silence only ever concealed the throttle from someone with no valid certificate, who is also the person least able to exploit knowing about it.

**What it cost, meanwhile, was real.**
A customer who mistyped three times would keep pressing Request against a system that could no longer answer, receiving the same message each time and having no way to tell that the problem had stopped being their typing.

**The split that matters is preserved.**
C3 hides what the *library* contains - nothing found, several found and malformed stay byte-identical, because those distinctions are the ones that let someone map the folder.
C4 now reveals the *rate limit*, which says nothing about any certificate.

**Behaviour**

- On lockout the panel disables the field and the Request button, and shows: *"Too many unsuccessful attempts. Please contact our support team and we'll help you."*
- **No countdown timer.** A live "try again in 14:32" hands over the exact window and invites the visitor to wait it out. The route offered is support, not patience.
- The field re-enables on its own once the window passes, and on a page reload, without announcing it.

**The disabled field is presentation, never the control.**
Anyone can re-enable an input from their browser's developer tools.
The backend refuses every request from a locked-out visitor regardless of what the interface shows, and the UI state is derived from the server's answer rather than tracked independently by the client.
This is worth stating because a visible lockout invites exactly that assumption.

A customer who genuinely fumbled three times is now told to contact support and can see that they must.
That is the intended outcome, not a side effect - it routes a confused human to a human, and now does so legibly.

## 6. Visitor experience

Replaces §8 of `coa-finder-plan.md`.

The panel opens to a single field and a **Request** button.
Placeholder and helper text carry the format, since there are no field labels to do it: "Enter your product code and batch number, for example 100RG 100.26R016."

Search-as-you-type is removed entirely - the debounce, the live list, the "Other matches" section, the pinned-plus-list layout and the cap hint all go.
Nothing happens until Request is pressed (C7).

Three outcomes:

- **Released.** One certificate card with View and Download, exactly the card shape the SDS panel uses. The field stays available for the next lookup.
- **Refused.** *"We couldn't find that certificate. Please contact our support team and we'll help you."* The field stays enabled.
- **Locked out.** The field and the Request button are disabled, and the panel reads *"Too many unsuccessful attempts. Please contact our support team and we'll help you."* No countdown (§5.1).

Every dead end carries a **Contact support** button, which fires the same handoff the ⋮ menu offers - refused, locked out, Drive outage and never-configured.
It is not offered on a released certificate or an untouched panel, where nothing has gone wrong.
See L2, which this closes.

The refusal is identical for a wrong code, a wrong batch, a single word and a query matching two hundred files.
The lockout is the one state that is deliberately distinguishable, and it describes our rate limit rather than the library.

The existing "we couldn't reach the document library" error for a Drive outage stays distinct from the refusal.
That is a deliberate exception to C3: it is not an oracle, because it does not depend on what was typed, and collapsing it into the refusal would tell a customer their certificate does not exist when in fact Drive is down.

## 7. The chat path

`get_coa` keeps its single free-text identifier slot and applies §4 unchanged, so a conversational request is subject to the identical rule.

Status vocabulary collapses to match:

| Old | New |
|---|---|
| `found` | `found` - panel opens with the certificate |
| `multiple` | **removed** - a non-unique query is a refusal |
| `not_found` | `not_found` - the single refusal, model offers support handoff |
| `missing_identifier` | folded into `not_found`, so the model cannot distinguish "you gave me too little" from "that does not exist". A blank call still costs the visitor no miss - it is the model's mistake, not theirs |
| - | **new** `locked_out` - the visitor is inside a cooldown; the model states that the lookup is temporarily restricted and offers the support handoff, and does not retry |

The count that `_run_get_coa` currently reports to the model is removed.
The model reads it aloud, and "I found 18 certificates" is precisely the information §2 is closing off.

The chat path shares the throttle counters with the panel.
Otherwise the conversation is a bypass, and the model is the easiest thing in the system to talk into trying again.
A visitor who is locked out in the panel is locked out in the chat, and the panel opens in its disabled state if they reach it from a conversation while inside a cooldown.

## 8. Owner visibility

Extends the Phase 4 panel already built in `CoaLibraryPanel.tsx`.

Failed lookups are recorded per company and surfaced as a count over a rolling window, alongside the existing certificate totals.
Probing is completely invisible today, and a tripwire is worth more than another control: the point is that the owner can *see* someone walking the batch sequence.

No new table - a Redis counter with a daily key, consistent with D9's no-DB-table stance for this feature.

As built: `coa:missday:{company_id}:{YYYY-MM-DD}`, incremented inside `record_miss`, summed over 7 UTC days and expiring after 8.
The count is per company and carries no visitor identity, and "we could not read the counter" reports `null` rather than 0 - see §0.1.1.

## 9. Phases

| Phase | What | Files |
|---|---|---|
| A | **Done.** Strict resolution - rewrite `search()` per §4, drop `truncated` from the endpoint payload | `services/coa_drive.py`, `main.py` (`/api/widget/coa`) |
| B | **Done.** Throttle - both counters, Redis plus in-process fallback, visible cooldown, miss recording | `services/coa_throttle.py` (new), `main.py` |
| C | **Done.** Widget - single field, Request button, one result or one message | `components/chat/panels.ts`, `ChatWidget.tsx` (`CoaPicker`) |
| D | **Done.** Chat parity - `get_coa` statuses, count removal, shared counters, identifiers-only extraction | `main.py` (`_run_get_coa`, `_get_coa_observation`), `packs/chemical.py`, `panels.ts` |
| E | **Done.** Owner visibility - failed-lookup count in the certificate panel | `services/coa_throttle.py`, `main.py` (report endpoint), `coaReport.ts`, `CoaLibraryPanel.tsx` |

A and B are independent and can land in either order.
C depends on A. D depends on A and B. E depends on B.

## 10. Tests

Backend:

- §4 table above, asserted case by case against the §3 reference filenames from `coa-finder-plan.md`.
- Two documents surviving returns nothing, and is not silently resolved by ranking.
- F4 duplicates collapse so the correct query resolves to one, not two.
- Numeric tolerance still resolves `26R16` to `26R016`, and still requires the rest of the query to match exactly.
- Every refusal path returns a byte-identical message and no count - asserted against the source text, the way H8 and the single-resolver invariant already are.
- Throttle: third miss inside the window blocks; the block outlives the window; a success does not reset another visitor's counter; Redis down degrades open rather than closed; the IP backstop trips independently of the visitor counter.
- A locked-out request is refused **by the backend**, not merely by the interface - asserted by calling the endpoint directly, since the disabled field is presentation only (§5.1).
- Nothing found, several found and malformed remain byte-identical to each other; only the lockout differs.
- The owner's ledger: a refusal is counted; a visitor rotating their `visitorId` still accumulates in one place; the window rolls; one company's probing never appears in another's report; an unreadable counter is `None` and a quiet week is `0`; reading the report counts as nothing.

Frontend:

- No request fires on keystrokes, exactly one fires per Request press.
- A refusal renders the message and never a list, and leaves the field enabled.
- A lockout disables the field and the button, shows no countdown, and re-enables once the window passes.
- A Drive outage renders the outage copy, not the refusal, and never disables the field.
- The owner's panel shows the failed-lookup count with its window, renders `0` as a real answer, and renders **nothing at all** when the count is unknown.

## 11. Residual risks - accepted, not solved

1. **Every released link is permanent and public.** A customer can forward their certificate URL indefinitely, and we cannot expire it. Path 1's cost.
2. **The folder URL opens the whole library** to anyone who obtains it. Unchanged by this plan.
3. **The batch sequence is walkable.** Batch numbers are structured and sequential (`100.26P001`, `100.26P002`), and product codes come from a small effectively-public set, so someone holding one genuine drum can enumerate a product family. The throttle makes this slow and, after Phase E, visible - it does not make it impossible. Closing it needs identity (email capture) or authorization (proof of purchase), both of which the owner has declined.
4. **A determined guesser can reset `visitorId`.** That is what the IP backstop is for, and the backstop is itself defeatable by rotating addresses. The honest summary is that this stops exploration, not a targeted attack.
5. **The lockout is now visible, so a guesser can pace themselves against it** - two attempts, pause, resume. Accepted knowingly in §5.1: silence was already detectable by anyone holding one valid certificate, and it cost a legitimate customer far more than it cost an attacker.

## 12. Open questions

| # | Question | Blocks |
|---|---|---|
| N1 | Does the client accept that a customer who knows their batch but not their grade code now gets nothing? F1 means that customer exists | Nothing - it is inherent to C2, but they should hear it |
| N2 | Has the client been told the folder link is now an internal secret? | Nothing technical. It is the assumption Path 1 rests on |
| N3 | Exact wording of the refusal message, and whether "contact support" should carry a phone number or route into the existing handoff flow | ~~Phase C~~ - built with §6's wording and no phone number, since we do not have one to print. Still worth putting in front of the client: "contact our support team" is an instruction with no button attached to it |

## 13. Path 2 - if the client later rejects residual 1 or 2

Recorded so the decision does not have to be re-derived.

Make the folder private and serve files through the backend:

- Create a **service account** in our existing GCP project - a Google identity that belongs to a program, with an address like `vaayu-coa-reader@….iam.gserviceaccount.com` that is not a real mailbox and exists only to be shared with.
- The client shares the COA folder with that address as a Viewer, then sets the folder to Restricted.
- `coa_drive` swaps the `key=` query parameter for a bearer token signed from the service account's private key. The Drive calls themselves do not change.
- Certificates are streamed from `files.get?alt=media` through a short-lived opaque token on our own endpoint, so no Drive URL or file ID ever reaches the browser.

This supersedes D8 and D10, removes Q4 from the finder plan's open list (no key in a URL to restrict), and invalidates that plan's quota conclusion, which was computed on the premise that we never fetch file bytes.
Certificates are 30 KB to 750 KB, so the egress is small, but the "settled, do not re-investigate" note becomes wrong and has to be redone.

**Trap:** Drive's "viewers cannot download, print or copy" setting also blocks the file-bytes API, so turning it on would break the proxy. The client must be told not to enable it.

## 14. Deferred - written down so it is not re-derived

Everything here can wait.
None of it blocks the merge; each is recorded because it was decided against *for now* rather than never, and because rediscovering the reasoning costs more than writing it down.

**Owner's rulings, 2026-07-30.**
Four of these were put to the owner directly rather than to the client, and settled:

- **Throttle severity stays 3 tries / 15 minutes.** Ship it, and retune once the Phase E count shows what normal traffic looks like. C4 is confirmed, not provisional.
- **L2 is built** - every dead end in the panel now carries a Contact support button.
- **L1 is declined** - support will not be given a way to lift a lockout.
- **L9 waits** - the owner gets the number, and no alert, until there is a baseline to set a threshold against.

| # | Item | Why it can wait | What doing it would take |
|---|---|---|---|
| L1 | **DECLINED 2026-07-30. Support cannot lift a lockout**, and will not be able to. Every refusal ends "contact our support team", and support has no way to clear a cooldown for the customer who calls | The window is 15 minutes: a caller has waited most of it out before anyone answers. Both build options were considered and rejected - a per-visitor clear needs individual customers' failed attempts shown to the owner, which is a privacy decision rather than a button, and a clear-all button would also free anyone probing at that moment | Nothing. Reopen only if support call volume says otherwise |
| L2 | **DONE 2026-07-30. Every dead end in the panel carries a Contact support button** (`CoaSupportButton` in `ChatWidget.tsx`), firing the same `handleHandoff` the ⋮ menu does - refused, locked out, outage and unconfigured. No phone number (N3): we do not have one to print | - | Done. The panel steps aside so the handoff form is visible, except when a contact link (e.g. `wa.me`) is configured, which opens a tab and leaves a released certificate on screen. When the team is already notified the button reads "Team notified ✓" and is disabled, matching the menu's own vocabulary, so it can never be a dead click |
| L3 | **`retry_after` reaches the browser.** No countdown is rendered (§5.1), but the value is in the 429 body and visible in devtools | §11 residual 5 already accepts that a visible lockout can be paced against. Hiding the number from devtools while the field visibly disables would be theatre | The panel would have to re-enable on a poll rather than a timer, which costs a request per locked-out visitor to conceal something they can infer by trying |
| L4 | **The in-process counter is per worker, and its LRU can evict a lockout under flood.** Both are C8's intended degradation, not accidents | Redis is the authoritative tier and is present in production. The fallback exists so an outage degrades to "a few tries per worker", which it does | Nothing worth building. The honest fix is monitoring that Redis is up, not a better fallback |
| L5 | **The IP backstop assumes `get_remote_address` resolves to the real client.** Behind Render's proxy it must read the forwarded address, or every visitor in the fleet shares one bucket and the backstop is either useless or catastrophic | Pre-existing: every other slowapi limit in the app already rests on this, so the throttle introduces no new exposure | One check against a real request in production. **Do this before relying on the backstop**, because its value is entirely conditional on it |
| L6 | **N1 and N2 are client conversations**, not code: that a customer who knows their batch but not their grade now gets nothing (F1 means that customer exists), and that the folder link is now an internal secret | Neither changes what we build. Both change what the client expects | A message to the client |
| L7 | **DONE 2026-07-30 - the browser pass ran** (§0.1.2) and found one defect, the lockout panel rendering the word "lock" as text. Every visitor-facing state and the owner panel were driven in both themes | - | Done. The one thing it could not prove is the model's identifier extraction, which needs a real Gemini call - that waits for a Vercel preview or the first real bot |
| L8 | **The owner's failed-lookup count under-reports across a Redis outage.** Misses recorded while Redis is down are lost, so the week containing an outage reads low | The alternative - an in-process fallback like the throttle's - would show the owner one worker's fraction of the truth formatted as the whole of it, which is worse than a gap. The panel already distinguishes unknown from zero, so nothing here is stated falsely, only incompletely | Nothing worth building, same as L4. Monitoring that Redis is up is the honest fix |
| L9 | **DEFERRED 2026-07-30 by the owner. No threshold, no alert** - the count is passive and nobody is notified, so a slow probe could run for weeks before anyone opens the panel | A first count with no baseline is the wrong moment to invent "50 a week is suspicious". Some arithmetic that bounds it when the time comes: the throttle caps one visitor at ~12 failed lookups an hour and the IP backstop caps a rotating one at ~20, so sustained probing is a few hundred a day, while honest customer mistakes should be single digits a week | Two routes, both into the existing owner-notify layer (`agent_handoff.py`, Slack + Resend). **Alerting on the LOCKOUT rather than the count is the better one** and was not in the original plan: a lockout already means 3 wrong tries in 5 minutes, so it needs no invented threshold, and rate-limited to one a day it doubles as the "a real customer is stuck" signal L1 declines to build. The count-threshold version is the alternative if lockout pings prove too noisy |
