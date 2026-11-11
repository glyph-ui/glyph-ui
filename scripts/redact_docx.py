#!/usr/bin/env python3
"""
Word-Dateien im Vault: personenbezogene Daten (Namen, Adressen, Firmen)
erkennen und schwärzen, dann als PDF exportieren.

Aufruf:
  python3 scripts/redact_docx.py [--dry-run] [--vault /pfad/zum/vault]

Ohne --dry-run werden die Word-Dateien überschrieben und PDFs erzeugt.
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile

try:
    import docx
except ImportError:
    print("FEHLER: python-docx nicht installiert.  pip3 install python-docx")
    sys.exit(1)

# ---------------------------------------------------------------- PII-Muster
STREET_RE = re.compile(
    r"\b[A-ZÄÖÜ][A-Za-zäöüß.-]+?(?:straße|str\.|weg|platz|allee|gasse|ring|damm|chaussee|ufer|garten|park)\s+\d+[a-z]?\b",
    re.IGNORECASE,
)
PLZ_RE = re.compile(r"\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?")
COMPANY_RE = re.compile(
    r"\b[A-ZÄÖÜ][A-Za-zäöüß&\s.,-]{2,}?(?:GmbH|AG|mbH|UG|e\.V\.|KG|OHG|SE|KGaA|GmbH\s*&\s*Co\.?\s*KG)\b"
)
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_RE = re.compile(r"\b(?:\+49|0)\s?\d{2,4}[\s/()-]*\d{3,}[\s/()-]*\d{0,}\b")
PERSON_RE = re.compile(r"\b(?:Herr|Frau|Dr\.?|Prof\.?|Dipl\.?[- ]?\w*)\s+[A-ZÄÖÜ][a-zäöüß]{2,}\b")
# Reine Vorname-Nachname-Paare (z. B. "Alexander Hubert") — ohne Anrede
NAME_PAIR_RE = re.compile(r"\b[A-ZÄÖÜ][a-zäöüß]{2,}\s+[A-ZÄÖÜ][a-zäöüß]{2,}\b")

ALL_PATTERNS = [STREET_RE, PLZ_RE, COMPANY_RE, EMAIL_RE, PHONE_RE, PERSON_RE, NAME_PAIR_RE]
MASK = "\u2588" * 8


def mask_text(text: str) -> str:
    result = text
    for pattern in ALL_PATTERNS:
        result = pattern.sub(MASK, result)
    return result


def has_pii(text: str) -> bool:
    return any(p.search(text) for p in ALL_PATTERNS)


def redact_paragraph(para) -> int:
    """PII in einem Absatz maskieren.

    Word teilt Text oft über mehrere Runs auf (z. B. "IBAU-" | "Hamburg …").
    Deshalb: alle Runs zusammenfassen, maskieren, in den ersten Run zurueck-
    schreiben. Formatierung der Einzel-Runs geht dabei verloren — fuer
    Schwärzung akzeptabel.
    """
    runs = para.runs
    if not runs:
        return 0
    full = "".join(r.text for r in runs)
    if not has_pii(full):
        return 0
    masked = mask_text(full)
    runs[0].text = masked
    for r in runs[1:]:
        r.text = ""
    return 1


def redact_table(table) -> int:
    changed = 0
    for row in table.rows:
        for cell in row.cells:
            for para in cell.paragraphs:
                changed += redact_paragraph(para)
            for nested in cell.tables:
                changed += redact_table(nested)
    return changed


def redact_docx(path: str, dry_run: bool = False) -> dict:
    """Word-Datei öffnen, PII maskieren, speichern. Gibt Statistik zurück."""
    doc = docx.Document(path)
    changed = 0
    total_paras = 0

    for para in doc.paragraphs:
        total_paras += 1
        changed += redact_paragraph(para)

    for table in doc.tables:
        changed += redact_table(table)

    # Kopf-/Fußzeilen
    for section in doc.sections:
        for para in section.header.paragraphs:
            changed += redact_paragraph(para)
        for para in section.footer.paragraphs:
            changed += redact_paragraph(para)

    if changed > 0 and not dry_run:
        doc.save(path)

    return {"changed": changed, "paragraphs": total_paras}


def docx_to_pdf(docx_path: str, pdf_path: str) -> bool:
    """Word-Datei als PDF exportieren.

    Nutzt Microsoft Word (docx2pdf) — erhält die Original-Formatierung.
    """
    try:
        from docx2pdf import convert
        convert(docx_path, pdf_path)
        return os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 0
    except Exception:
        return False


def find_docx_files(vault_root: str):
    """Alle .docx-Dateien im Vault finden (überspringt .~ temporäre Dateien)."""
    for root, dirs, files in os.walk(vault_root):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__pycache__"]
        for f in sorted(files):
            if f.endswith(".docx") and not f.startswith(".~"):
                yield os.path.join(root, f)


def main():
    parser = argparse.ArgumentParser(description="PII in Word-Dateien schwärzen")
    parser.add_argument("--dry-run", action="store_true",
                        help="Nur anzeigen, nichts ändern")
    parser.add_argument("--vault", default=os.path.expanduser("~/ObsidianVaults"),
                        help="Vault-Wurzel (Default: ~/ObsidianVaults)")
    parser.add_argument("--no-pdf", action="store_true",
                        help="Keine PDFs erzeugen, nur Word-Dateien bearbeiten")
    args = parser.parse_args()

    if not os.path.isdir(args.vault):
        print(f"FEHLER: Vault nicht gefunden: {args.vault}")
        sys.exit(1)

    total_files = 0
    total_changed = 0
    total_pdfs = 0

    for docx_path in find_docx_files(args.vault):
        total_files += 1
        rel = os.path.relpath(docx_path, args.vault)
        try:
            stats = redact_docx(docx_path, dry_run=args.dry_run)
        except Exception as e:
            print(f"  ÜBERSPRUNGEN (defekt): {rel}")
            continue

        if stats["changed"] > 0:
            total_changed += 1
            action = "würde ändern" if args.dry_run else "geändert"
            print(f"  {action}: {rel} ({stats['changed']} Stellen)")

            if not args.dry_run and not args.no_pdf:
                pdf_path = docx_path.rsplit(".", 1)[0] + ".pdf"
                if docx_to_pdf(docx_path, pdf_path):
                    total_pdfs += 1
                    print(f"    PDF erstellt: {os.path.basename(pdf_path)}")
                else:
                    print(f"    PDF-Erstellung fehlgeschlagen (kein LibreOffice?)")
        else:
            print(f"  ok: {rel} (keine PII)")

    print(f"\nZusammenfassung: {total_files} Dateien, {total_changed} geändert, {total_pdfs} PDFs erstellt")
    if args.dry_run:
        print("(Dry-Run — nichts wurde verändert)")


if __name__ == "__main__":
    main()
