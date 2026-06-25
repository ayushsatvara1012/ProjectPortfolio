"""Parse the Expresolv price-list PDF into product_skus rows + emit seed SQL.

Phase 4a (Transact). This is a ONE-OFF ingest helper for the chemical test bot —
NOT engine code. It turns the factory's real price list (a SKU-level PDF) into
rows for the ``product_skus`` table so ``request_quote`` prices against real data.

Parsing strategy — correctness over cleverness. A misparsed row = a WRONG PRICE,
which is exactly the bug Phase 4's deterministic discipline exists to prevent. So
we anchor on the fields that are unambiguous from the RIGHT of each line and never
guess a price:

    <CAS?> <product name…> <HSN?> <grade…> <PACK_CODE> <pack size…> <PRICE|POR> <GST%>

  - GST        — trailing ``NN%`` (always present; marks a real data row).
  - price      — token before GST: an integer, or ``POR`` (-> is_por, NULL price).
  - pack_code  — the unique ``^\\d{2,4}[A-Z][A-Z0-9]*$`` token (CAS has hyphens,
                 HSN has dots / is digits-only, grades are letters-only — none
                 collide), so it pivots the line cleanly.
  - pack_size  — everything between pack_code and price (kept verbatim; a
                 ``pack_size_norm`` is derived only for tolerant matching).
  - name|HSN|grade — left of pack_code, split on the HSN anchor when present, else
                 a grade-vocabulary fallback. Grade is stored as-is and surfaced to
                 the buyer to pick from, so a fuzzy name/grade split never mis-prices.

Run:  ./venv/bin/python scripts/ingest_pricelist.py scripts/pl_trial.pdf --company <uuid> --sql > seed.sql
      ./venv/bin/python scripts/ingest_pricelist.py scripts/pl_trial.pdf            # report only
"""
from __future__ import annotations

import argparse
import re
import sys
from typing import Dict, List, Optional

# A pack code: 2–4 leading digits, then a letter, then letters/digits. Unique on a
# row (CAS/HSN/grade can't match this shape), so it is the parse pivot.
PACK_CODE_RE = re.compile(r"^\d{2,4}[A-Z][A-Z0-9]*$")
# CAS-ish leading token: digits/hyphens, optionally bracketed (also matches the
# few 8-digit "CAS" oddballs in the sheet). Markers below mean "no CAS".
CAS_RE = re.compile(r"^\[?\d[\d-]*\d\]?$")
NO_CAS_MARKERS = {"---", "-", "n.a", "n.a.", "na"}
GST_RE = re.compile(r"^(\d{1,2})%$")

# Grade vocabulary — only used to split name|grade on the rare rows that carry NO
# HSN code. Single-token grades; multi-word grades (e.g. "AR DRY", "HPLC & Spec")
# only occur on rows that DO have an HSN, where the anchor split handles them.
GRADE_TOKENS = {
    "LR", "AR", "DRY", "IP", "BP", "USP", "USP-NF", "NF", "US", "EP", "JP",
    "HPLC", "GG", "GC", "GCHS", "SGG", "LCMS", "ET", "ACS", "AR/ACS", "ARACS",
    "PURE", "AQUA", "AQ", "HP", "PH.EUR",
}


def _is_hsn(tok: str) -> bool:
    """HSN code: only digits and dots, with >=6 digits (so '2.5' from a pack size
    or a 3-digit product number never qualifies)."""
    if not re.fullmatch(r"[\d.]+", tok):
        return False
    return sum(c.isdigit() for c in tok) >= 6


def _norm_pack_size(raw: str) -> str:
    """A loose, lowercased pack-size key for tolerant matching (display keeps raw).
    Collapses litre spellings, strips trailing dots/spaces, normalises 'x'."""
    s = raw.lower().strip().rstrip(".")
    s = s.replace("ltr", "l").replace("litre", "l").replace("lit", "l")
    s = re.sub(r"\bx\b", "x", s)
    s = re.sub(r"\s+", " ", s)
    s = s.replace(" .", "").strip()
    return s


