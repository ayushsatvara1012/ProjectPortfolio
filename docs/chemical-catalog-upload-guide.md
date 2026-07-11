# Chemical Bot: Catalog Upload Guide

This guide shows exactly how to format your Excel or CSV file so the chemical bot can quote prices, serve safety data sheets (SDS), and answer product-spec questions.
Compare your sheet to the examples below before uploading.

## What the bot does with your file

When you upload a spreadsheet to a chemical bot, it recognizes a product catalog and stores it in a structured way (not as free text), so the bot's tools can look things up precisely.
Your columns decide which features come to life:

| Feature | What it does | Needs these columns |
|---|---|---|
| Price quote | Quotes a price for a product + grade + pack size, or routes price-on-request to your team | Product Name, CAS No., Grade, Pack Size, List Price |
| SDS lookup | Shows the visitor the official safety data sheet for a product | Product Name, CAS No., Grade, SDS URL |
| Product spec | Tells the visitor the grades and pack sizes available | Product Name, CAS No., Grade, Packaging |
| General Q&A | Answers about delivery, payment, company info, policies | Not a catalog - upload as a document or paste text instead (see the last section) |

You do not need separate files.
One sheet that has both the price columns and an SDS URL column powers all three features automatically.

## The recommended format: one sheet

Put one row per pack size (the smallest sellable unit).
Include an SDS URL column so safety-sheet lookups work.

| Product Name | CAS No. | Grade | Pack Code | Pack Size | List Price | GST | HSN Code | SDS URL |
|---|---|---|---|---|---|---|---|---|
| Acetone | 67-64-1 | LR | 100LR0500M | 500 ml | 413 | 18% | 29.14.1100 | https://yoursite.com/sds/acetone-lr.pdf |
| Acetone | 67-64-1 | LR | 100LR2500M | 2.5 Ltr | 1660 | 18% | 29.14.1100 | https://yoursite.com/sds/acetone-lr.pdf |
| Acetone | 67-64-1 | LR | 100LR025L | 25 Ltr | POR | 18% | 29.14.1100 | https://yoursite.com/sds/acetone-lr.pdf |
| Benzene | 71-43-2 | LR | 103LR0500M | 500 ml | 481 | 18% | 29.02.2000 | https://yoursite.com/sds/benzene-lr.pdf |
| Benzene | 71-43-2 | HPLC & Spec | 103HPLC001L | 1 Ltr | 1349 | 18% | 29.02.2000 | https://yoursite.com/sds/benzene-hplc.pdf |

From this single sheet the bot automatically builds:
- A price list with one entry per pack (for quotes).
- A product list with one entry per product + grade, listing every pack size and the SDS link (for SDS and spec answers).

## Column reference

The header row can use any of the accepted names - the bot recognizes common variations.
The header row does not have to be the first row; title or logo rows above it are skipped.

| Column | Accepted header names | Required for | Notes |
|---|---|---|---|
| Product Name | Product Name, Product, Chemical, Chemical Name, Item, Material | All features | The product's common name. |
| CAS No. | CAS No., CAS, CAS Number, CAS #, CAS RN | All features | Use the plain number, no brackets. See "Common mistakes". |
| Grade | Grade, Purity, Spec, Specification | All features | For example LR, AR, HPLC. Keep the label consistent per product. |
| Pack Size | Pack Size, Size, Pack, Packing, Packaging | Quotes, Spec | Units understood: ml, Ltr, L, Kg, g. For example "500 ml", "2.5 Ltr", "25 Ltr". |
| List Price | List Price, Price, Rate, MRP, Unit Price, Cost, Amount | Quotes | A number, or POR / blank for price-on-request. Currency symbols and commas are cleaned automatically. |
| SDS URL | SDS URL, SDS, SDS Link, MSDS, Safety Data Sheet, Datasheet URL | SDS lookup | Must be a real per-product HTTPS link. See "Common mistakes". |
| Pack Code | Pack Code, SKU, SKU Code, Code, Item Code | Optional | Your internal pack identifier. Recorded on quotes. |
| GST | GST, GST %, Tax, Tax Rate | Optional | For example 18%. Shown to buyers as "GST extra as applicable". |
| HSN Code | HSN Code, HSN, HSN/SAC, HSN No | Optional | Recorded for reference. |

