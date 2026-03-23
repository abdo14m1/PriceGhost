export type AIWarningCode = 'AI_QUOTA_EXHAUSTED';
export type AIWarningProvider = 'gemini';
export type AIWarningContext = 'product_extraction' | 'settings_ai_test';

export interface AIServiceWarning {
  code: AIWarningCode;
  provider: AIWarningProvider;
  context: AIWarningContext;
  title: string;
  message: string;
  cta: string;
  retryAfterSeconds?: number;
}

export interface AIWarningError extends Error {
  code: AIWarningCode;
  warning: AIServiceWarning;
  cause?: unknown;
}

export interface AIQuotaErrorResponse {
  error: string;
  code: AIWarningCode;
  provider: AIWarningProvider;
  context: AIWarningContext;
  title: string;
  message: string;
  cta: string;
  retryAfterSeconds?: number;
}

const WARNING_COPY: Record<AIWarningContext, { title: string; message: string; cta: string }> = {
  product_extraction: {
    title: 'AI is temporarily busy',
    message: 'We couldn\'t finish pulling product details right now. Please try again in a few minutes.',
    cta: 'Try Again Soon',
  },
  settings_ai_test: {
    title: 'Can\'t run AI test right now',
    message: 'Your AI check is temporarily unavailable. Wait a moment, then test again.',
    cta: 'Test Again Later',
  },
};

function parseRetryDelayToSeconds(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const strictSeconds = trimmed.match(/^(\d+(?:\.\d+)?)s$/i);
  if (strictSeconds) {
    const seconds = Math.ceil(parseFloat(strictSeconds[1]));
    return isNaN(seconds) ? undefined : Math.max(1, seconds);
  }

  const looseSeconds = trimmed.match(/(\d+(?:\.\d+)?)\s*s/i);
  if (looseSeconds) {
    const seconds = Math.ceil(parseFloat(looseSeconds[1]));
    return isNaN(seconds) ? undefined : Math.max(1, seconds);
  }

  return undefined;
}

function getRetryAfterSecondsFromError(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const maybeError = error as {
    errorDetails?: unknown;
    message?: unknown;
  };

  if (Array.isArray(maybeError.errorDetails)) {
    for (const detail of maybeError.errorDetails) {
      if (!detail || typeof detail !== 'object') continue;
      const retryDelay = (detail as { retryDelay?: unknown }).retryDelay;
      if (typeof retryDelay === 'string') {
        const parsed = parseRetryDelayToSeconds(retryDelay);
        if (parsed) return parsed;
      }
    }
  }

  if (typeof maybeError.message === 'string') {
    const retryInMatch = maybeError.message.match(/retry in\s+([0-9.]+)s/i);
    if (retryInMatch) {
      const parsed = Math.ceil(parseFloat(retryInMatch[1]));
      if (!isNaN(parsed)) return Math.max(1, parsed);
    }

    const retryDelayMatch = maybeError.message.match(/retryDelay['"\s:]+([0-9]+)s/i);
    if (retryDelayMatch) {
      const parsed = parseInt(retryDelayMatch[1], 10);
      if (!isNaN(parsed)) return Math.max(1, parsed);
    }
  }

  return undefined;
}

export function isGeminiQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as {
    status?: unknown;
    statusText?: unknown;
    message?: unknown;
    errorDetails?: unknown;
  };

  const status = typeof maybeError.status === 'number' ? maybeError.status : undefined;
  const statusText = typeof maybeError.statusText === 'string' ? maybeError.statusText.toLowerCase() : '';
  const message = typeof maybeError.message === 'string' ? maybeError.message.toLowerCase() : '';
  const combined = `${statusText} ${message}`;

  const hasGeminiHint =
    combined.includes('gemini') ||
    combined.includes('generativelanguage.googleapis.com') ||
    combined.includes('googlegenerativeai');

  const hasQuotaHint =
    combined.includes('quota') ||
    combined.includes('too many requests') ||
    combined.includes('rate limit') ||
    combined.includes('exceeded');

  if (status === 429 && (hasGeminiHint || hasQuotaHint)) {
    return true;
  }

  if (Array.isArray(maybeError.errorDetails)) {
    for (const detail of maybeError.errorDetails) {
      if (!detail || typeof detail !== 'object') continue;
      const type = String((detail as { ['@type']?: unknown })['@type'] || '').toLowerCase();
      if (type.includes('quotafailure')) {
        return true;
      }
    }
  }

  return hasGeminiHint && hasQuotaHint;
}

export function getAIQuotaWarningFromError(
  error: unknown,
  context: AIWarningContext,
  provider?: string | null
): AIServiceWarning | null {
  if (provider && provider !== 'gemini') return null;
  if (!isGeminiQuotaError(error)) return null;

  const copy = WARNING_COPY[context];
  const retryAfterSeconds = getRetryAfterSecondsFromError(error);

  return {
    code: 'AI_QUOTA_EXHAUSTED',
    provider: 'gemini',
    context,
    title: copy.title,
    message: copy.message,
    cta: copy.cta,
    retryAfterSeconds,
  };
}

export function createAIWarningError(warning: AIServiceWarning, cause?: unknown): AIWarningError {
  const error = new Error(warning.message) as AIWarningError;
  error.name = 'AIWarningError';
  error.code = warning.code;
  error.warning = warning;
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error;
}

export function mergeAIWarning(
  warnings: AIServiceWarning[] | undefined,
  warning: AIServiceWarning
): AIServiceWarning[] {
  const nextWarnings = warnings ? [...warnings] : [];
  const exists = nextWarnings.some(
    (item) => item.code === warning.code && item.provider === warning.provider && item.context === warning.context
  );

  if (!exists) {
    nextWarnings.push(warning);
  }

  return nextWarnings;
}

function isAIServiceWarning(input: unknown): input is AIServiceWarning {
  if (!input || typeof input !== 'object') return false;
  const warning = input as Partial<AIServiceWarning>;
  return (
    warning.code === 'AI_QUOTA_EXHAUSTED' &&
    warning.provider === 'gemini' &&
    (warning.context === 'product_extraction' || warning.context === 'settings_ai_test') &&
    typeof warning.title === 'string' &&
    typeof warning.message === 'string' &&
    typeof warning.cta === 'string'
  );
}

export function getAIQuotaWarningFromThrown(error: unknown): AIServiceWarning | null {
  if (!error || typeof error !== 'object') return null;
  const warning = (error as { warning?: unknown }).warning;
  return isAIServiceWarning(warning) ? warning : null;
}

export function toAIQuotaErrorResponse(warning: AIServiceWarning): AIQuotaErrorResponse {
  return {
    error: warning.message,
    code: warning.code,
    provider: warning.provider,
    context: warning.context,
    title: warning.title,
    message: warning.message,
    cta: warning.cta,
    retryAfterSeconds: warning.retryAfterSeconds,
  };
}
