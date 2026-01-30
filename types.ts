
export type Category = 'Product' | 'Founder Interview' | 'Technical' | 'AI News' | 'Tutorial';

export interface Segment {
  startTime: number;
  endTime: number;
  title: string;
}

export interface Highlight {
  type: 'language' | 'technical';
  text: string;
  definition: string;
  pos?: string;
  phonetic?: string;
  translation: string;
  example?: string;
}

export interface TranscriptPart {
  en: string;
  zh: string;
  highlights: Highlight[];
}

export interface Video {
  id: string;
  youtubeId: string;
  title: string;
  description: string;
  categories: Category[];
  thumbnail: string;
  duration: string;
  transcriptParts?: TranscriptPart[];
  segments?: Segment[];
}

export interface Bookmark {
  id: string;
  term: string;
  definition: string;
  type: 'language' | 'technical';
}

export interface VocabularyItem {
  term: string;
  definition: string;
  context: string;
  chineseTranslation: string;
}

export interface AISummary {
  overview: string;
  keyPoints: string[];
  vocabulary: VocabularyItem[];
}