## How each feature reads your data

### Price quote

The bot resolves a quote step by step: product, then grade, then pack size, then it reads the List Price.
It never calculates or invents a price - it only reads the number in your sheet, multiplies by the quantity, and notes that GST is extra.
Every quote also creates a lead record for you and a shareable, read-only quote link.

- If the List Price cell says POR or is left blank, that pack is treated as price-on-request: the bot asks the visitor for their name and email and alerts your team to send a price, instead of quoting a number.
- If two rows for the exact same pack have different prices, the bot refuses to guess and tells the visitor it will confirm with the team. Avoid conflicting duplicate rows.

### SDS lookup

The bot finds the product (by CAS or name, narrowed by grade) and shows the visitor an "Open SDS" button linking to your SDS URL.
It never writes or summarizes safety information itself - the linked document is the source of truth.
If the SDS URL is missing or is not an HTTPS link, the bot says it does not have the sheet and offers to connect the visitor to your team.

### Product spec

The bot tells the visitor which grades and pack sizes are available for a product, using the Grade and Pack Size columns.

## Self-check before you upload

- [ ] There is exactly one header row, and each column has a recognizable name from the reference table.
- [ ] Product Name, CAS No., Grade, Pack Size, and List Price columns are all present.
- [ ] One row per pack size (so "500 ml", "2.5 Ltr", "25 Ltr" are separate rows).
- [ ] CAS numbers are plain, with no brackets or extra spaces (67-64-1, not [67-64-1]).
- [ ] There is an SDS URL column, and each link is a real HTTPS link to that product's sheet (not a placeholder like example.com).
- [ ] Price cells are numbers, or POR / blank for price-on-request.
- [ ] Grades are labelled consistently for the same product.
- [ ] The sheet is your complete catalog (see "Every upload replaces the whole catalog").

## Common mistakes

Brackets or spaces in CAS numbers.
A CAS stored as [67-64-1] will not match a visitor who types 67-64-1.
Quoting by product name still works, but clean CAS numbers make lookups reliable.
Use 67-64-1.

Placeholder SDS links.
A link like https://www.example.com/ passes the HTTPS check but points nowhere, so the "Open SDS" button is broken.
Use a real per-product URL.

Putting the SDS link only in a price-list-looking sheet without recognizing it is optional.
If you leave out the SDS URL column entirely, SDS lookups will not work - the bot will have prices but no safety sheets on file.

Expecting POR to be a special flag.
You do not need a separate "price on request" column.
Just write POR or leave the price blank and that pack routes to your team automatically.

## Every upload replaces the whole catalog

Each upload replaces all catalog data for that bot.
Always upload your complete, current catalog - not a small update sheet - or the rows you leave out will be removed.

Note on safety: if you upload a price-only sheet with no SDS URL column, it updates prices only and does not touch your previously uploaded SDS data.
This is deliberate, so a quick price refresh cannot wipe your safety-sheet links.

## Optional: two separate sheets

If you prefer, you can keep pricing and SDS in two tabs of one Excel workbook (or two files) instead of one combined sheet:

Tab 1 - Price List: Product Name, CAS No., Grade, Pack Code, Pack Size, List Price, GST, HSN Code.

Tab 2 - Products and SDS: Product Name, CAS No., Grade, Packaging (all pack sizes), SDS URL.

Both approaches produce the same result.
The single combined sheet is simpler for most users.

## Everything that is not a catalog

Company information, delivery terms, payment terms, minimum order quantities, and FAQs are not catalog data.
Upload those as a document (PDF), a website URL, or pasted text.
They become part of the bot's general knowledge and power normal conversation, and they show up under "Manage knowledge" in the dashboard.
