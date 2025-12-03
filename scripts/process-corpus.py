#!/usr/bin/env python3
"""
Corpus Processing Pipeline for Caesar in a Year

Transforms Perseus TEI XML (Latin) + MIT Classics HTML (English) into
a structured corpus.json for the learning app.

Usage:
    python scripts/process-corpus.py --book 1 --chapter 1
    python scripts/process-corpus.py --book 1 --chapter 1 --force-fetch
    python scripts/process-corpus.py --validate-only content/corpus.json
"""

import argparse
import logging
import re
import sys

from corpus.models import (
    Section,
    SegmentedSentence,
    Sentence,
    FetchError,
    ParseError,
    AlignmentError,
    ValidationError,
    load_frequency_table,
    rank_to_difficulty,
    tokenize_latin,
    validate_corpus_file,
    export_corpus,
)
from corpus.sources import PerseusSource, MITClassicsSource

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
log = logging.getLogger('corpus')

# Exit codes per DESIGN.md
EXIT_SUCCESS = 0
EXIT_FETCH_FAILED = 1
EXIT_PARSE_FAILED = 2
EXIT_ALIGNMENT_FAILED = 3
EXIT_VALIDATION_FAILED = 4


# =============================================================================
# Sentence Segmentation
# =============================================================================

# Latin abbreviations that shouldn't end a sentence
LATIN_ABBREVS = {
    'cf', 'etc', 'i.e', 'e.g', 'viz', 'sc', 'vs', 'cap', 'lib',
    'c', 'a', 'm', 'l', 'p', 'q', 't', 'd', 's', 'n',
}


def segment_regex(text: str) -> list[str]:
    """
    Split Latin text into sentences using regex.

    Handles sentence endings (.!?) and Latin abbreviations.
    """
    if not text or not text.strip():
        return []

    text = ' '.join(text.split())

    # Protect abbreviations
    protected = text
    for abbrev in LATIN_ABBREVS:
        pattern = rf'\b({re.escape(abbrev)})\.'
        protected = re.sub(pattern, r'\1<PERIOD>', protected, flags=re.IGNORECASE)

    # Split on sentence-ending punctuation followed by space and capital
    sentence_pattern = re.compile(r'(?<=[.!?])\s+(?=[A-Z\[])')
    raw_sentences = sentence_pattern.split(protected)

    sentences = []
    for sent in raw_sentences:
        sent = sent.replace('<PERIOD>', '.')
        sent = sent.strip()
        if sent:
            sentences.append(sent)

    return sentences


def segment_latin(sections: list[Section], book: int, chapter: int) -> list[SegmentedSentence]:
    """Segment Latin sections into individual sentences with IDs."""
    all_sentences = []
    sentence_counter = 1

    for section in sections:
        sentences = segment_regex(section.latin_text)

        for position, latin in enumerate(sentences, start=1):
            sentence_id = f"bg.{book}.{chapter}.{sentence_counter}"

            all_sentences.append(SegmentedSentence(
                id=sentence_id,
                latin=latin,
                english="",
                section=section.number,
                position=position,
                alignment_confidence=0.0
            ))
            sentence_counter += 1

    return all_sentences


# =============================================================================
# Translation Alignment
# =============================================================================

def split_english_sentences(text: str) -> list[str]:
    """Split English text into sentences."""
    if not text or not text.strip():
        return []
    text = ' '.join(text.split())
    pattern = re.compile(r'(?<=[.!?])\s+(?=[A-Z])')
    sentences = [s.strip() for s in pattern.split(text) if s.strip()]
    return sentences


def align_translations(
    latin_sentences: list[SegmentedSentence],
    english_sections: list[str]
) -> list[SegmentedSentence]:
    """
    Align Latin sentences with English translations by section and position.

    Strategy:
    1. Group Latin sentences by section
    2. Split English section text into sentences
    3. Match by position within section
    4. Compute confidence based on count match
    """
    # Build section -> sentences map
    sections_map: dict[int, list[SegmentedSentence]] = {}
    for sent in latin_sentences:
        if sent.section not in sections_map:
            sections_map[sent.section] = []
        sections_map[sent.section].append(sent)

    # Process each section
    for section_num, latin_sents in sections_map.items():
        section_idx = section_num - 1
        if section_idx >= len(english_sections):
            for sent in latin_sents:
                sent.english = "[MISSING SECTION]"
                sent.alignment_confidence = 0.0
            continue

        english_text = english_sections[section_idx]
        english_sents = split_english_sentences(english_text)

        latin_count = len(latin_sents)
        english_count = len(english_sents)

        if english_count == 0:
            for sent in latin_sents:
                sent.english = "[MISSING TRANSLATION]"
                sent.alignment_confidence = 0.0
            continue

        # Calculate base confidence from count match
        if latin_count == english_count:
            base_confidence = 1.0
        else:
            ratio = min(latin_count, english_count) / max(latin_count, english_count)
            base_confidence = ratio * 0.8

        # Distribute English sentences across Latin sentences
        if english_count >= latin_count:
            per_latin = english_count / latin_count
            idx = 0.0
            for sent in latin_sents:
                start = int(idx)
                idx += per_latin
                end = int(idx)
                sent.english = ' '.join(english_sents[start:end])
                sent.alignment_confidence = base_confidence
        else:
            per_english = latin_count / english_count
            for i, sent in enumerate(latin_sents):
                eng_idx = min(int(i / per_english), english_count - 1)
                sent.english = english_sents[eng_idx]
                sent.alignment_confidence = base_confidence * 0.9

    return latin_sentences


