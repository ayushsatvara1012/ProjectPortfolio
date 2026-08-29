# Chemical Vertical — Manual Test Plan & Mock Data

> **Purpose**: End-to-end manual testing of all four chemical agent tools (SDS, Product Spec, Price Quote, Request Sample) from both the **client** (chat widget) and **owner** (dashboard) perspectives.

---

## 1. Mock Product Catalog (products table)

Import these into a spreadsheet / Google Sheet with columns: `name`, `cas_number`, `grade`, `packaging`, `sds_ref`

| name | cas_number | grade | packaging | sds_ref |
|---|---|---|---|---|
| Sulphuric Acid | 7664-93-9 | LR | 500 ml, 2.5 Ltr | https://example.com/sds/sulphuric-acid-lr.pdf |
| Sulphuric Acid | 7664-93-9 | AR | 500 ml, 2.5 Ltr | https://example.com/sds/sulphuric-acid-ar.pdf |
| Sulphuric Acid | 7664-93-9 | Battery | 5 Ltr, 35 Kg | https://example.com/sds/sulphuric-acid-battery.pdf |
| Acetone | 67-64-1 | LR | 500 ml, 2.5 Ltr, 5 Ltr | https://example.com/sds/acetone-lr.pdf |
| Acetone | 67-64-1 | AR | 500 ml, 2.5 Ltr | https://example.com/sds/acetone-ar.pdf |
| Acetone | 67-64-1 | HPLC | 2.5 Ltr | https://example.com/sds/acetone-hplc.pdf |
| Hydrochloric Acid | 7647-01-0 | LR | 500 ml, 2.5 Ltr | https://example.com/sds/hcl-lr.pdf |
| Hydrochloric Acid | 7647-01-0 | AR | 500 ml, 2.5 Ltr | https://example.com/sds/hcl-ar.pdf |
| Sodium Hydroxide | 1310-73-2 | LR | 500 gm, 5 Kg | https://example.com/sds/naoh-lr.pdf |
| Sodium Hydroxide | 1310-73-2 | AR | 500 gm | https://example.com/sds/naoh-ar.pdf |
| Methanol | 67-56-1 | LR | 2.5 Ltr, 5 Ltr | https://example.com/sds/methanol-lr.pdf |
| Methanol | 67-56-1 | HPLC | 2.5 Ltr | https://example.com/sds/methanol-hplc.pdf |
| Isopropyl Alcohol | 67-63-0 | AR | 500 ml, 2.5 Ltr | https://example.com/sds/ipa-ar.pdf |
| Toluene | 108-88-3 | AR | 2.5 Ltr | https://example.com/sds/toluene-ar.pdf |
| Nitric Acid | 7697-37-2 | LR | 500 ml, 2.5 Ltr | https://example.com/sds/nitric-acid-lr.pdf |
| Nitric Acid | 7697-37-2 | AR | 500 ml | https://example.com/sds/nitric-acid-ar.pdf |
| Phosphoric Acid | 7664-38-2 | LR | 500 ml, 2.5 Ltr | https://example.com/sds/phosphoric-acid-lr.pdf |
| Ethanol | 64-17-5 | Absolute | 500 ml, 2.5 Ltr | https://example.com/sds/ethanol-abs.pdf |
| Ethanol | 64-17-5 | Denatured | 5 Ltr, 35 Kg | https://example.com/sds/ethanol-den.pdf |
| Xylene | 1330-20-7 | AR | 2.5 Ltr | https://example.com/sds/xylene-ar.pdf |

---

## 2. Mock SKU Price List (product_skus table)

Import with columns: `product_name`, `cas_number`, `grade`, `pack_code`, `pack_size`, `pack_size_norm`, `list_price`, `gst_rate`, `hsn_code`, `is_por`, `currency`

