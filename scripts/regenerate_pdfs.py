#!/usr/bin/env python3
"""
PDFs aus geschwärzten Word-Dateien neu erzeugen.
Überschreibt vorhandene PDFs mit demselben Dateinamen (ohne .docx → .pdf).
"""
import os
import subprocess
import sys

try:
    from xhtml2pdf import pisa
except ImportError:
    print("FEHLER: xhtml2pdf nicht installiert.  pip3 install xhtml2pdf")
    sys.exit(1)


def docx_to_pdf(docx_path: str, pdf_path: str) -> bool:
    """Word-Datei → HTML (textutil) → PDF (xhtml2pdf)."""
    html_path = docx_path + ".tmp.html"
    try:
        r = subprocess.run(
            ["textutil", "-convert", "html", "-output", html_path, docx_path],
            capture_output=True, timeout=60,
        )
        if r.returncode != 0:
            return False
        with open(html_path, "rb") as f:
            html = f.read()
        with open(pdf_path, "wb") as f:
            status = pisa.CreatePDF(html, dest=f)
        return status.err == 0 and os.path.getsize(pdf_path) > 0
    except Exception:
        return False
    finally:
        if os.path.exists(html_path):
            os.unlink(html_path)


def find_docx_with_pdf(vault_root: str):
    """Alle .docx-Dateien finden, zu denen eine .pdf existiert.

    Sucht die PDF auch in anderen Ordnern (gleicher Dateiname),
    da Word und PDF oft an verschiedenen Stellen liegen.
    """
    # Alle PDFs im Vault indexieren (Name -> Pfad)
    pdf_index = {}
    for root, dirs, files in os.walk(vault_root):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__pycache__"]
        for f in files:
            if f.endswith(".pdf") and not f.startswith(".~"):
                pdf_index.setdefault(f.lower(), []).append(os.path.join(root, f))

    for root, dirs, files in os.walk(vault_root):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__pycache__"]
        for f in sorted(files):
            if not f.endswith(".docx") or f.startswith(".~"):
                continue
            docx_path = os.path.join(root, f)
            pdf_name = f.rsplit(".", 1)[0].lower() + ".pdf"
            # Zuerst gleicher Ordner, dann global
            local_pdf = docx_path.rsplit(".", 1)[0] + ".pdf"
            if os.path.exists(local_pdf):
                yield docx_path, local_pdf
            elif pdf_name in pdf_index:
                for pdf_path in pdf_index[pdf_name]:
                    yield docx_path, pdf_path


def main():
    vault = os.path.expanduser("~/ObsidianVaults")
    if not os.path.isdir(vault):
        print(f"FEHLER: Vault nicht gefunden: {vault}")
        sys.exit(1)

    total = 0
    created = 0
    skipped = 0

    for docx_path, pdf_path in find_docx_with_pdf(vault):
        rel = os.path.relpath(docx_path, vault)
        if rel.startswith("Privat"):
            continue
        total += 1
        if docx_to_pdf(docx_path, pdf_path):
            created += 1
            print(f"  PDF neu: {os.path.relpath(pdf_path, vault)}")
        else:
            skipped += 1
            print(f"  ÜBERSPRUNGEN: {rel}")

    print(f"\nFertig: {total} Dateien, {created} PDFs erstellt, {skipped} übersprungen")


if __name__ == "__main__":
    main()
