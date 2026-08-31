# Chemical vertical - Insights rebuild plan

Companion to `docs/chemical-insights-audit.md` (the findings). This is the proposal: what to record,
what to show, and in what order to build it.
Written to be readable by someone who does not read code.

## 1. The one rule

**If the bot does something for a visitor, it writes one line in a logbook.**

Date. Which feature. What they asked for. Whether we had an answer.

That single line is all the owner's Insights section needs as raw material. Today three of the five
features write nothing at all, which is why their tabs are empty. Everything below is either
"start writing that line" or "read the lines we are already writing".

## 2. What each feature records, and what it deliberately does not

### Certificates (COA)

Record: the date, that a lookup happened, and how it ended - found / not found / the visitor clicked
through to support. Also whether it came from the certificate panel or from the chat.

**Do not record what they typed.** A certificate belongs to one customer's specific batch. A stored
list of the product codes and batch numbers people tried is exactly the list somebody probing the
library would want to build, and it is our client's customers' data, not ours. So certificates give
counts and outcomes, nothing more.

This is already being written to `coa_lookup_events` on every lookup. It has simply never been read.

Why the owner cares: a rising "not found" rate means either the folder is missing recent batches, or
customers are reading codes off drum labels that do not match the filenames in Drive. Both are fixable
in an afternoon, and neither is visible today.

### Specification sheets

Record: the date, the search term, how many sheets matched, and whether the visitor opened one.

Storing the search term is fine here, and this is the difference that matters: a specification sheet is
a public document meant to be browsed. Nothing is leaked by knowing that fourteen people searched
"toluene" last week.

Why the owner cares: the searches that found **nothing** are a to-do list. Either that sheet was never
uploaded, or its filename does not contain the name customers actually use.

### Safety data sheets (SDS)

Record: the date, the search term, and which product was opened.

Why the owner cares: same to-do list, with a compliance edge. A product customers keep looking for that
has no sheet on file is a gap the owner needs to know about before an auditor finds it.

### Sample requests

Already recorded in full. The problem is display, not capture: the shipping address, the company name
and the notes are stored and never shown anywhere the owner looks.

### Quotations

Already recorded in full. The problem is arithmetic: the value shown includes quotes the owner already
marked lost, and the won/lost status they are asked to maintain is read by nothing.

## 3. Privacy and retention

- The logbook holds counts and search words. No IP address, no visitor identifier, nothing that
  identifies a person.
- Keep individual rows for 90 days. Roll them up into daily totals and keep those indefinitely - the
  owner wants a year-on-year trend, not a year of individual rows.
- Certificates never contribute a search word, per §2.

## 4. The three tabs, re-purposed

The chemical bot already gets its own three tabs. They should answer three different questions.

### Pipeline - "what do I need to act on today?"

Four numbers across the top, each over a chosen window (this week / month / quarter), not "the last
hundred records":

| Number | What it means |
|---|---|
| Quote requests | how many priced asks came in |
| Value quoted | total of quotes still open - lost ones excluded |
| Value won | total of quotes the owner marked won |
| Sample requests | samples only, not contact captures |

Below it, the requests table as it is today, plus three additions:
- expand a row to see every field the visitor filled in, address included;
- the visitor's own note printed on the row;
- a CSV export button, matching the one the generic Leads panel already has.

### Conversations - "what did the bot actually say?"

Unchanged, plus one addition: a small marker on each conversation showing which tools ran in it -
quoted, safety sheet, certificate, sample form. The data is already stored; the panel just reads a
different table.

### Operations - "how is my document library performing?"

This is the tab that changes most. Today it shows a conversion funnel fed by a table the chemical bot
never writes to, so it reads zero while Pipeline reads twelve. Replace it with:

**Document activity** - a simple daily chart of lookups, split found / not found, across all three
document features. This is the "everyday searches" view.

**Four counters** - certificate lookups, spec searches, safety sheet opens, and times we came up empty.

**Two lists, which are the point of the whole tab:**
- *Searched for, nothing found* - the spec and SDS searches that returned zero. A direct to-do list.
- *Most requested* - the top products by document opens. Tells the owner what the market wants.

**Library health** - the certificate and specification folder panels that today sit on the Settings
page: how many files are indexed, which ones cannot be found because of their filename, which are
duplicated. They belong on the tab called Operations.

The generic conversion funnel, ROI scorecard, Action queue and Leads panels should be hidden for
chemical bots until they read chemical data. Two panels contradicting each other on one screen is worse
than one of them being absent.

## 5. Three principles to hold the line

1. **Never show a number without a "so what".** A count on its own is decoration. Every number on the
   page should point at a list the owner can act on.
2. **Never ask the owner to maintain a field nothing reads.** They are asked to mark quotes won or lost
   today, and no metric uses it. Either read it or drop the control.
3. **One number, one source.** When two tabs answer the same question from two tables, the owner stops
   trusting both.

## 6. Build order

Sized in working days, roughest possible estimate. Each step ships on its own and is useful on its own.

| # | Step | Days | Needs a new table? |
|---|---|---|---|
| 1 | Show the sample fields already captured - address, company, notes - in the inbox and the owner email | 1 | No |
| 2 | Fix the four wrong numbers on the Pipeline strip (sample count, window, lost quotes, won value) | 1 | No |
| 3 | Create the session row on a hub-card sample submit, so the funnel and "View chat" work | 0.5 | No |
| 4 | Read the certificate events already being written; ship the first Document activity card | 2 | No |
| 5 | Start writing the logbook line for spec and SDS lookups | 2 | One |
| 6 | Build the Operations tab around document activity; move the library panels across | 3 | No |
| 7 | CSV export for quotes and samples; extend the weekly digest to read them | 2 | No |

Steps 1-3 lose nothing and fix things the owner is already looking at. Step 4 costs nothing to capture
because the rows exist. Only step 5 adds storage.