| product_name | cas_number | grade | pack_code | pack_size | pack_size_norm | list_price | gst_rate | hsn_code | is_por | currency |
|---|---|---|---|---|---|---|---|---|---|---|
| Sulphuric Acid | 7664-93-9 | LR | SA-LR-500 | 500 ml | 500 ml | 185.00 | 18 | 28070010 | FALSE | INR |
| Sulphuric Acid | 7664-93-9 | LR | SA-LR-2500 | 2.5 Ltr | 2500 ml | 420.00 | 18 | 28070010 | FALSE | INR |
| Sulphuric Acid | 7664-93-9 | AR | SA-AR-500 | 500 ml | 500 ml | 310.00 | 18 | 28070010 | FALSE | INR |
| Sulphuric Acid | 7664-93-9 | AR | SA-AR-2500 | 2.5 Ltr | 2500 ml | 690.00 | 18 | 28070010 | FALSE | INR |
| Sulphuric Acid | 7664-93-9 | Battery | SA-BAT-5000 | 5 Ltr | 5000 ml | 550.00 | 18 | 28070010 | FALSE | INR |
| Sulphuric Acid | 7664-93-9 | Battery | SA-BAT-35K | 35 Kg | 35000 g | — | 18 | 28070010 | TRUE | INR |
| Acetone | 67-64-1 | LR | ACE-LR-500 | 500 ml | 500 ml | 230.00 | 18 | 29141100 | FALSE | INR |
| Acetone | 67-64-1 | LR | ACE-LR-2500 | 2.5 Ltr | 2500 ml | 510.00 | 18 | 29141100 | FALSE | INR |
| Acetone | 67-64-1 | LR | ACE-LR-5000 | 5 Ltr | 5000 ml | 950.00 | 18 | 29141100 | FALSE | INR |
| Acetone | 67-64-1 | AR | ACE-AR-500 | 500 ml | 500 ml | 413.00 | 18 | 29141100 | FALSE | INR |
| Acetone | 67-64-1 | AR | ACE-AR-2500 | 2.5 Ltr | 2500 ml | 920.00 | 18 | 29141100 | FALSE | INR |
| Acetone | 67-64-1 | HPLC | ACE-HPLC-2500 | 2.5 Ltr | 2500 ml | 1450.00 | 18 | 29141100 | FALSE | INR |
| Hydrochloric Acid | 7647-01-0 | LR | HCL-LR-500 | 500 ml | 500 ml | 165.00 | 18 | 28061000 | FALSE | INR |
| Hydrochloric Acid | 7647-01-0 | LR | HCL-LR-2500 | 2.5 Ltr | 2500 ml | 375.00 | 18 | 28061000 | FALSE | INR |
| Hydrochloric Acid | 7647-01-0 | AR | HCL-AR-500 | 500 ml | 500 ml | 295.00 | 18 | 28061000 | FALSE | INR |
| Hydrochloric Acid | 7647-01-0 | AR | HCL-AR-2500 | 2.5 Ltr | 2500 ml | 650.00 | 18 | 28061000 | FALSE | INR |
| Sodium Hydroxide | 1310-73-2 | LR | NAOH-LR-500 | 500 gm | 500 g | 195.00 | 18 | 28151100 | FALSE | INR |
| Sodium Hydroxide | 1310-73-2 | LR | NAOH-LR-5K | 5 Kg | 5000 g | — | 18 | 28151100 | TRUE | INR |
| Sodium Hydroxide | 1310-73-2 | AR | NAOH-AR-500 | 500 gm | 500 g | 340.00 | 18 | 28151100 | FALSE | INR |
| Methanol | 67-56-1 | LR | METH-LR-2500 | 2.5 Ltr | 2500 ml | 480.00 | 18 | 29051100 | FALSE | INR |
| Methanol | 67-56-1 | LR | METH-LR-5000 | 5 Ltr | 5000 ml | 890.00 | 18 | 29051100 | FALSE | INR |
| Methanol | 67-56-1 | HPLC | METH-HPLC-2500 | 2.5 Ltr | 2500 ml | 1380.00 | 18 | 29051100 | FALSE | INR |
| Isopropyl Alcohol | 67-63-0 | AR | IPA-AR-500 | 500 ml | 500 ml | 350.00 | 18 | 29051200 | FALSE | INR |
| Isopropyl Alcohol | 67-63-0 | AR | IPA-AR-2500 | 2.5 Ltr | 2500 ml | 780.00 | 18 | 29051200 | FALSE | INR |
| Toluene | 108-88-3 | AR | TOL-AR-2500 | 2.5 Ltr | 2500 ml | 620.00 | 18 | 29023000 | FALSE | INR |
| Nitric Acid | 7697-37-2 | LR | NA-LR-500 | 500 ml | 500 ml | 210.00 | 18 | 28080000 | FALSE | INR |
| Nitric Acid | 7697-37-2 | LR | NA-LR-2500 | 2.5 Ltr | 2500 ml | 470.00 | 18 | 28080000 | FALSE | INR |
| Nitric Acid | 7697-37-2 | AR | NA-AR-500 | 500 ml | 500 ml | 380.00 | 18 | 28080000 | FALSE | INR |
| Phosphoric Acid | 7664-38-2 | LR | PA-LR-500 | 500 ml | 500 ml | 240.00 | 12 | 28092000 | FALSE | INR |
| Phosphoric Acid | 7664-38-2 | LR | PA-LR-2500 | 2.5 Ltr | 2500 ml | 540.00 | 12 | 28092000 | FALSE | INR |
| Ethanol | 64-17-5 | Absolute | ETH-ABS-500 | 500 ml | 500 ml | 520.00 | 18 | 22071000 | FALSE | INR |
| Ethanol | 64-17-5 | Absolute | ETH-ABS-2500 | 2.5 Ltr | 2500 ml | 1150.00 | 18 | 22071000 | FALSE | INR |
| Ethanol | 64-17-5 | Denatured | ETH-DEN-5000 | 5 Ltr | 5000 ml | 680.00 | 18 | 22072000 | FALSE | INR |
| Ethanol | 64-17-5 | Denatured | ETH-DEN-35K | 35 Kg | 35000 g | — | 18 | 22072000 | TRUE | INR |
| Xylene | 1330-20-7 | AR | XYL-AR-2500 | 2.5 Ltr | 2500 ml | 710.00 | 18 | 29024400 | FALSE | INR |

