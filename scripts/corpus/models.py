"""
Data models and utilities for corpus processing.

Contains dataclasses, frequency tables, scoring functions, and validation.
"""

import json
import re
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional


# =============================================================================
# Data Structures
# =============================================================================

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
# Frequency Table & Scoring
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
    """
    freq_path = Path("content/latin_frequency.json")

    if freq_path.exists():
        try:
            with open(freq_path, encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass

    return FALLBACK_FREQUENCY


def rank_to_difficulty(avg_rank: float) -> int:
    """
    Convert average word frequency rank to 1-100 difficulty score.

    Mapping:
    - Rank 1-50 (very common) -> difficulty 1-20
    - Rank 50-200 (common) -> difficulty 20-50
    - Rank 200-500 (less common) -> difficulty 50-80
    - Rank 500+ (rare) -> difficulty 80-100
    """
    if avg_rank <= 50:
        return max(1, int(avg_rank * 0.4))
    elif avg_rank <= 200:
        return int(20 + (avg_rank - 50) * 0.2)
    elif avg_rank <= 500:
        return int(50 + (avg_rank - 200) * 0.1)
    else:
        return min(100, int(80 + (avg_rank - 500) * 0.04))


def tokenize_latin(text: str) -> list[str]:
    """Extract Latin words from text, lowercased."""
    text = re.sub(r'[^\w\s]', ' ', text)
    words = text.lower().split()
    return [w for w in words if len(w) > 1 and not w.isdigit()]


# =============================================================================
# Validation
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


def validate_corpus_file(path: str) -> bool:
    """
    Validate an existing corpus.json file.

    Returns True if valid. Raises ValidationError or FileNotFoundError on failure.
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

    return True


# =============================================================================
# Export
# =============================================================================

def export_corpus(sentences: list[Sentence], output_path: str) -> None:
    """
    Write validated corpus.json with atomic write.

    Validates all sentences before writing.
    """
    for sent in sentences:
        validate_sentence(sent)

    corpus_data = {
        "sentences": [asdict(s) for s in sentences],
        "metadata": {
            "version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "sentence_count": len(sentences),
        }
    }

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    temp_path = output.with_suffix('.json.tmp')
    try:
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(corpus_data, f, indent=2, ensure_ascii=False)
        temp_path.rename(output)
    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        raise ValidationError(f"Failed to write corpus: {e}")