def _clean_name(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def parse_line(line: str) -> Optional[Dict]:
    """Parse one joined data line into a SKU dict, or None if it isn't a data row."""
    line = line.strip()
    if not line:
        return None
    toks = line.split()
    if len(toks) < 4:
        return None
    m = GST_RE.match(toks[-1])
    if not m:
        return None  # not a data row (only data rows end in NN%)
    gst_rate = int(m.group(1))

    price_tok = toks[-2]
    is_por = price_tok.upper() == "POR"
    list_price: Optional[int] = None
    if not is_por:
        cleaned = price_tok.replace(",", "")
        if not re.fullmatch(r"\d+", cleaned):
            return None  # price slot isn't a number or POR -> not a clean row
        list_price = int(cleaned)
        if list_price == 0:  # a 0 list price is not "free" — treat as POR
            is_por, list_price = True, None

    # Pivot on the pack code.
    pack_idx = next(
        (i for i, t in enumerate(toks[:-2]) if PACK_CODE_RE.match(t)), None
    )
    if pack_idx is None or pack_idx == 0:
        return None
    pack_code = toks[pack_idx]
    pack_size = " ".join(toks[pack_idx + 1:-2]).strip()
    if not pack_size:
        return None

    # Left of the pack code: CAS? + name + HSN? + grade.
    left = toks[:pack_idx]
    cas: Optional[str] = None
    start = 0
    first = left[0]
    if first.lower() in NO_CAS_MARKERS:
        start = 1
    elif CAS_RE.match(first):
        cas = first.strip("[]")
        start = 1
    mid = left[start:]  # name + HSN? + grade

    hsn: Optional[str] = None
    hsn_idx = next((i for i, t in enumerate(mid) if _is_hsn(t)), None)
    if hsn_idx is not None:
        hsn = mid[hsn_idx]
        name = _clean_name(" ".join(mid[:hsn_idx]))
        grade = _clean_name(" ".join(mid[hsn_idx + 1:])) or None
    else:
        # No HSN: peel a known-grade suffix off the end; the rest is the name.
        g_start = len(mid)
        while g_start > 0 and mid[g_start - 1].upper() in GRADE_TOKENS:
            g_start -= 1
        grade = _clean_name(" ".join(mid[g_start:])) or None
        name = _clean_name(" ".join(mid[:g_start]))
    # Rescue a dotted HSN the PDF glued onto the name with no space (e.g.
    # "...bromide)2804.70.20") — price is unaffected, but the picker reads cleaner.
    if hsn is None:
        mh = re.search(r"(\d{2,4}\.\d{2}\.\d{2,4}(?:\.\d{2})?)$", name)
        if mh:
            hsn = mh.group(1)
            name = name[:mh.start()].strip()
    if not name:
        return None

    return {
        "product_name": name,
        "cas_number": cas,
        "grade": grade,
        "pack_code": pack_code,
        "pack_size": pack_size,
        "pack_size_norm": _norm_pack_size(pack_size),
        "list_price": list_price,
        "gst_rate": gst_rate,
        "hsn_code": hsn,
        "is_por": is_por,
    }


def parse_pdf(pdf_path: str) -> List[Dict]:
    """Extract text from every page, join wrapped name lines, parse data rows.

    A line that doesn't end in ``NN%`` is treated as a wrapped product-name prefix
    and prepended to the next line (the real Expresolv sheet wraps long names)."""
    import pypdf

    reader = pypdf.PdfReader(pdf_path)
    raw_lines: List[str] = []
    for page in reader.pages:
        raw_lines.extend((page.extract_text() or "").splitlines())

    rows: List[Dict] = []
    seen = set()  # dedupe identical (name,grade,pack_code,pack_size,price) repeats
    carry = ""
    for line in raw_lines:
        line = line.strip()
        if not line:
            continue
        candidate = (carry + " " + line).strip() if carry else line
        if GST_RE.match(candidate.split()[-1]) if candidate.split() else False:
            row = parse_line(candidate)
            carry = ""
            if row:
                key = (
                    row["product_name"].lower(), (row["grade"] or "").lower(),
                    row["pack_code"], row["pack_size"], row["list_price"],
                    row["is_por"],
                )
                if key not in seen:
                    seen.add(key)
                    rows.append(row)
        else:
            # Not a terminating data line -> a wrapped name prefix; carry it.
            carry = candidate
    return rows


def _sql_literal(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def emit_sql(rows: List[Dict], company_id: str) -> str:
    cols = ["company_id", "product_name", "cas_number", "grade", "pack_code",
            "pack_size", "pack_size_norm", "list_price", "gst_rate", "hsn_code",
            "is_por"]
    out = [f"DELETE FROM product_skus WHERE company_id = '{company_id}';"]
    values = []
    for r in rows:
        vals = [_sql_literal(company_id)] + [_sql_literal(r[c]) for c in cols[1:]]
        values.append("(" + ", ".join(vals) + ")")
    # Batch in chunks to keep each statement a sane size.
    for i in range(0, len(values), 200):
        chunk = values[i:i + 200]
        out.append(
            f"INSERT INTO product_skus ({', '.join(cols)}) VALUES\n"
            + ",\n".join(chunk) + ";"
        )
    return "\n".join(out)


def emit_products_sql(rows: List[Dict], company_id: str) -> str:
    """Derive the product/grade-level ``products`` rows from the SKU rows.

    ``products`` is keyed one level above pricing (name + grade), so we collapse
    the SKUs: one row per (name, cas, grade) with ``packaging`` = the distinct pack
    sizes joined. ``sds_ref`` is SYNTHESISED for the test bot only — an https stub
    keyed by CAS (matching the seeded-mock convention) so get_sds keeps working;
    a no-CAS product gets NULL (-> get_sds reports no_sheet_on_file, as intended).
    """
    agg: Dict = {}
    for r in rows:
        key = (r["product_name"].lower(), r["cas_number"], (r["grade"] or ""))
        a = agg.setdefault(key, {
            "name": r["product_name"], "cas": r["cas_number"],
            "grade": r["grade"], "packs": [],
        })
        if r["pack_size"] not in a["packs"]:
            a["packs"].append(r["pack_size"])

    out = [f"DELETE FROM products WHERE company_id = '{company_id}';"]
    values = []
    for a in agg.values():
        packaging = ", ".join(a["packs"][:12]) or None
        sds_ref = (
            f"https://sds.chemcorp.com/doc/{a['cas']}" if a["cas"] else None
        )
        vals = [
            _sql_literal(company_id), _sql_literal(a["name"]),
            _sql_literal(a["cas"]), _sql_literal(a["grade"]),
            _sql_literal(packaging), _sql_literal(sds_ref),
        ]
        values.append("(" + ", ".join(vals) + ")")
    cols = "company_id, name, cas_number, grade, packaging, sds_ref"
    for i in range(0, len(values), 200):
        chunk = values[i:i + 200]
        out.append(f"INSERT INTO products ({cols}) VALUES\n" + ",\n".join(chunk) + ";")
    return "\n".join(out)


def _report(rows: List[Dict]) -> None:
    priced = [r for r in rows if not r["is_por"]]
    por = [r for r in rows if r["is_por"]]
    no_grade = [r for r in rows if not r["grade"]]
    gst_set = sorted({r["gst_rate"] for r in rows})
    print(f"parsed rows           : {len(rows)}", file=sys.stderr)
    print(f"  priced              : {len(priced)}", file=sys.stderr)
    print(f"  POR (route-to-human): {len(por)}", file=sys.stderr)
    print(f"  missing grade       : {len(no_grade)}", file=sys.stderr)
    print(f"  distinct products    : {len({r['product_name'].lower() for r in rows})}", file=sys.stderr)
    print(f"  GST rates seen       : {gst_set}", file=sys.stderr)

    # Spot-checks against values read directly off the PDF — fail loudly on drift.
    checks = [
        ("acetone", "LR", "500 ml", 413),
        ("acetic acid glacial", "LR", "500 ml", 392),
        ("hydrochloric acid", "LR", "8 x 500 ml", 2900),
        ("sodium chloride", "LR", "500 gm", 210),
        ("methanol", "LR", "500 ml", 299),
    ]
    print("spot-checks:", file=sys.stderr)
    for name, grade, size, want in checks:
        hit = [
            r for r in rows
            if r["product_name"].lower() == name
            and (r["grade"] or "").upper() == grade.upper()
            and _norm_pack_size(r["pack_size"]) == _norm_pack_size(size)
        ]
        got = hit[0]["list_price"] if hit else None
        gst = hit[0]["gst_rate"] if hit else None
        ok = "OK " if got == want else "FAIL"
        print(f"  [{ok}] {name} {grade} {size}: got {got} (gst {gst}), want {want}",
              file=sys.stderr)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--company", help="company_id to seed (required with --sql)")
    ap.add_argument("--sql", action="store_true", help="emit INSERT SQL to stdout")
    args = ap.parse_args()

    rows = parse_pdf(args.pdf)
    _report(rows)
    if args.sql:
        if not args.company:
            ap.error("--sql requires --company <uuid>")
        print(emit_sql(rows, args.company))
        print(emit_products_sql(rows, args.company))


if __name__ == "__main__":
    main()
