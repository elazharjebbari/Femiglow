export interface MediaAsset {
  assetId: string;
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationMs?: number;
  fileSizeBytes: number;
  provider: string;
  generationParams: Record<string, unknown>;
  costCents: number;
}

export interface StepError {
  node: string;
  errorType: string;
  message: string;
  timestamp: string;
  provider?: string;
  retryable: boolean;
}

export interface CostTracking {
  totalCents: number;
  breakdown: Record<string, number>;
  tokensUsed: Record<string, number>;
  budgetRemainingCents?: number;
}
