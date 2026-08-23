import type { AdminTemplateRecord, TemplateRecord } from '~/lib/prompts/template-types';

export type DisplayStatusKey = 'pub' | 'draft' | 'priv' | 'pending' | 'rejected';

export function formatJoinedAt(iso: string, locale: string): string {
  const tag = locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-US';
  return new Date(iso).toLocaleString(tag, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatReviewDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const tag = locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-US';
  return d.toLocaleDateString(tag, { month: '2-digit', day: '2-digit' });
}

export function formatProviderLabels(providers: string[]): string {
  return providers
    .map((p) => (p === 'github' ? 'GitHub' : p === 'google' ? 'Google' : p))
    .join(', ');
}

export function trendDayLabel(date: string, locale: string): string {
  const tag = locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-US';
  return new Date(`${date}T12:00:00.000Z`).toLocaleDateString(tag, {
    month: 'numeric',
    day: 'numeric',
  });
}

export function smoothTrendPath(coords: { x: number; y: number }[], tension = 0.35): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
  if (coords.length === 2) {
    return `M ${coords[0].x} ${coords[0].y} L ${coords[1].x} ${coords[1].y}`;
  }

  let d = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(i - 1, 0)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(i + 2, coords.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function displayStatus(item: TemplateRecord | AdminTemplateRecord): DisplayStatusKey {
  if (item.status === 'rejected') return 'rejected';
  if (item.status === 'pending') return 'pending';
  if (item.visibility === 'draft') return 'draft';
  if (item.visibility === 'private') return 'priv';
  return 'pub';
}
