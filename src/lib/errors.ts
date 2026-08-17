// Turns raw Supabase/Postgres errors ("duplicate key value violates unique
// constraint...", "violates foreign key constraint...") into short, plain-English
// messages a general user can actually act on. Auth errors and our own
// hand-written validation messages are usually already clean — those pass
// through unchanged; only text that looks like raw DB/SQL internals gets
// swapped for a generic fallback.

const FRIENDLY_BY_CODE: Record<string, string> = {
  '23505': 'That already exists — please use a different value.',
  '23503': "That action can't be completed because related information is missing or was already removed.",
  '23502': 'Please fill in all required fields.',
  '23514': "That value isn't allowed — please check what you entered.",
  '42501': "You don't have permission to do that.",
};

const PATTERN_RULES: { test: RegExp; message: string }[] = [
  { test: /duplicate key value violates unique constraint/i, message: 'That already exists — please use a different value.' },
  { test: /violates foreign key constraint/i, message: "That action can't be completed because related information is missing or was already removed." },
  { test: /violates row-level security policy/i, message: "You don't have permission to do that." },
  { test: /permission denied/i, message: "You don't have permission to do that." },
  { test: /violates not-null constraint/i, message: 'Please fill in all required fields.' },
  { test: /violates check constraint/i, message: "That value isn't allowed — please check what you entered." },
  { test: /invalid input syntax/i, message: "That value isn't in the right format." },
  { test: /JWT expired|invalid JWT|refresh_token_not_found|session.*missing/i, message: 'Your session has expired — please sign in again.' },
  { test: /Failed to fetch|NetworkError|network request failed|ERR_INTERNET_DISCONNECTED/i, message: 'Network error — please check your connection and try again.' },
];

// Signature of raw DB/SQL internals we never want to show verbatim, even if
// nothing above matched it specifically.
const LOOKS_TECHNICAL = /violates|constraint|relation "|column "|syntax error|null value in column|SQLSTATE|permission denied for|record ".*" has no field/i;

const FALLBACK = 'Something went wrong. Please try again.';

export const friendlyErrorMessage = (error: unknown, fallback: string = FALLBACK): string => {
  if (!error) return fallback;

  const message =
    typeof error === 'string'
      ? error
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '';

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : undefined;

  if (code && FRIENDLY_BY_CODE[code]) return FRIENDLY_BY_CODE[code];

  for (const rule of PATTERN_RULES) {
    if (rule.test.test(message)) return rule.message;
  }

  if (!message || LOOKS_TECHNICAL.test(message)) return fallback;

  return message;
};
