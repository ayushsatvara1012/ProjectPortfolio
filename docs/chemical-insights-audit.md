# Chemical vertical - Insights coverage audit

Date: 2026-08-30. Branch: MainV2.
Scope: the five transact/lookup features (COA, Product specs, SDS, Request sample, Quotation) traced from the
visitor's tap to the owner's dashboard, email, Slack and spreadsheet.
Method: read the code, not the plans. Where a plan and the code disagree, the code is reported.

## 1. The two people

- **Visitor**: opens the widget, taps a hub card or types. Six cards exist for a chemical bot
  (`sapybase_ai_engine/packs/chemical.py:201-272`): Request SDS, Product specs, Get a quote, Request a sample,
  Ask a question, Request COA.
- **Owner**: `/dashboard/insights`, three tabs for a chemical bot - Pipeline, Conversations, Operations
  (`src/app/(app)/dashboard/insights/page.tsx:95-107`). Plus owner email, Slack, and an optional sheet webhook.

## 2. Trace table

| Feature | Visitor entry | Persisted to | Owner dashboard | Owner email / Slack | Sheet sink |
|---|---|---|---|---|---|
| Quotation | chat tool `request_quote` | `quote_requests` | Yes - Requests inbox + Pipeline KPIs | POR + valid email only | No |
| Request sample | hub card form, or `request_sample` tool -> same form | `agent_requests` (typed cols + `form_data` JSONB) | Partial - typed columns only | Yes, but product/contact/note only | Yes, full field set - if configured |
| COA | `coa_picker` panel, or `get_coa` tool | `coa_lookup_events` | **No** - table is never read | No | No |
| Product specs | `spec_picker` panel, or `get_product_spec` tool | Panel: nothing. Chat: `agent_sessions.state.products` | Only indirectly, via Product demand | No | No |
| SDS | `sds_picker` panel, or `get_sds` tool | Panel: nothing. Chat: `agent_sessions.state.products` | Only indirectly, via Product demand | No | No |

## 3. Findings

### F1 - The sample form's shipping address and company name reach no owner surface except an optional webhook

The default form has ten fields, including `company` (required) and `address` (required, labelled
"Where should we ship the sample?") - `packs/chemical.py:282-296`.

- Written in full to `agent_requests.form_data` JSONB - `services/agent_runtime/tools/records.py:31-40`.
- `GET /api/companies/{id}/agent-requests` does **not** select `form_data` - `main.py:6070-6091`.
- `RequestsInboxPanel` renders Type / Product / Pack / Qty / Value / Contact / Status / When -
  `src/components/dashboard/RequestsInboxPanel.tsx:186-230`. `note` is returned by the API and never rendered.
- The owner email and Slack payload are built from a handoff dict carrying product, grade, pack, qty, note,
  contact only - `main.py:6288-6295`, rendered at `services/agent_handoff.py:152-177`.
- The sheet sink is the only surface receiving the full set - `main.py:6310-6314` - and it is dormant until
  the owner pastes a webhook URL (`packs/overrides.py:332-342`, deliberately no fallback).

**Consequence.** An owner who has not configured a Google Sheet cannot ship the sample. The single most
operationally necessary field in the feature is captured, stored, and shown nowhere.

### F2 - `coa_lookup_events` is a write-only table

Rows are inserted from both COA paths - the panel (`main.py:6558`) and the chat tool (`main.py:6667`) - via
`_log_coa_event` (`main.py:6442-6477`), plus the contact-support click (`main.py:6574-6592`).
Table created in `alembic_migrations/versions/0040_coa_lookup_events.py`.

Nothing reads it. There is no endpoint, no query, no panel. The "Failed lookups" figure on the Customize page
comes from `coa_throttle.recent_misses`, a Redis ledger (`main.py:5690`), not this table.

**Consequence.** Every COA outcome - strict hit, tolerant hit, refusal, escalation to support, panel vs chat -
is already being measured and is invisible to the owner. This is the cheapest gap on the list to close.

