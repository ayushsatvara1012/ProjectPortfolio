"""Fixture corpus for chunk-integrity measurement (entity-safe-ingestion-plan Phase 0).

Each fixture is raw HTML, so the corpus exercises the REAL extractor rather than
hand-written markdown that flatters the chunker. What ``html_extract.extract`` produces
from these is the input the splitter actually gets in production.

Sized deliberately: ``team_small`` sits under one parent chunk and every other fixture
spans several, because the plan's §0 finding is that a table only breaks once it
exceeds one parent. A corpus of small fixtures would report a clean bill of health for
a pipeline that is not healthy.
"""
from __future__ import annotations


def _team_rows(n: int) -> str:
    return "".join(
        f"<tr><td>Person {i:02d} Name</td><td>Role Title Number {i:02d}</td>"
        f"<td>+91 98200 {i:05d}</td><td>person{i:02d}@acme.example</td></tr>"
        for i in range(n)
    )


def _team_page(n: int) -> str:
    return (
        "<html><body><main><h2>Our Team</h2>"
        "<table><tr><th>Name</th><th>Role</th><th>Phone</th><th>Email</th></tr>"
        f"{_team_rows(n)}</table></main></body></html>"
    )


TEAM_SMALL = _team_page(3)
TEAM_LARGE = _team_page(30)

LOCATIONS = (
    "<html><body><main><h2>Where to find us</h2>"
    "<table><tr><th>Branch</th><th>Address</th><th>Phone</th><th>Hours</th></tr>"
    + "".join(
        f"<tr><td>Branch {i}</td><td>{i} Industrial Estate, Sector {i}, Mumbai 4000{i:02d}</td>"
        f"<td>+91 22 4000 {i:04d}</td><td>Mon-Sat 9:00-18:00</td></tr>"
        for i in range(40))
    + "</table></main></body></html>"
)

FAQ = (
    "<html><body><main><h2>Frequently asked questions</h2><dl>"
    + "".join(
        f"<dt>Question number {i}: what is your lead time for order type {i}?</dt>"
        f"<dd>Lead time for order type {i} is {i + 2} working days from confirmed "
        f"payment, excluding public holidays. Expedited handling is available on "
        f"request and is quoted separately.</dd>"
        for i in range(30))
    + "</dl></main></body></html>"
)

# The FAQ above happens to survive today's splitter: its pairs are short, so the
# recursive splitter's paragraph preference lands boundaries between them. That is luck,
# not a guarantee. Long answers push the boundary INSIDE a pair, stranding a question
# from its answer - so the corpus carries both, and the harness can tell them apart.
FAQ_LONG_ANSWERS = (
    "<html><body><main><h2>Detailed questions</h2><dl>"
    + "".join(
        f"<dt>Question number {i}: what are the storage requirements for grade {i}?</dt>"
        f"<dd>Grade {i} material must be stored between 15 and 25 degrees Celsius in "
        f"the original sealed container, away from direct sunlight and from any "
        f"oxidising agent. The storage area requires mechanical ventilation rated for "
        f"the classification on the label, and a bund capable of retaining the full "
        f"volume of the largest container held. Stock older than the retest date on "
        f"the certificate must be quarantined and re-analysed before use, and the "
        f"result recorded against the original batch number. Containers that have "
        f"been opened must be resealed under nitrogen where the specification calls "
        f"for it, and the opening date written on the label.</dd>"
        for i in range(12))
    + "</dl></main></body></html>"
)

JSONLD_CONTACT = (
    '<html><head><script type="application/ld+json">'
    '{"@context":"https://schema.org","@type":"Organization","name":"Acme Chemicals",'
    '"telephone":"+91 22 4000 0000","email":"contact@acme.example",'
    '"address":{"@type":"PostalAddress","streetAddress":"14 Industrial Estate",'
    '"addressLocality":"Mumbai","postalCode":"400001","addressCountry":"IN"},'
    '"contactPoint":[{"@type":"ContactPoint","contactType":"sales",'
    '"telephone":"+91 22 4000 0001","email":"sales@acme.example"},'
    '{"@type":"ContactPoint","contactType":"technical support",'
    '"telephone":"+91 22 4000 0002","email":"support@acme.example"}]}'
    "</script></head><body><main><h1>Contact us</h1>"
    "<p>Our office is open Monday to Saturday.</p></main></body></html>"
)

POLICY = (
    "<html><body><main><h2>Shipping and returns</h2>"
    + "".join(
        f"<h3>Clause {i}</h3><p>Goods under clause {i} must be inspected within "
        f"{i + 1} days of delivery. Claims raised after that window are assessed at "
        f"our discretion and may require photographic evidence of the batch label, "
        f"the outer packaging and the seal. Returns of opened containers are not "
        f"accepted for hazardous classifications.</p>"
        for i in range(8))
    + "</main></body></html>"
)

CORPUS = {
    "team_small": TEAM_SMALL,
    "team_large": TEAM_LARGE,
    "locations": LOCATIONS,
    "faq": FAQ,
    "faq_long_answers": FAQ_LONG_ANSWERS,
    "jsonld_contact": JSONLD_CONTACT,
    "policy": POLICY,
}
