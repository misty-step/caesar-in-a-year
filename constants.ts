import type { ReadingPassage, Sentence } from '@/lib/data/types';

// In a real app, this would come from a CMS/DB
export const REVIEW_SENTENCES: Sentence[] = [
  {
    id: 's-1',
    latin: 'Puella in villā est.',
    referenceTranslation: 'The girl is in the country house (or villa).',
    context: 'Simple location'
  },
  {
    id: 's-2',
    latin: 'Marcus gladium capit.',
    referenceTranslation: 'Marcus takes (or seizes) the sword.',
    context: 'Action - Accusative case'
  },
  {
    id: 's-3',
    latin: 'Agricola nautam videt.',
    referenceTranslation: 'The farmer sees the sailor.',
    context: 'Subject vs Object'
  }
];

export const DAILY_READING: ReadingPassage = {
  id: 'r-101',
  title: 'De Gallia (Intro)',
  latinText: [
    'Gallia est omnis divisa in partes tres.',
    'Quarum unam incolunt Belgae.',
    'Aliam Aquitani incolunt.'
  ],
  sentenceIds: ['bg.1.1.1', 'bg.1.1.2', 'bg.1.1.3'],
  glossary: {
    'divisa': 'divided',
    'incolunt': 'inhabit / live in',
    'omnis': 'all / the whole',
    'partes': 'parts'
  },
  gistQuestion: 'In your own words, describe how Gaul is structured according to this passage.',
  referenceGist: 'Gaul is divided into three distinct parts or regions, inhabited by different peoples like the Belgae and Aquitani.'
};