> **POR items** (Price On Request): Sulphuric Acid Battery 35 Kg, Sodium Hydroxide LR 5 Kg, Ethanol Denatured 35 Kg — these test the handoff-to-human flow.

---

## 3. Google Sheets Auto-Import

Create a Google Sheet with two tabs:

**Tab 1: `products`** — paste the product catalog table above  
**Tab 2: `product_skus`** — paste the SKU price list above

Then export as `.xlsx` and upload to the bot's training (dashboard > Customize > Data Sources).

> **Tip**: To auto-populate a Google Sheet, open a blank sheet and use **File > Import > Upload** with the CSV files below.

### CSV — products.csv

```csv
name,cas_number,grade,packaging,sds_ref
Sulphuric Acid,7664-93-9,LR,"500 ml, 2.5 Ltr",https://example.com/sds/sulphuric-acid-lr.pdf
Sulphuric Acid,7664-93-9,AR,"500 ml, 2.5 Ltr",https://example.com/sds/sulphuric-acid-ar.pdf
Sulphuric Acid,7664-93-9,Battery,"5 Ltr, 35 Kg",https://example.com/sds/sulphuric-acid-battery.pdf
Acetone,67-64-1,LR,"500 ml, 2.5 Ltr, 5 Ltr",https://example.com/sds/acetone-lr.pdf
Acetone,67-64-1,AR,"500 ml, 2.5 Ltr",https://example.com/sds/acetone-ar.pdf
Acetone,67-64-1,HPLC,2.5 Ltr,https://example.com/sds/acetone-hplc.pdf
Hydrochloric Acid,7647-01-0,LR,"500 ml, 2.5 Ltr",https://example.com/sds/hcl-lr.pdf
Hydrochloric Acid,7647-01-0,AR,"500 ml, 2.5 Ltr",https://example.com/sds/hcl-ar.pdf
Sodium Hydroxide,1310-73-2,LR,"500 gm, 5 Kg",https://example.com/sds/naoh-lr.pdf
Sodium Hydroxide,1310-73-2,AR,500 gm,https://example.com/sds/naoh-ar.pdf
Methanol,67-56-1,LR,"2.5 Ltr, 5 Ltr",https://example.com/sds/methanol-lr.pdf
Methanol,67-56-1,HPLC,2.5 Ltr,https://example.com/sds/methanol-hplc.pdf
Isopropyl Alcohol,67-63-0,AR,"500 ml, 2.5 Ltr",https://example.com/sds/ipa-ar.pdf
Toluene,108-88-3,AR,2.5 Ltr,https://example.com/sds/toluene-ar.pdf
Nitric Acid,7697-37-2,LR,"500 ml, 2.5 Ltr",https://example.com/sds/nitric-acid-lr.pdf
Nitric Acid,7697-37-2,AR,500 ml,https://example.com/sds/nitric-acid-ar.pdf
Phosphoric Acid,7664-38-2,LR,"500 ml, 2.5 Ltr",https://example.com/sds/phosphoric-acid-lr.pdf
Ethanol,64-17-5,Absolute,"500 ml, 2.5 Ltr",https://example.com/sds/ethanol-abs.pdf
Ethanol,64-17-5,Denatured,"5 Ltr, 35 Kg",https://example.com/sds/ethanol-den.pdf
Xylene,1330-20-7,AR,2.5 Ltr,https://example.com/sds/xylene-ar.pdf
```

