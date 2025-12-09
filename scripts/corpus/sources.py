"""
Source fetchers for corpus processing.

Deep modules that hide URL patterns, caching, and parsing details.
"""

import json
import logging
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

from .models import Section, FetchError, ParseError

log = logging.getLogger('corpus')

# Cache directory for raw sources
CACHE_DIR = Path("content/raw")


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
                wait_time = 2 ** attempt
                log.warning(f"Request failed (attempt {attempt + 1}/{max_retries}): {e}")
                log.info(f"Retrying in {wait_time}s...")
                time.sleep(wait_time)

    raise FetchError(f"Failed after {max_retries} attempts: {last_error}")


class PerseusSource:
    """
    Latin text from Perseus CTS API.

    Hides:
    - URN construction (phi0448.phi001.perseus-lat1)
    - CTS API URL format
    - XML parsing with BeautifulSoup
    - Section milestone extraction
    - Caching strategy
    """

    CTS_URL = "http://www.perseus.tufts.edu/hopper/CTS"
    URN_BASE = "urn:cts:latinLit:phi0448.phi001.perseus-lat1"

    def __init__(self, cache_dir: Path = CACHE_DIR):
        self.cache_dir = cache_dir
        self._chapter_counts: dict[int, int] = {}

    def get_chapter_count(self, book: int, force: bool = False) -> int:
        """
        Discover how many chapters exist in a book using CTS GetValidReff.
        
        Args:
            book: Book number (1-8)
            force: Bypass cache
            
        Returns:
            Number of chapters in the book
        """
        # Check memory cache
        if not force and book in self._chapter_counts:
            return self._chapter_counts[book]
        
        # Check file cache
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        cache_path = self.cache_dir / "chapter_counts.json"
        
        if not force and cache_path.exists():
            try:
                counts = json.loads(cache_path.read_text())
                self._chapter_counts = {int(k): v for k, v in counts.items()}
                if book in self._chapter_counts:
                    return self._chapter_counts[book]
            except (json.JSONDecodeError, KeyError):
                pass
        
        # Query Perseus CTS API for valid references
        urn = f"{self.URN_BASE}:{book}"
        url = f"{self.CTS_URL}?request=GetValidReff&urn={urn}&level=2"
        log.info(f"Discovering chapters for Book {book} from Perseus...")
        
        try:
            xml = _http_get_with_retry(url)
            chapters = self._parse_valid_reff(xml, book)
            self._chapter_counts[book] = chapters
            
            # Persist to file cache
            cache_path.write_text(json.dumps(self._chapter_counts))
            log.info(f"Book {book}: {chapters} chapters discovered")
            
            return chapters
        except FetchError as e:
            raise FetchError(f"Failed to discover chapters for Book {book}: {e}") from e
    
    def _parse_valid_reff(self, xml: str, book: int) -> int:
        """Parse GetValidReff response to count chapters."""
        try:
            soup = BeautifulSoup(xml, 'lxml-xml')
        except Exception as e:
            raise ParseError(f"Failed to parse CTS response: {e}") from e
        
        # GetValidReff returns <urn> elements with passage refs
        # e.g., urn:cts:latinLit:phi0448.phi001.perseus-lat1:1.1
        urns = soup.find_all('urn')
        
        chapters = set()
        pattern = re.compile(rf'{book}\.(\d+)')
        
        for urn_elem in urns:
            text = urn_elem.get_text(strip=True)
            match = pattern.search(text)
            if match:
                chapters.add(int(match.group(1)))
        
        if not chapters:
            raise ParseError(f"No chapters found for Book {book} in CTS response")
        
        return max(chapters)

    def fetch(self, book: int, chapter: int, force: bool = False) -> list[Section]:
        """
        Fetch Latin sections for a specific chapter.

        Args:
            book: Book number (1-8)
            chapter: Chapter number within book
            force: Bypass cache and re-download

        Returns:
            List of Section objects with latin_text populated
        """
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        cache_path = self.cache_dir / f"bg.{book}.{chapter}.latin.xml"

        # Check cache
        if not force and cache_path.exists():
            log.info(f"Using cached Latin: {cache_path}")
            xml = cache_path.read_text(encoding='utf-8')
        else:
            # Fetch from Perseus CTS API
            urn = f"{self.URN_BASE}:{book}.{chapter}"
            url = f"{self.CTS_URL}?request=GetPassage&urn={urn}"
            log.info(f"Fetching Latin from Perseus: {url}")

            try:
                xml = _http_get_with_retry(url)
                cache_path.write_text(xml, encoding='utf-8')
                log.info(f"Cached to {cache_path}")
            except FetchError as e:
                raise FetchError(f"Failed to fetch Latin from Perseus: {e}") from e

        return self._parse_xml(xml)

    def _parse_xml(self, xml: str) -> list[Section]:
        """Parse Perseus TEI XML into sections."""
        try:
            soup = BeautifulSoup(xml, 'lxml-xml')
        except Exception as e:
            raise ParseError(f"Failed to parse XML: {e}") from e

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
            latin_text = ' '.join(
                p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)
            )

            if not latin_text:
                log.warning(f"Empty text for section {section_num}")
                continue

            sections.append(Section(number=section_num, latin_text=latin_text))

        if not sections:
            raise ParseError("No valid sections extracted from XML")

        sections.sort(key=lambda s: s.number)
        return sections


