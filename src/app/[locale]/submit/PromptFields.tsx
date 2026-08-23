'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PromptCategoryStrip } from '~/components/prompt-gallery/PromptCategoryStrip';
import {
  getSubmitCategoryTags,
  isSubmitCategoryKey,
  type SubmitCategoryKey,
} from '~/lib/prompts/prompt-categories';
import { formatSubTagLabel } from '~/lib/prompts/sub-tag-i18n';
import {
  MAX_TITLE,
  MODEL_EMOJI,
  MODEL_IDS,
  type SubmitModelId,
} from './submit-types';

export type PromptFieldsProps = {
  quickTags: string[];
  title: string;
  description: string;
  modelId: SubmitModelId;
  category: SubmitCategoryKey | '';
  tags: string[];
  prompt: string;
  shakeId: string | null;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onModelChange: (value: SubmitModelId) => void;
  onCategoryChange: (value: SubmitCategoryKey) => void;
  onAddTag: (value: string) => void;
  onRemoveTag: (value: string) => void;
  onPromptChange: (value: string) => void;
};

export function PromptFields({
  quickTags,
  title,
  description,
  modelId,
  category,
  tags,
  prompt,
  shakeId,
  onTitleChange,
  onDescriptionChange,
  onModelChange,
  onCategoryChange,
  onAddTag,
  onRemoveTag,
  onPromptChange,
}: PromptFieldsProps) {
  const t = useTranslations('OpenPrompts.submitPage');
  const [tagInput, setTagInput] = useState('');
  const categorySubTags = useMemo(
    () => (isSubmitCategoryKey(category) ? getSubmitCategoryTags(category) : []),
    [category],
  );

  const commitTagInput = () => {
    onAddTag(tagInput);
    setTagInput('');
  };

  return (
    <section aria-label={t('labels.prompt')}>
      <div className="op-sp-form-group">
        <label className="op-sp-label" htmlFor="f-title">
          {t('labels.templateTitle')} <span className="op-req">*</span>
          <span className="op-hint">{t('hints.title')}</span>
        </label>
        <input
          id="f-title"
          className={`op-sp-input${shakeId === 'f-title' ? ' op-shake' : ''}`}
          maxLength={MAX_TITLE}
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={t('placeholders.title')}
        />
      </div>

      <div className="op-sp-form-group">
        <label className="op-sp-label" htmlFor="f-desc">
          {t('labels.shortDesc')}
          <span className="op-hint">{t('hints.desc')}</span>
        </label>
        <input
          id="f-desc"
          className="op-sp-input"
          maxLength={120}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder={t('placeholders.desc')}
        />
      </div>

      <div className="op-sp-form-group">
        <label className="op-sp-label" htmlFor="f-model">
          {t('labels.model')} <span className="op-req">*</span>
        </label>
        <div className="op-sp-select-wrap">
          <select
            id="f-model"
            className="op-sp-select"
            value={modelId}
            onChange={(event) => onModelChange(event.target.value as SubmitModelId)}
          >
            {MODEL_IDS.map((id) => (
              <option key={id} value={id}>
                {`${MODEL_EMOJI[id]} ${t(`models.${id}.name`)} · ${t(`models.${id}.tag`)}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        id="f-category"
        className={`op-sp-form-group${shakeId === 'f-category' ? ' op-shake' : ''}`}
      >
        <label className="op-sp-label">
          {t('labels.category')} <span className="op-req">*</span>
        </label>
        <PromptCategoryStrip
          categoryId={category}
          onCategoryChange={(next) => {
            if (next !== 'all') onCategoryChange(next);
          }}
          subTags={categorySubTags}
          subTag={null}
          onSubTagChange={onAddTag}
          categoryLabel={(id) => t(`categories.${id}`)}
          subTagLabel={(tag) => formatSubTagLabel(tag, (key) => t(`subTags.${key}`))}
          showAll={false}
          selectedTags={tags}
        />
      </div>

      <div className="op-sp-form-group">
        <label className="op-sp-label" htmlFor="tag-input">
          {t('labels.tags')} <span className="op-req">*</span>
          <span className="op-hint">{t('hints.tags')}</span>
        </label>
        <div
          id="op-tag-wrap"
          className={`op-sp-tag-wrap${shakeId === 'tag-wrap' ? ' op-shake' : ''}`}
          onClick={() => document.getElementById('tag-input')?.focus()}
        >
          {tags.map((tag) => (
            <span key={tag} className="op-sp-tag-chip">
              {tag}{' '}
              <button type="button" onClick={() => onRemoveTag(tag)}>
                ×
              </button>
            </span>
          ))}
          <input
            id="tag-input"
            className="op-sp-tag-input"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ',') return;
              event.preventDefault();
              commitTagInput();
            }}
            placeholder={t('placeholders.tagInput')}
          />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {quickTags.map((tag) => (
            <button key={tag} type="button" className="op-sp-sugg" onClick={() => onAddTag(tag)}>
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="op-sp-form-group">
        <label className="op-sp-label" htmlFor="f-prompt">
          {t('labels.prompt')} <span className="op-req">*</span>
          <span className="op-hint">{t('hints.promptCount', { count: prompt.length })}</span>
        </label>
        <textarea
          id="f-prompt"
          className={`op-sp-textarea${shakeId === 'f-prompt' ? ' op-shake' : ''}`}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder={t('placeholders.prompt')}
        />
      </div>
    </section>
  );
}