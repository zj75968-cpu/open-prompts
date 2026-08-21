import {
  canConsumeCredits,
  consumeCredits,
  getCreditsCookieName,
  getInternalCreditsLimitsFromEnv,
  parseCreditsCookie,
  serializeCreditsCookie,
} from '~/lib/credits/server';

export type GenerationCreditsContext = {
  internal: boolean;
  userId: string;
  cookieHeader: string;
  requestedCount: number;
};

function readCreditsUsage(context: GenerationCreditsContext) {
  const cookieName = getCreditsCookieName();
  const value = context.cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1) ?? null;

  return parseCreditsCookie(value, {
    userId: context.userId || undefined,
  });
}

export function getGenerationCreditsRejection(
  context: GenerationCreditsContext,
) {
  if (!context.internal) return null;

  const limits = getInternalCreditsLimitsFromEnv();
  if (limits.daily == null && limits.monthly == null) return null;

  const usage = readCreditsUsage(context);
  const allowed = canConsumeCredits(limits, usage, context.requestedCount);
  if (allowed.ok) return null;

  const detail =
    allowed.reason === 'daily'
      ? `Daily credits exceeded (${usage.dayUsed}/${limits.daily})`
      : `Monthly credits exceeded (${usage.monthUsed}/${limits.monthly})`;

  return {
    error: 'Credits exceeded',
    detail,
    limits,
    usage,
    hint: 'Configure INTERNAL_DAILY_IMAGE_CREDITS / INTERNAL_MONTHLY_IMAGE_CREDITS, or use your own provider apiKey override to bypass limits.',
  };
}

export function consumeGenerationCredits(
  context: GenerationCreditsContext,
): string | null {
  if (!context.internal) return null;

  const limits = getInternalCreditsLimitsFromEnv();
  if (limits.daily == null && limits.monthly == null) return null;

  const usage = readCreditsUsage(context);
  const next = consumeCredits(
    { ...usage, userId: context.userId || usage.userId },
    context.requestedCount,
  );

  return serializeCreditsCookie(next, {
    secure: String(process.env.NODE_ENV || '') === 'production',
  });
}