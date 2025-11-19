export interface FileInfo {
  name: string;
  path: string;
  keywords: string[];
  size?: number;
  type?: string;
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