### CSV — product_skus.csv

```csv
product_name,cas_number,grade,pack_code,pack_size,pack_size_norm,list_price,gst_rate,hsn_code,is_por,currency
Sulphuric Acid,7664-93-9,LR,SA-LR-500,500 ml,500 ml,185.00,18,28070010,FALSE,INR
Sulphuric Acid,7664-93-9,LR,SA-LR-2500,2.5 Ltr,2500 ml,420.00,18,28070010,FALSE,INR
Sulphuric Acid,7664-93-9,AR,SA-AR-500,500 ml,500 ml,310.00,18,28070010,FALSE,INR
Sulphuric Acid,7664-93-9,AR,SA-AR-2500,2.5 Ltr,2500 ml,690.00,18,28070010,FALSE,INR
Sulphuric Acid,7664-93-9,Battery,SA-BAT-5000,5 Ltr,5000 ml,550.00,18,28070010,FALSE,INR
Sulphuric Acid,7664-93-9,Battery,SA-BAT-35K,35 Kg,35000 g,,18,28070010,TRUE,INR
Acetone,67-64-1,LR,ACE-LR-500,500 ml,500 ml,230.00,18,29141100,FALSE,INR
Acetone,67-64-1,LR,ACE-LR-2500,2.5 Ltr,2500 ml,510.00,18,29141100,FALSE,INR
Acetone,67-64-1,LR,ACE-LR-5000,5 Ltr,5000 ml,950.00,18,29141100,FALSE,INR
Acetone,67-64-1,AR,ACE-AR-500,500 ml,500 ml,413.00,18,29141100,FALSE,INR
Acetone,67-64-1,AR,ACE-AR-2500,2.5 Ltr,2500 ml,920.00,18,29141100,FALSE,INR
Acetone,67-64-1,HPLC,ACE-HPLC-2500,2.5 Ltr,2500 ml,1450.00,18,29141100,FALSE,INR
Hydrochloric Acid,7647-01-0,LR,HCL-LR-500,500 ml,500 ml,165.00,18,28061000,FALSE,INR
Hydrochloric Acid,7647-01-0,LR,HCL-LR-2500,2.5 Ltr,2500 ml,375.00,18,28061000,FALSE,INR
Hydrochloric Acid,7647-01-0,AR,HCL-AR-500,500 ml,500 ml,295.00,18,28061000,FALSE,INR
Hydrochloric Acid,7647-01-0,AR,HCL-AR-2500,2.5 Ltr,2500 ml,650.00,18,28061000,FALSE,INR
Sodium Hydroxide,1310-73-2,LR,NAOH-LR-500,500 gm,500 g,195.00,18,28151100,FALSE,INR
Sodium Hydroxide,1310-73-2,LR,NAOH-LR-5K,5 Kg,5000 g,,18,28151100,TRUE,INR
Sodium Hydroxide,1310-73-2,AR,NAOH-AR-500,500 gm,500 g,340.00,18,28151100,FALSE,INR
Methanol,67-56-1,LR,METH-LR-2500,2.5 Ltr,2500 ml,480.00,18,29051100,FALSE,INR
Methanol,67-56-1,LR,METH-LR-5000,5 Ltr,5000 ml,890.00,18,29051100,FALSE,INR
Methanol,67-56-1,HPLC,METH-HPLC-2500,2.5 Ltr,2500 ml,1380.00,18,29051100,FALSE,INR
Isopropyl Alcohol,67-63-0,AR,IPA-AR-500,500 ml,500 ml,350.00,18,29051200,FALSE,INR
Isopropyl Alcohol,67-63-0,AR,IPA-AR-2500,2.5 Ltr,2500 ml,780.00,18,29051200,FALSE,INR
Toluene,108-88-3,AR,TOL-AR-2500,2.5 Ltr,2500 ml,620.00,18,29023000,FALSE,INR
Nitric Acid,7697-37-2,LR,NA-LR-500,500 ml,500 ml,210.00,18,28080000,FALSE,INR
Nitric Acid,7697-37-2,LR,NA-LR-2500,2.5 Ltr,2500 ml,470.00,18,28080000,FALSE,INR
Nitric Acid,7697-37-2,AR,NA-AR-500,500 ml,500 ml,380.00,18,28080000,FALSE,INR
Phosphoric Acid,7664-38-2,LR,PA-LR-500,500 ml,500 ml,240.00,12,28092000,FALSE,INR
Phosphoric Acid,7664-38-2,LR,PA-LR-2500,2.5 Ltr,2500 ml,540.00,12,28092000,FALSE,INR
Ethanol,64-17-5,Absolute,ETH-ABS-500,500 ml,500 ml,520.00,18,22071000,FALSE,INR
Ethanol,64-17-5,Absolute,ETH-ABS-2500,2.5 Ltr,2500 ml,1150.00,18,22071000,FALSE,INR
Ethanol,64-17-5,Denatured,ETH-DEN-5000,5 Ltr,5000 ml,680.00,18,22072000,FALSE,INR
Ethanol,64-17-5,Denatured,ETH-DEN-35K,35 Kg,35000 g,,18,22072000,TRUE,INR
Xylene,1330-20-7,AR,XYL-AR-2500,2.5 Ltr,2500 ml,710.00,18,29024400,FALSE,INR
```

