#!/usr/bin/env python3
"""Fix missing spaces in corrupted Latin sentences using Gemini API."""

import json
import os
import re
import time
from typing import Any

from google import genai


client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))


def find_corrupted_sentences(corpus_path: str) -> list[dict[str, Any]]:
    """Find sentences with words > 15 chars (likely missing spaces)."""
    with open(corpus_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    corrupted: list[dict[str, Any]] = []
    for sentence in data["sentences"]:
        latin = sentence["latin"]
        if len(latin) < 20:
            continue
        for word in latin.split():
            clean = re.sub(r"[.,;:!?\[\]()\"']", "", word)
            if len(clean) > 15:
                corrupted.append({"id": sentence["id"], "latin": latin})
                break
    return corrupted


def fix_sentence(latin: str) -> str:
    """Use Gemini to fix missing spaces."""
    prompt = f"""Fix missing spaces in this Latin sentence from Caesar's De Bello Gallico.
Return ONLY the corrected Latin text, nothing else.

Original: {latin}

Corrected:"""

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
    )
    return response.text.strip()


def main() -> None:
    corpus_path = "content/corpus.json"

    with open(corpus_path, "r", encoding="utf-8") as f:
        corpus = json.load(f)

    corrupted = find_corrupted_sentences(corpus_path)
    print(f"Found {len(corrupted)} corrupted sentences")

    sentence_map = {sentence["id"]: sentence for sentence in corpus["sentences"]}
    fixed_count = 0

    for i, item in enumerate(corrupted):
        sid, original = item["id"], item["latin"]
        print(f"[{i + 1}/{len(corrupted)}] Fixing {sid}...")

        try:
            fixed = fix_sentence(original)

            if abs(len(fixed) - len(original)) > len(original) * 0.2:
                print("  WARNING: Skipping - length changed too much")
                continue

            sentence_map[sid]["latin"] = fixed
            fixed_count += 1
            print(f"  ✓ {original[:40]}... → {fixed[:40]}...")
            time.sleep(0.1)
        except Exception as exc:
            print(f"  ERROR: {exc}")

    with open(corpus_path, "w", encoding="utf-8") as f:
        json.dump(corpus, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Fixed {fixed_count} sentences")


if __name__ == "__main__":
    main()
