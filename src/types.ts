// Shared TypeScript interfaces for Ezza AI

export interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text?: string;
  mode?: "chat" | "bible" | "lesson";
  transcription?: string | null;
  voiceFeedback?: string | null;
  spokenEzza?: string;
  phonetics?: string;
  englishTranslation?: string;
  lessonNotes?: string;
  audioBase64?: string | null;
  timestamp: Date;
}

export interface PresetVerse {
  ref: string;
  spokenEzza: string;
  phonetics: string;
  englishTranslation: string;
  lessonNotes: string;
}

export interface LessonItem {
  english: string;
  ezza: string;
  pronunciation: string;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  category: string;
  items: LessonItem[];
}

export interface Proverb {
  id: string;
  ezza: string;
  phonetics: string;
  englishTranslation: string;
  culturalSignificance: string;
  category: string;
}

export interface GlossaryItem {
  id: string;
  word: string;
  phonetics: string;
  englishTranslation: string;
  definition: string;
  category: string;
}