### F3 - The SDS picker and the Spec picker record nothing at all

`GET /api/widget/sds-products` (`main.py:6319`) and `GET /api/widget/spec` (`main.py:6697`) have no event
logging of any kind - compare COA's `_log_coa_event` on the equivalent line.

The widget deliberately writes no chat message either: "nothing is written to chat, this is a static search,
not a conversation turn" - `src/components/chat/ChatWidget.tsx:2344-2348`.

**Consequence.** A visitor can search forty products' safety sheets and spec sheets, open several, and the
owner's dashboard is byte-identical to one where nobody opened the widget. No demand signal, no session,
no funnel movement, no transcript line.

### F4 - A sample submitted from the hub card never advances the funnel, and its "View chat" link is dead

`submit_sample_request` advances the session state (`main.py:6238-6272`) with
`session_store.update_session_state`, whose SQL is a plain `UPDATE ... WHERE session_id = ...`
(`services/session_store.py:252-262`).

The `agent_sessions` row is created only inside the chat path (`main.py:3468-3471`). `POST /api/sessions`
exists (`main.py:7220`) but `ChatWidget` never calls it - only the GET forms at
`ChatWidget.tsx:1787, 2618, 2674`.

So a visitor who taps "Request a sample" and submits without ever chatting updates **zero rows**, silently.
The comment at `main.py:6252-6257` says this wiring exists precisely so lost-sales BI does not false-positive
sessions that were in fact captured. It does not hold for the primary entry path.

The same missing row makes the inbox's "View chat" button (`RequestsInboxPanel.tsx:240-249`) point at a session
with no `chat_logs` rows.

### F5 - The "Sample requests" KPI counts opportunistic contact captures as samples

`PipelineKpis.tsx:99` sets `samples: s.length` over every `agent-requests` row. That table carries two kinds:
`sample` (`main.py:6222`) and `contact` - a phone or email the visitor typed mid-chat
(`services/agent_runtime/pipeline.py:372`).

The inbox's "Samples" filter has the same conflation (`RequestsInboxPanel.tsx:164`, filters on
`source === 'agent'`), and `KIND_LABEL` (`:66`) has no entry for `contact`, so those rows render the raw
lowercase string in the Type column.

### F6 - "All-time" KPIs are actually "the last 100 records"

`PipelineKpis.tsx:82,87` request `?limit=100`; the backend clamps to 200 (`main.py:5921`, `main.py:6054`).
There is no pagination and no date window. The cards are labelled `hint="all-time"` (`:105,107`).

Past 100 quotes the count freezes at 100 and Quoted value stops growing.

### F7 - "Quoted value" includes lost quotes, and `won` is a status nothing consumes

`computePipelineKpis` sums `subtotal` for every non-POR row (`PipelineKpis.tsx:44-70`). `status` is declared on
the row type (`:23`) and never read.

The owner is asked to maintain `new / sent / won / lost` on every quote
(`RequestsInboxPanel.tsx:63-64`, PATCH at `main.py:5455`), and no metric anywhere reads that field back.
There is no won-value number in the product.

### F8 - The Operations tab contradicts the Pipeline tab, and the weekly digest stays silent

- `FunnelPanel` -> `GET /api/funnel` reads `chat_logs` + `lead_capture` (`main.py:7881-7900`).
- `ROIPanel` -> `GET /api/roi-benchmarks` reads `chat_logs` + `lead_capture` (`main.py:7668+`).
- `lead_capture` is written by exactly one endpoint, `POST /api/leads/capture` (`main.py:4522`), called by
  exactly one widget path - the generic "connect me to a human" form (`ChatWidget.tsx:3191`).

Chemical quotes and samples never touch that table. So the Pipeline tab can read "12 sample requests,
INR 4.2L quoted" while the Operations tab's conversion funnel reads 0 leads, 0% conversion, 0 revenue won,
and Action queue / All leads sit empty - on the same screen, for the same bot.

