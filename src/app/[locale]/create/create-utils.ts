export function pickClosestAspectRatio(
  width: number,
  height: number,
  options: string[],
) {
  if (!width || !height || !options.length) return options[0] || '1:1';

  const target = width / height;
  let best = options[0];
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const option of options) {
    const [rawWidth, rawHeight] = String(option).split(':');
    const optionWidth = Number(rawWidth);
    const optionHeight = Number(rawHeight);
    if (!optionWidth || !optionHeight) continue;

    const diff = Math.abs(Math.log(target / (optionWidth / optionHeight)));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = option;
    }
  }

  return best;
}