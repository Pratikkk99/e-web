/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: Date;
  sources?: SourceDoc[];
  outOfContextOccurred?: boolean;
  groundingChunks?: any[]; // For Google Search citation mappings
}

export interface SourceDoc {
  id: string;
  name: string;
  type: 'pdf' | 'text' | 'image' | 'code' | 'link';
  content: string;
  size: string;
  uploadedAt: string;
  url?: string; // Optional URL for link sources
  credentials?: {
    username?: string;
    password?: string;
  };
  taggedFiles?: string[]; // IDs/names of existing files tagged
  additionalContext?: string; // custom info / annotation context
}

export interface MemoryFact {
  id: string;
  fact: string;
  category: 'User Preference' | 'Scope Limit' | 'SAP Compliance' | 'General';
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface ChartItem {
  label: string;
  value: number;
}
