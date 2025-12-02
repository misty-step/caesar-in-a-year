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
import time
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup

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
# Source Fetching
# =============================================================================

# Cache directory for raw sources
CACHE_DIR = Path("content/raw")

# Perseus Hopper CTS API for Latin text
# URN format: urn:cts:latinLit:phi0448.phi001.perseus-lat1:{book}.{chapter}
# Note: Citations are book.chapter (1.1 = Book 1, Chapter 1)
PERSEUS_CTS_URL = "http://www.perseus.tufts.edu/hopper/CTS"

# MIT Classics for English translation
MIT_BASE_URL = "https://classics.mit.edu/Caesar/gallic"


def _http_get_with_retry(url: str, max_retries: int = 3, timeout: int = 30) -> str:
    """Fetch URL with exponential backoff retry."""
    last_error = None

    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=timeout)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            last_error = e
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # 1s, 2s, 4s
                log.warning(f"Request failed (attempt {attempt + 1}/{max_retries}): {e}")
                log.info(f"Retrying in {wait_time}s...")
                time.sleep(wait_time)

    raise FetchError(f"Failed after {max_retries} attempts: {last_error}")


def fetch_sources(book: int, chapter: int, force: bool = False) -> RawSources:
    """
    Fetch Latin XML and English HTML, with local caching.

    Args:
        book: DBG book number (1-8)
        chapter: Chapter number within book
        force: If True, bypass cache and re-download

    Returns:
        RawSources with latin_xml and english_html content

    Raises:
        FetchError: If download fails after retries
    """
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    latin_path = CACHE_DIR / f"bg.{book}.{chapter}.latin.xml"
    english_path = CACHE_DIR / f"bg.{book}.{chapter}.english.html"

    # Return cached data if available and not forced
    if not force and latin_path.exists() and english_path.exists():
        log.info("Using cached sources")
        return RawSources(
            latin_xml=latin_path.read_text(encoding='utf-8'),
            english_html=english_path.read_text(encoding='utf-8'),
            book=book,
            chapter=chapter,
            fetched_at=datetime.fromtimestamp(latin_path.stat().st_mtime).isoformat()
        )

    # Fetch Latin from Perseus CTS API
    latin_urn = f"urn:cts:latinLit:phi0448.phi001.perseus-lat1:{book}.{chapter}"
    latin_url = f"{PERSEUS_CTS_URL}?request=GetPassage&urn={latin_urn}"
    log.info(f"Fetching Latin from Perseus: {latin_url}")

    try:
        latin_xml = _http_get_with_retry(latin_url)
    except FetchError as e:
        raise FetchError(f"Failed to fetch Latin from Perseus: {e}")

    # Fetch English from MIT Classics
    # URL format: https://classics.mit.edu/Caesar/gallic.1.1.html
    english_url = f"{MIT_BASE_URL}.{book}.{chapter}.html"
    log.info(f"Fetching English from MIT: {english_url}")

    try:
        english_html = _http_get_with_retry(english_url)
    except FetchError as e:
        raise FetchError(f"Failed to fetch English from MIT: {e}")

    # Cache for reproducibility
    latin_path.write_text(latin_xml, encoding='utf-8')
    english_path.write_text(english_html, encoding='utf-8')
    log.info(f"Cached sources to {CACHE_DIR}/")

    return RawSources(
        latin_xml=latin_xml,
        english_html=english_html,
        book=book,
        chapter=chapter,
        fetched_at=datetime.now().isoformat()
    )


# =============================================================================
# Parsing (TODO: Implement in next task)
# =============================================================================

def parse_latin(xml: str) -> list[Section]:
    """
    Parse Perseus TEI XML into sections.

    The XML structure uses milestone markers followed by div1/p elements:
        <milestone n="1" unit="section"/>
        <div1 type="Book" n="1" ...>
            <p>Latin text here</p>
        </div1>

    Args:
        xml: Raw XML string from Perseus CTS API

    Returns:
        List of Section objects with number and latin_text

    Raises:
        ParseError: If XML is malformed or no sections found
    """
    try:
        soup = BeautifulSoup(xml, 'lxml-xml')
    except Exception as e:
        raise ParseError(f"Failed to parse XML: {e}")

    sections = []

    # Find all milestone markers with unit="section"
    milestones = soup.find_all('milestone', {'unit': 'section'})

    if not milestones:
        raise ParseError("No section milestones found in XML")

    for milestone in milestones:
        section_num = milestone.get('n')
        if not section_num:
            continue

        try:
            section_num = int(section_num)
        except ValueError:
            log.warning(f"Invalid section number: {milestone.get('n')}")
            continue

        # The div1 with text follows the milestone
        div1 = milestone.find_next_sibling('div1')
        if not div1:
            log.warning(f"No div1 found after milestone {section_num}")
            continue

        # Extract text from p elements within div1
        paragraphs = div1.find_all('p')
        latin_text = ' '.join(p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True))

        if not latin_text:
            log.warning(f"Empty text for section {section_num}")
            continue

        sections.append(Section(number=section_num, latin_text=latin_text))

    if not sections:
        raise ParseError("No valid sections extracted from XML")

    # Sort by section number
    sections.sort(key=lambda s: s.number)

    log.debug(f"Parsed {len(sections)} sections from Latin XML")
    return sections


