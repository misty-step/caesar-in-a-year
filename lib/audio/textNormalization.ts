export function normalizeLatinText(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ');
}
