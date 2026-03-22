#!/usr/bin/env python3

import csv
import re
from pathlib import Path

INPUT_FILE = Path("SNOMED-GPS2.csv")
OUTPUT_FILE = Path("SNOMED-GPS2_split.csv")

SEMANTIC_TAG_RE = re.compile(r"^(.*?)\s*\(([^()]*)\)\s*$")

def split_term(term: str):
    if term is None:
        return "", ""

    term = term.strip()
    match = SEMANTIC_TAG_RE.match(term)
    if match:
        term_clean = match.group(1).strip()
        semantic_tag = match.group(2).strip().lower()
        return term_clean, semantic_tag

    return term, ""

def detect_headers(fieldnames):
    lower_map = {f.lower().strip(): f for f in fieldnames if f}
    code_field = lower_map.get("code")
    term_field = lower_map.get("term")

    if code_field and term_field:
        return code_field, term_field

    # fallback: assume first two columns are code, term
    if len(fieldnames) >= 2:
        return fieldnames[0], fieldnames[1]

    raise ValueError("Could not identify code and term columns")

def main():
    if not INPUT_FILE.exists():
        raise FileNotFoundError(f"Input file not found: {INPUT_FILE}")

    with INPUT_FILE.open("r", newline="", encoding="utf-8-sig") as infile:
        reader = csv.DictReader(infile)
        if not reader.fieldnames:
            raise ValueError("CSV has no header row")

        code_field, term_field = detect_headers(reader.fieldnames)

        rows_out = []
        total = 0
        unmatched = 0

        for row in reader:
            total += 1
            code = (row.get(code_field) or "").strip()
            term = (row.get(term_field) or "").strip()
            term_clean, semantic_tag = split_term(term)

            if not semantic_tag:
                unmatched += 1

            rows_out.append({
                "code": code,
                "term": term,
                "term_clean": term_clean,
                "semantic_tag": semantic_tag,
            })

    with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as outfile:
        writer = csv.DictWriter(
            outfile,
            fieldnames=["code", "term", "term_clean", "semantic_tag"]
        )
        writer.writeheader()
        writer.writerows(rows_out)

    print(f"Processed: {total}")
    print(f"Unmatched semantic tags: {unmatched}")
    print(f"Output written to: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()