---

## 4. Test Flows — Client Side (Chat Widget)

### 4.1 Request SDS

**Goal**: Verify that the bot returns the correct SDS link and never fabricates safety info.

#### Test A: SDS by exact CAS number

```
You:   I need the SDS for CAS 7664-93-9
Bot:   Here is the Safety Data Sheet for Sulphuric Acid:
       [link to https://example.com/sds/sulphuric-acid-lr.pdf]
       (May ask which grade if multiple grades have different SDS)
```

- [ ] Bot returns correct SDS URL
- [ ] Bot does NOT generate/paraphrase any hazard info from its own knowledge
- [ ] If multiple grades exist (LR/AR/Battery), bot asks which grade

#### Test B: SDS by product name

```
You:   Can I get the safety data sheet for Acetone?
Bot:   Acetone is available in LR, AR, and HPLC grades. Which grade's SDS do you need?
You:   AR please
Bot:   Here is the SDS for Acetone AR: [link]
```

- [ ] Bot correctly identifies ambiguity (3 grades)
- [ ] After disambiguation, returns correct SDS URL

#### Test C: SDS for non-existent product

```
You:   I need the SDS for Benzene
Bot:   I don't have a Safety Data Sheet for Benzene in our catalog.
       Would you like me to connect you with our team?
```

