'use client';

import { useCallback, useState } from 'react';
import { PromptTemplateDetailDialog } from '~/components/prompt-gallery/PromptTemplateDetailDialog';
import {
  templateRecordToDetailItem,
  type PromptDetailItem,
} from '~/lib/prompts/prompt-detail-item';
import type { AdminTemplateRecord, TemplateRecord } from '~/lib/prompts/template-types';
import type { AccountTranslateFn } from './account-actions';
import { displayStatus, type DisplayStatusKey } from './account-utils';

type DetailMeta = {
  statusKey: DisplayStatusKey;
  owner: string | null;
  admin: boolean;
  source: TemplateRecord | AdminTemplateRecord;
};

export type AccountTemplateDetailState = {
  open: boolean;
  item: PromptDetailItem | null;
  meta: DetailMeta | null;
  openDetail: (item: TemplateRecord | AdminTemplateRecord, admin: boolean) => void;
  closeDetail: () => void;
};

export function useAccountTemplateDetail(t: AccountTranslateFn): AccountTemplateDetailState {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<PromptDetailItem | null>(null);
  const [meta, setMeta] = useState<DetailMeta | null>(null);

  const openDetail = useCallback(
    (source: TemplateRecord | AdminTemplateRecord, admin: boolean) => {
      const owner =
        admin && 'submitterEmail' in source
          ? source.submitterEmail ?? t('table.ownerAnonymous')
          : null;
      setItem(templateRecordToDetailItem(source));
      setMeta({
        statusKey: displayStatus(source),
        owner,
        admin,
        source,
      });
      setOpen(true);
    },
    [t],
  );

  const closeDetail = useCallback(() => {
    setOpen(false);
    setItem(null);
    setMeta(null);
  }, []);

  return { open, item, meta, openDetail, closeDetail };
}

export function AccountTemplateDetailDialog({
  locale,
  t,
  state,
  onEdit,
}: {
  locale: string;
  t: AccountTranslateFn;
  state: AccountTemplateDetailState;
  onEdit?: (item: TemplateRecord) => void;
}) {
  const { meta } = state;

  return (
    <PromptTemplateDetailDialog
      open={state.open}
      item={state.item}
      locale={locale}
      onClose={state.closeDetail}
      showGenerate={meta?.statusKey === 'pub'}
      footerExtra={
        meta ? (
          <>
            <span className={`op-account-status ${meta.statusKey}`}>
              {t(`status.${meta.statusKey}`)}
            </span>
            {meta.owner ? (
              <span className="text-xs text-stone-600">
                {t('table.owner')}: {meta.owner}
              </span>
            ) : null}
            {!meta.admin && onEdit ? (
              <button
                type="button"
                className="op-account-row-btn"
                onClick={() => {
                  state.closeDetail();
                  onEdit(meta.source as TemplateRecord);
                }}
              >
                {t('table.edit')}
              </button>
            ) : null}
          </>
        ) : null
      }
    />
  );
}