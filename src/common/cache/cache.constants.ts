export const CACHE_CONSTANTS = {
  // Course discovery cache keys & patterns [BR-CCH-01, BR-CCH-02]
  COURSES_LIST_PREFIX: "courses:list:",
  COURSES_LIST_PATTERN: "courses:list:*",
  COURSES_CACHE_TTL_SECONDS: 900, // 15 minutes per 06_System_Architecture.md §4

  // Default Redis Cache TTL
  DEFAULT_TTL_SECONDS: 900,

  // Rate Limiting Constants [BR-SEC-01]
  RATE_LIMIT_PREFIX: "ratelimit:",
  RATE_LIMIT_DEFAULT_LIMIT: 5,
  RATE_LIMIT_DEFAULT_TTL: 60, // 1 minute
} as const;