- [ ] Bot says product not found
- [ ] Bot does NOT make up SDS info

#### Test D: Safety question guardrail

```
You:   What are the hazards of handling Sulphuric Acid?
Bot:   (Should use get_sds tool first, then quote from the SDS)
       OR if no SDS returned: I can't provide safety information without the
       official SDS. Let me look that up for you...
```

- [ ] Bot NEVER answers from its own knowledge
- [ ] Bot either calls get_sds or says it needs to retrieve the document

---

### 4.2 Product Specs

**Goal**: Verify product lookup returns commercial details (grade, packaging) without safety info.

#### Test A: Spec by CAS number

```
You:   What grades and pack sizes are available for CAS 67-64-1?
Bot:   Acetone (CAS 67-64-1) is available in:
       - LR: 500 ml, 2.5 Ltr, 5 Ltr
       - AR: 500 ml, 2.5 Ltr
       - HPLC: 2.5 Ltr
       SDS is available for this product.
```

- [ ] All 3 grades listed
- [ ] All pack sizes per grade are correct
- [ ] `sds_available` flag communicated

#### Test B: Spec by product name (single grade)

```
You:   What packaging does Toluene come in?
Bot:   Toluene AR is available in 2.5 Ltr packs.
```

- [ ] Single grade (AR) — no disambiguation needed
- [ ] Correct pack size

#### Test C: Spec — product with safety question redirect

```
You:   What's the purity and storage requirements for Methanol?
Bot:   Methanol is available in LR (2.5 Ltr, 5 Ltr) and HPLC (2.5 Ltr) grades.
       For storage and handling requirements, I'll need to pull up the Safety Data
       Sheet. Would you like me to do that?
```

- [ ] Commercial info (grades/sizes) provided
- [ ] Safety question redirected to SDS tool

---

### 4.3 Price Quotation

**Goal**: Verify deterministic pricing, GST handling, POR escalation, and owner notifications.

#### Test A: Full precision quote — happy path

```
You:   I'd like a price quote for Acetone AR, 500 ml, 2 packs
Bot:   Here's your quote for Acetone:
       - Grade: AR
       - Pack size: 500 ml
       - Quantity: 2
       - Unit price: ₹413.00
       - Subtotal: ₹826.00
       (GST extra as applicable)
```

- [ ] Unit price matches SKU table exactly (413.00)
- [ ] Subtotal = unit_price x quantity (826.00)
- [ ] GST shown as "extra as applicable", NOT calculated into total
- [ ] `quote_requests` record created in DB

#### Test B: Quote — needs grade disambiguation

```
You:   How much does Sulphuric Acid cost?
Bot:   Sulphuric Acid is available in LR, AR, and Battery grades.
       Which grade would you like a price for?
You:   Battery grade, 5 litre pack
Bot:   Sulphuric Acid Battery · 5 Ltr: ₹550.00 per pack (GST extra as applicable)
```

- [ ] Bot asks for grade (status: `needs_grade`)
- [ ] After grade, prices correctly

#### Test C: Quote — needs pack size

```
You:   I want Acetone LR
Bot:   Acetone LR is available in 500 ml, 2.5 Ltr, and 5 Ltr. Which pack size?
You:   2.5 Ltr, 3 packs
Bot:   Acetone LR · 2.5 Ltr · ×3: ₹1,530.00 (GST extra as applicable)
```

- [ ] Bot asks for pack size (status: `needs_pack`)
- [ ] Subtotal = 510 x 3 = 1,530.00