# =============================================================================
# Lemmatization & Scoring
# =============================================================================

def lemmatize_and_score(sentences: list[SegmentedSentence]) -> list[Sentence]:
    """Compute difficulty scores based on word frequency."""
    freq_table = load_frequency_table()
    default_rank = 400

    result = []
    for order, sent in enumerate(sentences, start=1):
        words = tokenize_latin(sent.latin)

        if not words:
            avg_rank = default_rank
        else:
            ranks = [freq_table.get(w, default_rank) for w in words]
            avg_rank = sum(ranks) / len(ranks)

        difficulty = rank_to_difficulty(avg_rank)

        result.append(Sentence(
            id=sent.id,
            latin=sent.latin,
            referenceTranslation=sent.english,
            difficulty=difficulty,
            order=order,
            alignmentConfidence=sent.alignment_confidence
        ))

    return result


# =============================================================================
# Main Pipeline
# =============================================================================

def process_chapter(book: int, chapter: int, force_fetch: bool, output_path: str) -> int:
    """Run the full pipeline for a single chapter."""
    log.info(f"Processing De Bello Gallico Book {book}, Chapter {chapter}")

    try:
        # Initialize sources
        latin_source = PerseusSource()
        english_source = MITClassicsSource()

        # Step 1: Fetch Latin
        log.info("Fetching Latin from Perseus...")
        sections = latin_source.fetch(book, chapter, force_fetch)
        log.info(f"Parsed {len(sections)} sections")

        # Step 2: Fetch English with section distribution
        log.info("Fetching English from MIT Classics...")
        english_texts = english_source.fetch_with_sections(
            book, chapter, len(sections), force_fetch
        )

        # Merge English into sections
        for section, english in zip(sections, english_texts):
            section.english_text = english

        # Step 3: Segment Latin sentences
        log.info("Segmenting Latin sentences...")
        segmented = segment_latin(sections, book, chapter)
        log.info(f"Segmented into {len(segmented)} sentences")

        # Step 4: Align translations
        log.info("Aligning translations...")
        aligned = align_translations(segmented, english_texts)

        low_confidence = [s for s in aligned if s.alignment_confidence < 0.8]
        if low_confidence:
            log.warning(f"{len(low_confidence)} sentences with low alignment confidence")

        # Step 5: Score difficulty
        log.info("Scoring difficulty...")
        scored = lemmatize_and_score(aligned)

        # Step 6: Export
        log.info(f"Exporting to {output_path}...")
        export_corpus(scored, output_path)

        difficulties = [s.difficulty for s in scored]
        log.info(f"Success! Exported {len(scored)} sentences")
        log.info(f"Difficulty range: {min(difficulties)}-{max(difficulties)}")

        return EXIT_SUCCESS

    except FetchError as e:
        log.error(f"Fetch failed: {e}")
        return EXIT_FETCH_FAILED
    except ParseError as e:
        log.error(f"Parse failed: {e}")
        return EXIT_PARSE_FAILED
    except AlignmentError as e:
        log.error(f"Alignment failed: {e}")
        return EXIT_ALIGNMENT_FAILED
    except ValidationError as e:
        log.error(f"Validation failed: {e}")
        return EXIT_VALIDATION_FAILED


def main():
    parser = argparse.ArgumentParser(
        description="Process De Bello Gallico into structured corpus.json",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/process-corpus.py --book 1 --chapter 1
  python scripts/process-corpus.py --book 1 --chapter 1 --force-fetch
  python scripts/process-corpus.py --validate-only content/corpus.json

Exit codes:
  0 = Success
  1 = Fetch failed (network/404)
  2 = Parse failed (malformed source)
  3 = Alignment failed
  4 = Validation failed
        """
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        '--book', type=int, choices=range(1, 9), metavar='N',
        help='DBG book number (1-8)'
    )
    group.add_argument(
        '--validate-only', type=str, metavar='FILE',
        help='Validate existing corpus.json without processing'
    )

    parser.add_argument(
        '--chapter', type=int, metavar='N',
        help='Chapter number within book (required with --book)'
    )
    parser.add_argument(
        '--force-fetch', action='store_true',
        help='Bypass cache and re-download sources'
    )
    parser.add_argument(
        '--output', type=str, default='content/corpus.json',
        help='Output file path (default: content/corpus.json)'
    )

    args = parser.parse_args()

    if args.validate_only:
        try:
            if validate_corpus_file(args.validate_only):
                log.info("Validation passed")
                return EXIT_SUCCESS
        except (ValidationError, FileNotFoundError) as e:
            log.error(f"Validation failed: {e}")
            return EXIT_VALIDATION_FAILED

    if args.book and not args.chapter:
        parser.error("--chapter is required when --book is specified")

    return process_chapter(args.book, args.chapter, args.force_fetch, args.output)


if __name__ == '__main__':
    sys.exit(main())