def parse_english(html: str, section_count: int) -> list[str]:
    """
    Parse MIT Classics HTML and distribute text across sections.

    MIT Classics has continuous prose without section markers.
    We extract chapter text and split into roughly equal portions.

    Args:
        html: Raw HTML from MIT Classics
        section_count: Number of sections to distribute text into

    Returns:
        List of English text strings, one per section

    Raises:
        ParseError: If HTML is malformed or chapter text not found
    """
    try:
        soup = BeautifulSoup(html, 'html.parser')
    except Exception as e:
        raise ParseError(f"Failed to parse HTML: {e}")

    # Find the chapter content - text between "Chapter 1" and "Chapter 2" headers
    body = soup.get_text()

    # Extract chapter text using markers
    chapter_start = body.find('Chapter 1')
    chapter_end = body.find('Chapter 2')

    if chapter_start == -1:
        raise ParseError("Chapter 1 marker not found in HTML")

    # Skip past the "Chapter 1" header itself
    chapter_start = body.find('\n', chapter_start)
    if chapter_start == -1:
        chapter_start = body.find('Chapter 1') + len('Chapter 1')

    if chapter_end == -1:
        # Single chapter page, take rest of text
        chapter_text = body[chapter_start:]
    else:
        chapter_text = body[chapter_start:chapter_end]

    # Clean up whitespace
    chapter_text = ' '.join(chapter_text.split())

    if not chapter_text.strip():
        raise ParseError("No chapter text extracted from HTML")

    # Distribute text across sections
    return _distribute_text(chapter_text, section_count)


def _distribute_text(text: str, section_count: int) -> list[str]:
    """
    Distribute continuous text across N sections.

    Splits on sentence boundaries (.!?) and distributes roughly equally.
    """
    if section_count <= 0:
        return []

    if section_count == 1:
        return [text.strip()]

    # Split into sentences (rough split on period/question/exclamation followed by space+capital)
    sentence_pattern = re.compile(r'(?<=[.!?])\s+(?=[A-Z])')
    sentences = sentence_pattern.split(text)

    if len(sentences) <= section_count:
        # Fewer sentences than sections - distribute what we have
        result = sentences + [''] * (section_count - len(sentences))
        return result

    # Calculate target sentences per section
    per_section = len(sentences) / section_count
    sections = []
    current_idx = 0.0

    for i in range(section_count):
        start_idx = int(current_idx)
        current_idx += per_section
        end_idx = int(current_idx) if i < section_count - 1 else len(sentences)

        section_sentences = sentences[start_idx:end_idx]
        sections.append(' '.join(section_sentences).strip())

    return sections


# =============================================================================
# Sentence Segmentation
# =============================================================================

# Latin abbreviations that shouldn't end a sentence
LATIN_ABBREVS = {
    'cf', 'etc', 'i.e', 'e.g', 'viz', 'sc', 'vs', 'cap', 'lib',
    'c', 'a', 'm', 'l', 'p', 'q', 't', 'd', 's', 'n',  # Single-letter abbrevs (names)
}