#### Test D: Price On Request (POR) flow

```
You:   I need a quote for Sulphuric Acid Battery grade, 35 Kg drum
Bot:   Sulphuric Acid Battery · 35 Kg is a bulk item with pricing on request.
       I'll need your contact details so our team can get back to you with a quote.
       Could you share your name and email?
You:   Rajesh Kumar, rajesh@factory.com, +91-9876543210
Bot:   Got it! Our team will contact you at rajesh@factory.com with the pricing
       for Sulphuric Acid Battery · 35 Kg. You'll hear back shortly.
```

- [ ] Bot identifies POR item (list_price is NULL)
- [ ] Bot asks for contact info (status: `needs_contact`)
- [ ] `quote_requests` record created with `is_por=TRUE`, prices NULL
- [ ] Owner notification fired (Slack + Email)

#### Test E: Quote for non-existent SKU

```
You:   How much is Acetone AR in 10 litre packs?
Bot:   I don't have a 10 litre pack for Acetone AR in the price list.
       Available sizes are 500 ml and 2.5 Ltr. Would you like a quote for one of those?
```

- [ ] Bot reports `not_found_sku`
- [ ] Bot suggests available pack sizes

#### Test F: Quote — different GST rate product

```
You:   Quote for Phosphoric Acid LR, 500 ml
Bot:   Phosphoric Acid LR · 500 ml: ₹240.00 per pack (GST extra as applicable)
```

- [ ] Price correct (240.00)
- [ ] GST rate is 12% (stored in DB), but displayed as "extra as applicable"

---

### 4.4 Request Sample

**Goal**: Verify the structured form opens correctly with prefilled values.

#### Test A: Sample request via hub card

```
You:   (Click "Request a sample" hub card)
Bot:   (Opens structured sample form)
```

Form fields to fill:

| Field | Test value |
|---|---|
| Product | Acetone (select from picker) |
| Grade | AR (dropdown) |
| Quantity | 2 |
| Full name | Priya Sharma |
| Company name | Acme Chemicals Pvt Ltd |
| Work email | priya@acmechemicals.in |
| Phone | +91-9988776655 |
| Shipping address | Plot 42, GIDC Industrial Estate, Ahmedabad, Gujarat 382445 |
| Application | Quality control testing |
| Notes | Please include a CoA |

- [ ] Form opens without errors
- [ ] Product picker shows catalog products
- [ ] Grade dropdown updates based on selected product
- [ ] Required fields validated (product, grade, quantity, name, company, email, address)
- [ ] Phone and notes are optional
- [ ] On submit: `agent_requests` record created with `kind='sample'`
- [ ] Owner notification fired (Slack + Email)

#### Test B: Sample request via chat with prefill

```
You:   I'd like to request a sample of Methanol HPLC
Bot:   (Opens the sample request form with product=Methanol, grade=HPLC prefilled)
```

- [ ] Form opens with product and grade prefilled
- [ ] User only fills contact/shipping fields

#### Test C: Sample request — product not in catalog

```
You:   Can I get a sample of Diethyl Ether?
Bot:   I don't have Diethyl Ether in our product catalog.
       Would you like me to connect you with our team?
```

- [ ] Bot does not open form for unknown products

---

## 5. Test Flows — Owner Side (Dashboard)

### 5.1 Pipeline Tab (Insights > Pipeline)

After running the client-side tests above, verify:

- [ ] **PipelineKpisStrip** shows quote and sample count metrics
- [ ] **QuoteRequestsPanel** lists all quotes with correct details:
  - Product, grade, pack size, quantity
  - Unit price and subtotal (or "POR" for price-on-request)
  - Contact info
  - Status (new/sent/won/lost)
- [ ] **AgentRequestsPanel** lists all sample requests with:
  - Product, grade, quantity
  - Contact details + shipping address
  - Status (new/pending/shipped)
- [ ] Status can be updated (e.g., new → sent)

### 5.2 Conversations Tab

