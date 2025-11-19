export interface AIAnalysis {
  summary: string;
  tags: string[];
  category: string;
  sensitivity: 'High' | 'Low';
}

export interface FileInfo {
  name: string;
  path: string;
  keywords: string[];
  size?: number;
  type?: string;
  analysis?: AIAnalysis; // Optional, populated after AI scan
}

export interface KeywordConfig {
  keywords: string[];
  destinationFolder: string;
}

export interface Directory {
  path: string;
}

export interface AppError {
  message: string;
  type: 'error' | 'success';
  timestamp: Date;
}