def segment_regex(text: str) -> list[str]:
    """
    Split Latin text into sentences using regex.

    Handles:
    - Standard sentence endings (.!?)
    - Latin abbreviations (doesn't split on these)
    - Parenthetical text and brackets

    Args:
        text: Latin prose to segment

    Returns:
        List of individual sentences
    """
    if not text or not text.strip():
        return []

    # Normalize whitespace
    text = ' '.join(text.split())

    # Protect abbreviations by replacing periods with placeholder
    protected = text
    for abbrev in LATIN_ABBREVS:
        # Match abbreviation followed by period (case insensitive)
        pattern = rf'\b({re.escape(abbrev)})\.'
        protected = re.sub(pattern, r'\1<PERIOD>', protected, flags=re.IGNORECASE)

    # Split on sentence-ending punctuation followed by space
    # Include: . ! ? and also ; when followed by capital (common in Latin)
    sentence_pattern = re.compile(r'(?<=[.!?])\s+(?=[A-Z\[])')
    raw_sentences = sentence_pattern.split(protected)

    # Restore protected periods and clean up
    sentences = []
    for sent in raw_sentences:
        sent = sent.replace('<PERIOD>', '.')
        sent = sent.strip()
        if sent:
            sentences.append(sent)

    return sentences


def segment_latin(sections: list[Section], book: int, chapter: int) -> list[SegmentedSentence]:
    """
    Segment Latin sections into individual sentences with IDs.

    Args:
        sections: List of Section objects with latin_text
        book: Book number for ID generation
        chapter: Chapter number for ID generation

    Returns:
        List of SegmentedSentence with unique IDs like "bg.1.1.1"
    """
    all_sentences = []
    sentence_counter = 1

    for section in sections:
        sentences = segment_regex(section.latin_text)

        for position, latin in enumerate(sentences, start=1):
            sentence_id = f"bg.{book}.{chapter}.{sentence_counter}"

            all_sentences.append(SegmentedSentence(
                id=sentence_id,
                latin=latin,
                english="",  # Will be filled by alignment
                section=section.number,
                position=position,
                alignment_confidence=0.0
            ))
            sentence_counter += 1

    return all_sentences


# =============================================================================
# Translation Alignment
# =============================================================================