The weekly digest reads the same table (`main.py:10843-10852`) and `should_send_digest` sees zero leads, so a
chemical owner receives no weekly email regardless of how much pipeline the bot produced.

### F9 - No export, no pagination, no date filter on the chemical pipeline

`LeadsPanel` has CSV export (`GET /api/leads/{id}/export`). Quotes and samples have neither an export endpoint
nor a UI affordance. Both list endpoints accept `?limit` only.

### F10 - Document-library health lives in Settings, not in the tab called "Operations"

`CoaLibraryPanel` / `DriveLibraryPanel` - certificate count, unindexable files, duplicate filenames, and the
failed-lookup tripwire - mount only in `src/app/(app)/dashboard/settings/customize/page.tsx:842,867`.
The Operations tab contains the generic conversion funnel instead.

### F11 - Transcripts do not show which tools ran

`agent_sessions.messages.actions` stores the turn's captured `sds` / `quote` / `form` / `coa` / `spec_doc`
payloads (`pipeline.py:45-49, 422`). `ConversationsPanel` reads `GET /api/conversations` which selects from
`chat_logs` (`main.py:7024-7045`) - text only.

The `note` on a `contact` row holds the visitor's actual message (`pipeline.py:369`) and is rendered by neither
the owner inbox nor the fleet admin tab (`settings/admin/AgentRequestsTab.tsx` types it at `:24`, never prints it).

### F12 - Hub-card taps and form abandonment are not measured

`handleHubCardTap` (`ChatWidget.tsx:2150`) fires no beacon. The owner cannot distinguish "five people opened
the sample form" from "five hundred did and all quit at the shipping address" - only the submits are counted.

## 4. What is working

Stated plainly so the audit is not read as uniformly negative.

- A sample submit reaches all three destinations that are wired: the `agent_requests` row, the owner
  email/Slack ping, and the sheet sink. The honesty gate at `main.py:6297-6302` refuses to confirm to the
  visitor when nothing at all was captured.
- Quotes persist to `quote_requests` with a dedup window and a shareable public token, and ping the owner for
  price-on-request with a valid email only (`main.py:4371-4379`) - deliberate tiering, not a gap.
- Status PATCH endpoints for both tables work and are wired to the inbox dropdowns.
- Qualification facts the agent learned in chat do surface as chips on inbox rows (`main.py:6074`,
  `RequestsInboxPanel.tsx:196-206`).
- The COA confidentiality discipline - single refusal, shared throttle across panel and chat, no filename
  ever reaching the model - is rigorous and internally consistent.

## 5. Remediation, in order of value per unit of work

1. **Return `form_data` from `/agent-requests` and render it** as an expandable row detail; add `address`,
   `company` and `notes` to the sample owner email. Closes F1 - the only finding that blocks fulfilment.
2. **Add `GET /api/companies/{id}/coa-events`** over the table that already has the rows, and a
   "Document lookups" card on Operations: lookups, hit rate, refusals, support click-throughs, panel vs chat.
   Closes F2 with no new capture code.
3. **Log spec and SDS lookups** the way COA already does - one `_log_document_event` shared by the three
   panels - then fold them into the same card. Closes F3 and F12's picker half.
4. **Upsert the session row in `submit_sample_request`** before the state update (or have the widget call
   `POST /api/sessions` on open). Closes F4 and repairs the funnel and the "View chat" link.
5. **Fix the KPI strip**: filter `kind === 'sample'`, count server-side over a window instead of `limit=100`,
   exclude `lost` from Quoted value, and add Won value. Closes F5, F6, F7.
6. **Reconcile Operations with Pipeline** - either feed chemical captures into the funnel/ROI inputs, or hide
   the lead_capture-backed panels for chemical bots and put the pipeline's own funnel there. Extend the weekly
   digest to read `quote_requests` + `agent_requests`. Closes F8.
7. Export endpoint for quotes and samples; move the library health panels onto Operations. Closes F9, F10.
8. Render `note` in both request tables, and surface `actions` in the transcript. Closes F11.