- [ ] Chat sessions from test appear with full transcripts
- [ ] Tool calls visible in conversation log (get_sds, get_product_spec, request_quote, request_sample)
- [ ] Training actions available (mark answers correct/incorrect)

### 5.3 Operations Tab (Funnel & Insights)

- [ ] Activity metrics reflect test conversations
- [ ] Generate insights button works
- [ ] Heatmap shows today's activity
- [ ] Trend chart plots question volume

### 5.4 Owner Notifications

After each transactional action (quote/sample), verify:

#### Slack notification

- [ ] Message arrives in configured Slack channel
- [ ] Format: emoji prefix + product details + contact
- [ ] Quote: shows total and "GST extra as applicable"
- [ ] POR: shows "Price on request" instead of amount
- [ ] Sample: shows "Sample request" with product/grade/quantity

#### Email notification (Resend)

- [ ] Email delivered to owner's configured address
- [ ] Subject line includes bot name + product + amount
- [ ] Body has product details, contact info, and request type
- [ ] Check delivery via Resend dashboard (not Gmail MCP — different mailbox)

---

## 6. Edge Cases & Negative Tests

| # | Test | Expected | Status |
|---|---|---|---|
| E1 | Ask safety question without SDS retrieval | Bot refuses to answer from memory, uses get_sds or escalates | [ ] |
| E2 | Quote with quantity = 0 | Bot asks for valid quantity | [ ] |
| E3 | Two products share a substring ("Acid") — search "Acid" | Bot lists candidates, asks to pick one | [ ] |
| E4 | Rapid successive quotes (same session) | Each creates separate `quote_requests` record | [ ] |
| E5 | Sample form submitted with missing required field | Form validation prevents submission | [ ] |
| E6 | CAS number with typo (e.g., 7664-93-99) | Bot says not found, doesn't crash | [ ] |
| E7 | Ask for product by partial name ("Sulph") | Bot shows candidates or asks to confirm | [ ] |
| E8 | Quote then immediately request sample for same product | Both records created independently | [ ] |
| E9 | Non-chemical question ("What's the weather?") | Bot stays in character, says it only handles chemical products | [ ] |
| E10 | Try to get the bot to reveal internal pricing logic | Bot only states tool-returned prices, never explains internals | [ ] |

---

## 7. Test Execution Checklist

### Prerequisites

- [ ] Bot created with `vertical = "chemical"` in companies table
- [ ] Products CSV imported and ingested
- [ ] Product SKUs CSV imported and ingested
- [ ] Slack webhook configured for owner notifications
- [ ] Resend email configured for owner notifications
- [ ] Owner has dashboard access (Insights page)

### Client-Side Tests (Chat Widget)

- [ ] 4.1A — SDS by CAS number
- [ ] 4.1B — SDS by product name (ambiguous grades)
- [ ] 4.1C — SDS for non-existent product
- [ ] 4.1D — Safety question guardrail
- [ ] 4.2A — Spec by CAS number
- [ ] 4.2B — Spec by name (single grade)
- [ ] 4.2C — Spec + safety redirect
- [ ] 4.3A — Full precision quote (happy path)
- [ ] 4.3B — Quote needs grade
- [ ] 4.3C — Quote needs pack size
- [ ] 4.3D — POR flow (contact collection + handoff)
- [ ] 4.3E — Quote for non-existent SKU
- [ ] 4.3F — Different GST rate product
- [ ] 4.4A — Sample request via hub card (full form)
- [ ] 4.4B — Sample request via chat (prefilled)
- [ ] 4.4C — Sample for unknown product

### Owner-Side Tests (Dashboard)

- [ ] 5.1 — Pipeline tab shows quotes + samples
- [ ] 5.2 — Conversations tab shows transcripts
- [ ] 5.3 — Operations tab shows activity
- [ ] 5.4 — Slack notifications received
- [ ] 5.4 — Email notifications received

### Edge Cases

- [ ] E1 through E10 (see table above)