class MITClassicsSource:
    """
    English translation from MIT Classics.

    Hides:
    - URL pattern (gallic.{book}.{book}.html - one page per book)
    - Book-level caching strategy
    - Chapter extraction by **Chapter N** markers
    - HTML parsing
    """

    BASE_URL = "https://classics.mit.edu/Caesar/gallic"

    def __init__(self, cache_dir: Path = CACHE_DIR):
        self.cache_dir = cache_dir

    def fetch(self, book: int, chapter: int, force: bool = False) -> list[str]:
        """
        Fetch English translation for a specific chapter.

        Args:
            book: Book number (1-8)
            chapter: Chapter number within book
            force: Bypass cache and re-download

        Returns:
            List of English text strings, one per section
        """
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        # Cache at BOOK level (not chapter) since MIT has one page per book
        cache_path = self.cache_dir / f"bg.{book}.english.html"

        # Check cache
        if not force and cache_path.exists():
            log.info(f"Using cached English: {cache_path}")
            html = cache_path.read_text(encoding='utf-8')
        else:
            # URL pattern: gallic.{book}.{book}.html
            url = f"{self.BASE_URL}.{book}.{book}.html"
            log.info(f"Fetching English from MIT: {url}")

            try:
                html = _http_get_with_retry(url)
                cache_path.write_text(html, encoding='utf-8')
                log.info(f"Cached to {cache_path}")
            except FetchError as e:
                raise FetchError(f"Failed to fetch English from MIT: {e}") from e

        return self._extract_chapter(html, chapter)

    def _extract_chapter(self, html: str, chapter: int) -> list[str]:
        """
        Extract a specific chapter's text from the full book HTML.

        MIT structure: continuous prose with **Chapter N** markers.
        """
        try:
            soup = BeautifulSoup(html, 'html.parser')
        except Exception as e:
            raise ParseError(f"Failed to parse HTML: {e}") from e

        body = soup.get_text()

        # Find chapter boundaries
        # MIT uses "Chapter N" format (may have ** around it from markdown rendering)
        chapter_pattern = re.compile(
            rf'(?:^|\n)\s*\**\s*Chapter\s+{chapter}\s*\**\s*(?:\n|$)',
            re.IGNORECASE | re.MULTILINE
        )
        next_chapter_pattern = re.compile(
            rf'(?:^|\n)\s*\**\s*Chapter\s+{chapter + 1}\s*\**\s*(?:\n|$)',
            re.IGNORECASE | re.MULTILINE
        )

        chapter_match = chapter_pattern.search(body)
        if not chapter_match:
            raise ParseError(f"Chapter {chapter} marker not found in HTML")

        # Extract from end of chapter marker to start of next chapter
        start_pos = chapter_match.end()

        next_match = next_chapter_pattern.search(body, start_pos)
        if next_match:
            end_pos = next_match.start()
            chapter_text = body[start_pos:end_pos]
        else:
            # Last chapter in book - take rest of content
            # But stop at common footer markers
            chapter_text = body[start_pos:]

            # Remove footer (MIT pages have navigation at bottom)
            footer_markers = ['Provided by The Internet Classics Archive', 'Copyright']
            for marker in footer_markers:
                footer_idx = chapter_text.find(marker)
                if footer_idx != -1:
                    chapter_text = chapter_text[:footer_idx]

        # Clean up whitespace
        chapter_text = ' '.join(chapter_text.split())

        if not chapter_text.strip():
            raise ParseError(f"No text extracted for chapter {chapter}")

        # Return as single-element list (will be distributed across sections by alignment)
        return [chapter_text.strip()]

    def fetch_with_sections(
        self, book: int, chapter: int, section_count: int, force: bool = False
    ) -> list[str]:
        """
        Fetch and distribute English text across sections.

        Args:
            book: Book number
            chapter: Chapter number
            section_count: Number of sections to distribute text into
            force: Bypass cache

        Returns:
            List of English text strings, one per section
        """
        full_text = self.fetch(book, chapter, force)
        if not full_text or not full_text[0]:
            return [''] * section_count

        return self._distribute_text(full_text[0], section_count)

    def _distribute_text(self, text: str, section_count: int) -> list[str]:
        """Distribute continuous text across N sections by sentence."""
        if section_count <= 0:
            return []

        if section_count == 1:
            return [text.strip()]

        # Split into sentences
        sentence_pattern = re.compile(r'(?<=[.!?])\s+(?=[A-Z])')
        sentences = sentence_pattern.split(text)

        if len(sentences) <= section_count:
            result = sentences + [''] * (section_count - len(sentences))
            return result

        # Distribute sentences across sections
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
