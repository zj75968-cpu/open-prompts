'use client';

import './account-page.css';
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { OpenPromptsSiteFooter } from '~/components/open-prompts/OpenPromptsSiteFooter';
import { OpenPromptsSiteHeader } from '~/components/open-prompts/OpenPromptsSiteHeader';
import { UserAvatar } from '~/components/open-prompts/UserAvatar';
import { accountPanelHref } from '~/lib/account/account-path';
import { AdminTemplatesPanel } from './AdminTemplatesPanel';
import { AdminUsersPanel } from './AdminUsersPanel';
import { StatsPanel } from './StatsPanel';
import { TemplatesPanel } from './TemplatesPanel';
import type { AccountPanel, AccountProps } from './account-types';

export default function PageComponent({
  locale,
  isAdmin,
  initialPanel: panel,
  user,
  initialAdmin,
}: AccountProps) {
  const t = useTranslations('OpenPrompts.accountPage');
  const router = useRouter();
  const [templateCount, setTemplateCount] = useState<number | null>(null);
  const [adminPendingCount, setAdminPendingCount] = useState<number | null>(
    initialAdmin?.pendingCount ?? null,
  );
  const [overviewRefreshVersion, setOverviewRefreshVersion] = useState(0);

  const navigatePanel = useCallback(
    (next: AccountPanel) => {
      if (next === 'admin-denied') return;
      router.push(accountPanelHref(locale, next), { scroll: false });
    },
    [locale, router],
  );

  const refreshOverview = useCallback(() => {
    setOverviewRefreshVersion((current) => current + 1);
  }, []);

  const handleTemplateCountChange = useCallback((count: number | null) => {
    setTemplateCount(count);
  }, []);

  const handleAdminPendingCountChange = useCallback((count: number | null) => {
    setAdminPendingCount(count);
  }, []);

  const panelTitle = useMemo(() => {
    const titles: Record<AccountPanel, string> = {
      overview: t('panels.overview'),
      prompts: t('panels.prompts'),
      admin: t('panels.admin'),
      'admin-denied': t('admin.forbiddenTitle'),
      users: t('panels.users'),
      credits: t('panels.credits'),
      subscription: t('panels.subscription'),
    };
    return titles[panel];
  }, [panel, t]);

  const accountLangSuffix = useMemo(() => {
    if (panel === 'overview') return '/account';
    if (panel === 'admin-denied') return '/account/admin';
    return accountPanelHref('en', panel);
  }, [panel]);

  return (
    <div className="min-h-screen w-full bg-[var(--bg)] text-[var(--text)]">
      <OpenPromptsSiteHeader
        locale={locale}
        activeNav="account"
        langPathSuffix={accountLangSuffix}
      />
      <main className="w-full">
        <div className="op-account-shell relative">
          <div className="mx-auto w-full max-w-7xl px-6 py-6">
            <div className="op-account-layout">
              <aside className="op-account-sidebar">
                <div className="op-account-sidebar-user">
                  <div className="op-account-avatar">
                    <UserAvatar
                      image={user.image}
                      seed={user.email || user.id}
                      name={user.name}
                      size={34}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">
                      {user.name || user.email || '—'}
                    </div>
                    {user.name && user.email ? (
                      <div className="truncate text-[11px] text-[var(--text3)]">{user.email}</div>
                    ) : null}
                    {isAdmin ? (
                      <span className="mt-1 inline-block rounded border border-[rgba(232,160,32,0.2)] bg-[var(--amber-dim)] px-1.5 py-0.5 text-[10px] text-[var(--amber)]">
                        {t('sidebar.adminBadge')}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="op-account-nav-section">
                  <div className="op-account-nav-label">{t('sidebar.overview')}</div>
                  <button
                    type="button"
                    className={`op-account-nav-item${panel === 'overview' ? ' active' : ''}`}
                    onClick={() => navigatePanel('overview')}
                  >
                    {t('nav.overview')}
                  </button>
                </div>

                <div className="op-account-nav-section">
                  <div className="op-account-nav-label">{t('sidebar.content')}</div>
                  <button
                    type="button"
                    className={`op-account-nav-item${panel === 'prompts' ? ' active' : ''}`}
                    onClick={() => navigatePanel('prompts')}
                  >
                    {t('nav.prompts')}
                    <span className="op-account-nav-badge">{templateCount}</span>
                  </button>
                  {isAdmin ? (
                    <button
                      type="button"
                      className={`op-account-nav-item${panel === 'admin' ? ' active' : ''}`}
                      onClick={() => navigatePanel('admin')}
                    >
                      {t('nav.adminReview')}
                      {adminPendingCount != null && adminPendingCount > 0 ? (
                        <span className="op-account-nav-badge warn">{adminPendingCount}</span>
                      ) : null}
                    </button>
                  ) : null}
                  {isAdmin ? (
                    <button
                      type="button"
                      className={`op-account-nav-item${panel === 'users' ? ' active' : ''}`}
                      onClick={() => navigatePanel('users')}
                    >
                      {t('nav.users')}
                    </button>
                  ) : null}
                </div>

                <div className="op-account-nav-section">
                  <div className="op-account-nav-label">{t('sidebar.account')}</div>
                  <button
                    type="button"
                    className={`op-account-nav-item${panel === 'credits' ? ' active' : ''}`}
                    onClick={() => navigatePanel('credits')}
                  >
                    {t('nav.credits')}
                  </button>
                  <button
                    type="button"
                    className={`op-account-nav-item${panel === 'subscription' ? ' active' : ''}`}
                    onClick={() => navigatePanel('subscription')}
                  >
                    {t('nav.subscription')}
                  </button>
                </div>
              </aside>

              <div className="op-account-main">
                <header className="op-account-topbar">
                  <div className="op-account-topbar-title">{panelTitle}</div>
                </header>

                <div className="op-account-content">
                  <div className={`op-account-panel${panel === 'admin-denied' ? ' active' : ''}`}>
                    <div className="op-account-card p-4 text-sm text-[var(--text2)]">
                      <p className="font-medium text-[var(--text)]">{t('admin.forbiddenTitle')}</p>
                      <p className="mt-2">{t('admin.forbiddenBody', { email: user.email || '—' })}</p>
                      <p className="mt-2 text-xs text-[var(--text3)]">{t('admin.forbiddenHint')}</p>
                      <p className="mt-3 text-xs text-[var(--text3)]">
                        {t('admin.forbiddenMyTemplatesHint')}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="op-account-btn"
                          onClick={() => navigatePanel('overview')}
                        >
                          {t('nav.overview')}
                        </button>
                        <button
                          type="button"
                          className="op-account-btn primary"
                          onClick={() => navigatePanel('prompts')}
                        >
                          {t('nav.prompts')}
                        </button>
                      </div>
                    </div>
                  </div>

                  <StatsPanel
                    active={panel === 'overview'}
                    locale={locale}
                    t={t}
                    refreshVersion={overviewRefreshVersion}
                    onTemplateCountChange={handleTemplateCountChange}
                    onNavigateTemplates={() => navigatePanel('prompts')}
                  />

                  <TemplatesPanel
                    active={panel === 'prompts'}
                    locale={locale}
                    t={t}
                    refreshOverview={refreshOverview}
                  />

                  {isAdmin ? (
                    <AdminTemplatesPanel
                      active={panel === 'admin'}
                      locale={locale}
                      isAdmin={isAdmin}
                      userEmail={user.email}
                      t={t}
                      initialAdmin={initialAdmin}
                      refreshOverview={refreshOverview}
                      onPendingCountChange={handleAdminPendingCountChange}
                    />
                  ) : null}

                  {isAdmin ? (
                    <AdminUsersPanel
                      active={panel === 'users'}
                      locale={locale}
                      isAdmin={isAdmin}
                      t={t}
                    />
                  ) : null}

                  <div className={`op-account-panel${panel === 'credits' ? ' active' : ''}`}>
                    <div className="op-account-card">
                      <p className="text-sm text-[var(--text2)]">{t('placeholders.credits')}</p>
                    </div>
                  </div>

                  <div className={`op-account-panel${panel === 'subscription' ? ' active' : ''}`}>
                    <div className="op-account-card">
                      <p className="text-sm text-[var(--text2)]">{t('placeholders.subscription')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <OpenPromptsSiteFooter locale={locale} />
    </div>
  );
}