def _split_english_sentences(text: str) -> list[str]:
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

    Args:
        latin_sentences: Segmented Latin sentences with section info
        english_sections: List of English text per section

    Returns:
        Latin sentences with english and alignment_confidence filled in
    """
    # Build section -> sentences map
    sections_map: dict[int, list[SegmentedSentence]] = {}
    for sent in latin_sentences:
        if sent.section not in sections_map:
            sections_map[sent.section] = []
        sections_map[sent.section].append(sent)

    # Process each section
    for section_num, latin_sents in sections_map.items():
        # Get corresponding English (section numbers are 1-indexed)
        section_idx = section_num - 1
        if section_idx >= len(english_sections):
            # Missing English section
            for sent in latin_sents:
                sent.english = "[MISSING SECTION]"
                sent.alignment_confidence = 0.0
            continue

        english_text = english_sections[section_idx]
        english_sents = _split_english_sentences(english_text)

        latin_count = len(latin_sents)
        english_count = len(english_sents)

        if english_count == 0:
            # No English sentences
            for sent in latin_sents:
                sent.english = "[MISSING TRANSLATION]"
                sent.alignment_confidence = 0.0
            continue

        # Calculate base confidence from count match
        if latin_count == english_count:
            base_confidence = 1.0
        else:
            # Penalize mismatches
            ratio = min(latin_count, english_count) / max(latin_count, english_count)
            base_confidence = ratio * 0.8  # Max 0.8 for mismatched counts

        # Distribute English sentences across Latin sentences
        if english_count >= latin_count:
            # More or equal English - each Latin gets ceil(english/latin) sentences
            per_latin = english_count / latin_count
            idx = 0.0
            for sent in latin_sents:
                start = int(idx)
                idx += per_latin
                end = int(idx)
                sent.english = ' '.join(english_sents[start:end])
                sent.alignment_confidence = base_confidence
        else:
            # Fewer English than Latin - some Latin sentences share
            per_english = latin_count / english_count
            for i, sent in enumerate(latin_sents):
                eng_idx = min(int(i / per_english), english_count - 1)
                sent.english = english_sents[eng_idx]
                sent.alignment_confidence = base_confidence * 0.9  # Extra penalty for sharing

    return latin_sentences


# =============================================================================
# Lemmatization & Scoring
# =============================================================================

# Fallback frequency table with top Latin words from DCC Core
# Rank 1 = most common, higher = rarer
FALLBACK_FREQUENCY: dict[str, int] = {
    # Top 50 most common
    'sum': 1, 'et': 2, 'in': 3, 'is': 4, 'qui': 5,
    'non': 6, 'hic': 7, 'ego': 8, 'ut': 9, 'cum': 10,
    'de': 11, 'si': 12, 'omnis': 13, 'ab': 14, 'ille': 15,
    'sed': 16, 'neque': 17, 'ex': 18, 'atque': 19, 'ad': 20,
    'ipse': 21, 'per': 22, 'quis': 23, 'possum': 24, 'facio': 25,
    'dico': 26, 'video': 27, 'habeo': 28, 'do': 29, 'res': 30,
    'tu': 31, 'magnus': 32, 'pars': 33, 'quam': 34, 'suus': 35,
    'alius': 36, 'iam': 37, 'bonus': 38, 'vir': 39, 'primus': 40,
    'meus': 41, 'unus': 42, 'noster': 43, 'venio': 44, 'tantus': 45,
    'enim': 46, 'multus': 47, 'causa': 48, 'genus': 49, 'aut': 50,
    # 51-100
    'tamen': 51, 'idem': 52, 'annus': 53, 'dies': 54, 'bellum': 55,
    'nunc': 56, 'manus': 57, 'ubi': 58, 'nihil': 59, 'pater': 60,
    'inter': 61, 'populus': 62, 'capio': 63, 'locus': 64, 'animus': 65,
    'alter': 66, 'fero': 67, 'terra': 68, 'urbs': 69, 'homo': 70,
    'publicus': 71, 'consul': 72, 'rex': 73, 'corpus': 74, 'ager': 75,
    'mitto': 76, 'hostis': 77, 'castra': 78, 'voco': 79, 'tempus': 80,
    'ante': 81, 'civis': 82, 'peto': 83, 'miles': 84, 'deus': 85,
    'nomen': 86, 'post': 87, 'civitas': 88, 'exercitus': 89, 'iter': 90,
    'finis': 91, 'novus': 92, 'mos': 93, 'virtus': 94, 'potestas': 95,
    'natura': 96, 'aqua': 97, 'imperium': 98, 'verbum': 99, 'pax': 100,
    # Common Caesar vocabulary
    'gallia': 101, 'divido': 102, 'tres': 103, 'incolo': 110,
    'belgae': 115, 'aquitani': 120, 'lingua': 125, 'celtae': 130,
    'galli': 135, 'appellor': 140, 'lex': 145, 'institutum': 150,
    'differo': 155, 'flumen': 160, 'garumna': 165, 'matrona': 170,
    'sequana': 175, 'fortis': 180, 'propterea': 185, 'cultus': 190,
    'humanitas': 195, 'provincia': 200, 'mercator': 205, 'commeor': 210,
    'effemino': 215, 'germani': 220, 'rhenus': 225, 'continenter': 230,
    'gero': 235, 'helvetii': 240, 'reliquus': 245, 'praecedo': 250,
    'cotidianus': 255, 'proelium': 260, 'contendo': 265, 'prohibeo': 270,
    'obtendo': 275, 'initium': 280, 'rhodanus': 285, 'oceanus': 290,
    'attingo': 295, 'vergo': 300, 'septentriones': 305, 'orior': 310,
    'inferior': 315, 'specto': 320, 'oriens': 325, 'sol': 330,
    'pyrenaei': 335, 'mons': 340, 'hispania': 345, 'occasus': 350,
}


def load_frequency_table() -> dict[str, int]:
    """
    Load Latin word frequency rankings.

    First tries content/latin_frequency.json, falls back to built-in table.

    Returns:
        Dict mapping lowercase word/lemma to frequency rank
    """
    freq_path = Path("content/latin_frequency.json")

    if freq_path.exists():
        try:
            with open(freq_path, encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            log.warning(f"Failed to load frequency table: {e}, using fallback")

    return FALLBACK_FREQUENCY


def rank_to_difficulty(avg_rank: float) -> int:
    """
    Convert average word frequency rank to 1-100 difficulty score.

    Mapping:
    - Rank 1-50 (very common) → difficulty 1-20
    - Rank 50-200 (common) → difficulty 20-50
    - Rank 200-500 (less common) → difficulty 50-80
    - Rank 500+ (rare) → difficulty 80-100

    Args:
        avg_rank: Average frequency rank of words in sentence

    Returns:
        Difficulty score 1-100
    """
    if avg_rank <= 50:
        # Linear 1-20 for ranks 1-50
        return max(1, int(avg_rank * 0.4))
    elif avg_rank <= 200:
        # Linear 20-50 for ranks 50-200
        return int(20 + (avg_rank - 50) * 0.2)
    elif avg_rank <= 500:
        # Linear 50-80 for ranks 200-500
        return int(50 + (avg_rank - 200) * 0.1)
    else:
        # Cap at 100 for very rare words
        return min(100, int(80 + (avg_rank - 500) * 0.04))


def _tokenize_latin(text: str) -> list[str]:
    """Extract Latin words from text, lowercased."""
    # Remove punctuation and split
    text = re.sub(r'[^\w\s]', ' ', text)
    words = text.lower().split()
    # Filter very short words and numbers
    return [w for w in words if len(w) > 1 and not w.isdigit()]


def lemmatize_and_score(sentences: list[SegmentedSentence]) -> list[Sentence]:
    """
    Compute difficulty scores based on word frequency.

    Uses simple tokenization with frequency table lookup.
    CLTK lemmatization could be added later for better accuracy.

    Args:
        sentences: Aligned sentences with Latin text

    Returns:
        Final Sentence objects with difficulty scores
    """
    freq_table = load_frequency_table()
    default_rank = 400  # Assume unknown words are moderately rare

    result = []
    for order, sent in enumerate(sentences, start=1):
        words = _tokenize_latin(sent.latin)

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
# Export & Validation
# =============================================================================

def validate_sentence(sent: Sentence) -> None:
    """
    Validate a sentence against the schema.

    Raises ValidationError if any field is invalid.
    """
    if not sent.id or not re.match(r'^bg\.\d+\.\d+\.\d+$', sent.id):
        raise ValidationError(f"Invalid sentence ID: {sent.id}")
    if not sent.latin or not sent.latin.strip():
        raise ValidationError(f"Empty Latin text for {sent.id}")
    if not sent.referenceTranslation or not sent.referenceTranslation.strip():
        raise ValidationError(f"Empty translation for {sent.id}")
    if not 1 <= sent.difficulty <= 100:
        raise ValidationError(f"Difficulty out of range for {sent.id}: {sent.difficulty}")
    if sent.order < 1:
        raise ValidationError(f"Invalid order for {sent.id}: {sent.order}")


def export_corpus(sentences: list[Sentence], output_path: str) -> None:
    """
    Write validated corpus.json with atomic write.

    Validates all sentences before writing. Uses atomic write
    (write to temp file, then rename) to prevent partial writes.

    Args:
        sentences: List of Sentence objects to export
        output_path: Path to output JSON file

    Raises:
        ValidationError: If any sentence fails validation
    """
    # Validate all sentences first
    for sent in sentences:
        validate_sentence(sent)

    # Convert to dict format
    corpus_data = {
        "sentences": [asdict(s) for s in sentences],
        "metadata": {
            "version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "sentence_count": len(sentences),
        }
    }

    # Atomic write: write to temp file, then rename
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    temp_path = output.with_suffix('.json.tmp')
    try:
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(corpus_data, f, indent=2, ensure_ascii=False)

        # Atomic rename
        temp_path.rename(output)
    except Exception as e:
        # Clean up temp file on error
        if temp_path.exists():
            temp_path.unlink()
        raise ValidationError(f"Failed to write corpus: {e}")

    log.info(f"Wrote {len(sentences)} sentences to {output_path}")


def validate_corpus_file(path: str) -> bool:
    """
    Validate an existing corpus.json file.

    Args:
        path: Path to corpus.json file

    Returns:
        True if valid

    Raises:
        ValidationError: If validation fails
        FileNotFoundError: If file doesn't exist
    """
    corpus_path = Path(path)
    if not corpus_path.exists():
        raise FileNotFoundError(f"Corpus file not found: {path}")

    try:
        with open(corpus_path, encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValidationError(f"Invalid JSON: {e}")

    if 'sentences' not in data:
        raise ValidationError("Missing 'sentences' key in corpus")

    sentences = data['sentences']
    if not isinstance(sentences, list):
        raise ValidationError("'sentences' must be a list")

    if len(sentences) == 0:
        raise ValidationError("Corpus is empty")

    # Validate each sentence
    for i, sent_dict in enumerate(sentences):
        try:
            sent = Sentence(
                id=sent_dict.get('id', ''),
                latin=sent_dict.get('latin', ''),
                referenceTranslation=sent_dict.get('referenceTranslation', ''),
                difficulty=sent_dict.get('difficulty', 0),
                order=sent_dict.get('order', 0),
                alignmentConfidence=sent_dict.get('alignmentConfidence')
            )
            validate_sentence(sent)
        except (KeyError, TypeError) as e:
            raise ValidationError(f"Invalid sentence at index {i}: {e}")

    log.info(f"Validated {len(sentences)} sentences in {path}")
    return True


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
