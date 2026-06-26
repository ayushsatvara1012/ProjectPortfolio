"""Unit tests for the Expresolv price-list parser (scripts/ingest_pricelist.py).

A misparsed row = a wrong price, so these pin the tricky real-catalog shapes:
POR, 12%/0% GST, bracketed/absent CAS, multipack cartons, multi-word grades, and
rows with no HSN. Pure string logic — no PDF, no pypdf, no DB.
"""
from scripts.ingest_pricelist import parse_line, _norm_pack_size


def test_basic_priced_row_with_bracketed_cas():
    r = parse_line("[64-19-7] Acetic acid glacial 29.15.2100 LR 149LR0500M 500 ml 392 18%")
    assert r["product_name"] == "Acetic acid glacial"
    assert r["cas_number"] == "64-19-7"          # brackets stripped
    assert r["grade"] == "LR"
    assert r["pack_size"] == "500 ml"
    assert r["list_price"] == 392 and r["gst_rate"] == 18 and r["is_por"] is False


def test_por_row_has_no_price():
    r = parse_line("[64-19-7] Acetic acid glacial 29.15.2100 LR 149LR025L 25 Ltr POR 18%")
    assert r["is_por"] is True and r["list_price"] is None


def test_zero_percent_gst_row():
    r = parse_line("7647-14-5 Sodium chloride 28.27.3990 LR 634LR0500G 500 gm 210 0%")
    assert r["gst_rate"] == 0 and r["list_price"] == 210


def test_twelve_percent_gst_and_multipack_carton():
    r = parse_line("7722-84-1 Hydrogen peroxide 30% w/v 28.47.0000 LR 120LR0500M 20 x 500 ml 11143 12%")
    assert r["gst_rate"] == 12                    # the inner "30%" must not be read as GST
    assert r["pack_size"] == "20 x 500 ml"        # carton kept verbatim
    assert r["list_price"] == 11143


def test_multi_word_grade():
    r = parse_line("[67-64-1] Acetone 2914.11.00 AR DRY 100DR0500M 500 ml. 639 18%")
    assert r["grade"] == "AR DRY" and r["pack_size"] == "500 ml." and r["list_price"] == 639


def test_no_hsn_row_still_splits_name_and_grade():
    r = parse_line("1344-28-1 Aluminium oxide neutral LR 729LR025K 25 Kg POR 18%")
    assert r["product_name"] == "Aluminium oxide neutral"
    assert r["grade"] == "LR" and r["is_por"] is True and r["hsn_code"] is None


def test_dashes_mean_no_cas():
    r = parse_line("--- Benedict's reagent (Qualitative) 38.22.0090 LR 202LR0500M 500 ml 338 18%")
    assert r["cas_number"] is None
    assert r["product_name"] == "Benedict's reagent (Qualitative)"


def test_non_data_lines_return_none():
    assert parse_line("CAS No. Product Name HSN Code Grade Pack Code Pack Size List Price GST") is None
    assert parse_line("") is None
    assert parse_line("Expresolv complete product range") is None


def test_pack_size_normalisation_equivalences():
    assert _norm_pack_size("2.5 Ltr") == _norm_pack_size("2.5 litre")
    assert _norm_pack_size("500 ml.") == _norm_pack_size("500 ml")
