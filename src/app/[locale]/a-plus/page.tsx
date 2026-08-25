import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { normalizeLocale, buildPageMetadata } from '~/lib/seo/metadata';
import PageComponent from './PageComponent';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'APlus' });
  return buildPageMetadata({
    locale,
    path: '/a-plus',
    title: t('seo.title'),
    description: t('seo.description'),
  });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = normalizeLocale(raw);
  setRequestLocale(locale);
  return <PageComponent locale={locale} />;
}