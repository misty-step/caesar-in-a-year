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
import json
import logging
import os
import re
import sys
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

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
# Data Structures (from DESIGN.md)
# =============================================================================

@dataclass
class RawSources:
    """Fetched source materials, cached locally."""
    latin_xml: str
    english_html: str
    book: int
    chapter: int
    fetched_at: str


@dataclass
class Section:
    """Parsed section within a chapter."""
    number: int
    latin_text: str
    english_text: str = ""


@dataclass
class SegmentedSentence:
    """Individual sentence after segmentation."""
    id: str
    latin: str
    english: str
    section: int
    position: int
    alignment_confidence: float


@dataclass
class Sentence:
    """Final output format matching lib/data/types.ts."""
    id: str
    latin: str
    referenceTranslation: str
    difficulty: int
    order: int
    alignmentConfidence: Optional[float] = None


# =============================================================================
# Custom Exceptions
# =============================================================================

class FetchError(Exception):
    """Raised when source fetching fails."""
    pass


class ParseError(Exception):
    """Raised when source parsing fails."""
    pass


class AlignmentError(Exception):
    """Raised when translation alignment fails critically."""
    pass


class ValidationError(Exception):
    """Raised when output validation fails."""
    pass


# =============================================================================
# Source Fetching (TODO: Implement in next task)
# =============================================================================

def fetch_sources(book: int, chapter: int, force: bool = False) -> RawSources:
    """Fetch Latin XML and English HTML, with local caching."""
    raise NotImplementedError("fetch_sources not yet implemented")


# =============================================================================
# Parsing (TODO: Implement in next task)
# =============================================================================

def parse_latin(xml: str) -> list[Section]:
    """Parse Perseus TEI XML into sections."""
    raise NotImplementedError("parse_latin not yet implemented")


def parse_english(html: str, section_count: int) -> list[str]:
    """Parse MIT Classics HTML into section texts."""
    raise NotImplementedError("parse_english not yet implemented")


# =============================================================================
# Sentence Segmentation (TODO: Implement in next task)
# =============================================================================

def segment_latin(sections: list[Section], book: int, chapter: int) -> list[SegmentedSentence]:
    """Segment Latin text into individual sentences."""
    raise NotImplementedError("segment_latin not yet implemented")


def segment_regex(text: str) -> list[str]:
    """Fallback: split on sentence-ending punctuation."""
    raise NotImplementedError("segment_regex not yet implemented")


# =============================================================================
# Translation Alignment (TODO: Implement in next task)
# =============================================================================

def align_translations(
    latin_sentences: list[SegmentedSentence],
    english_sections: list[str]
) -> list[SegmentedSentence]:
    """Align Latin sentences with English translations by position."""
    raise NotImplementedError("align_translations not yet implemented")


# =============================================================================
# Lemmatization & Scoring (TODO: Implement in next task)
# =============================================================================

def lemmatize_and_score(sentences: list[SegmentedSentence]) -> list[Sentence]:
    """Compute difficulty scores based on word frequency."""
    raise NotImplementedError("lemmatize_and_score not yet implemented")


def rank_to_difficulty(avg_rank: float) -> int:
    """Convert average word frequency rank to 1-100 difficulty score."""
    raise NotImplementedError("rank_to_difficulty not yet implemented")


def load_frequency_table() -> dict[str, int]:
    """Load Latin word frequency rankings."""
    raise NotImplementedError("load_frequency_table not yet implemented")


# =============================================================================
# Export & Validation (TODO: Implement in next task)
# =============================================================================

def validate_sentence(sent: Sentence) -> None:
    """Validate a sentence against the schema."""
    if not sent.id or not re.match(r'^bg\.\d+\.\d+\.\d+', sent.id):
        raise ValidationError(f"Invalid sentence ID: {sent.id}")
    if not sent.latin:
        raise ValidationError(f"Empty Latin text for {sent.id}")
    if not sent.referenceTranslation:
        raise ValidationError(f"Empty translation for {sent.id}")
    if not 1 <= sent.difficulty <= 100:
        raise ValidationError(f"Difficulty out of range for {sent.id}: {sent.difficulty}")
    if sent.order < 1:
        raise ValidationError(f"Invalid order for {sent.id}: {sent.order}")


def export_corpus(sentences: list[Sentence], output_path: str) -> None:
    """Write validated corpus.json."""
    raise NotImplementedError("export_corpus not yet implemented")


def validate_corpus_file(path: str) -> bool:
    """Validate an existing corpus.json file."""
    raise NotImplementedError("validate_corpus_file not yet implemented")


# =============================================================================
# Main Pipeline
# =============================================================================

def process_chapter(book: int, chapter: int, force_fetch: bool, output_path: str) -> int:
    """Run the full pipeline for a single chapter."""
    log.info(f"Processing De Bello Gallico Book {book}, Chapter {chapter}")

    try:
        # Step 1: Fetch sources
        log.info("Fetching sources...")
        sources = fetch_sources(book, chapter, force_fetch)
        log.info(f"Sources fetched (cached at: {sources.fetched_at})")

        # Step 2: Parse Latin
        log.info("Parsing Latin XML...")
        sections = parse_latin(sources.latin_xml)
        log.info(f"Parsed {len(sections)} sections")

        # Step 3: Parse English
        log.info("Parsing English HTML...")
        english_texts = parse_english(sources.english_html, len(sections))

        # Merge English into sections
        for section, english in zip(sections, english_texts):
            section.english_text = english

        # Step 4: Segment Latin sentences
        log.info("Segmenting Latin sentences...")
        segmented = segment_latin(sections, book, chapter)
        log.info(f"Segmented into {len(segmented)} sentences")

        # Step 5: Align translations
        log.info("Aligning translations...")
        aligned = align_translations(segmented, english_texts)

        low_confidence = [s for s in aligned if s.alignment_confidence < 0.8]
        if low_confidence:
            log.warning(f"{len(low_confidence)} sentences with low alignment confidence")

        # Step 6: Score difficulty
        log.info("Scoring difficulty...")
        scored = lemmatize_and_score(aligned)

        # Step 7: Export
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

    # Mutually exclusive: either process or validate
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

    # Handle validate-only mode
    if args.validate_only:
        try:
            if validate_corpus_file(args.validate_only):
                log.info("Validation passed")
                return EXIT_SUCCESS
        except (ValidationError, FileNotFoundError) as e:
            log.error(f"Validation failed: {e}")
            return EXIT_VALIDATION_FAILED

    # Require chapter when book is specified
    if args.book and not args.chapter:
        parser.error("--chapter is required when --book is specified")

    # Run pipeline
    return process_chapter(args.book, args.chapter, args.force_fetch, args.output)


if __name__ == '__main__':
    sys.exit(main())
