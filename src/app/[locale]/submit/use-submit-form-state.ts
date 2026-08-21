import { useCallback, useMemo, useState } from 'react';
import type { PromptVisibility } from '~/lib/prompts/template-types';
import type { SubmitCategoryKey } from '~/lib/prompts/prompt-categories';
import {
  MAX_RESULT_IMAGES,
  type SubmitFormValues,
  type SubmitModelId,
  type XImportFormValues,
} from './submit-types';
import { appendImageUrl, appendUniqueTag, isValidImageSrc } from './submit-utils';

export function useSubmitFormState() {
  const [templateVisibility, setTemplateVisibility] = useState<PromptVisibility>('public');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [modelId, setModelId] = useState<SubmitModelId>('gptImage2');
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState<SubmitCategoryKey | ''>('');
  const [tags, setTags] = useState<string[]>(['Cinematic', 'Portrait']);
  const [tagInput, setTagInput] = useState('');
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [uploadDrag, setUploadDrag] = useState(false);
  const [xImportUrl, setXImportUrl] = useState('');
  const [authorHandle, setAuthorHandle] = useState('');
  const [success, setSuccess] = useState(false);
  const [submissionId, setSubmissionId] = useState('');

  const previewImageUrls = useMemo(() => resultImages.slice(0, MAX_RESULT_IMAGES), [resultImages]);
  const imagesFull = resultImages.length >= MAX_RESULT_IMAGES;

  const applyTemplateValues = useCallback((values: SubmitFormValues) => {
    setTitle(values.title);
    setDesc(values.description);
    setPrompt(values.prompt);
    setModelId(values.modelId);
    setCategory(values.category);
    setTags(values.tags);
    setResultImages(values.images);
    setXImportUrl(values.sourceUrl);
    setAuthorHandle(values.authorHandle);
    setTemplateVisibility(values.visibility);
    setSubmissionId(values.submissionId);
  }, []);

  const applyXImportValues = useCallback(
    (values: XImportFormValues) => {
      if (typeof values.title === 'string') setTitle(values.title);
      if (typeof values.description === 'string') setDesc(values.description);
      if (typeof values.prompt === 'string') setPrompt(values.prompt);
      if (Array.isArray(values.images) && values.images.length > 0) {
        const imported = values.images.filter(isValidImageSrc).slice(0, MAX_RESULT_IMAGES);
        if (imported.length > 0) setResultImages(imported);
      }
      if (typeof values.sourceUrl === 'string' && values.sourceUrl.trim()) {
        setXImportUrl(values.sourceUrl.trim());
      }
      if (typeof values.authorHandle === 'string') setAuthorHandle(values.authorHandle);
    },
    [],
  );

  const markSubmitted = useCallback((id?: string | number | null) => {
    setSuccess(true);
    if (id) setSubmissionId(String(id));
  }, []);

  const addTag = useCallback((raw: string) => {
    setTags((current) => appendUniqueTag(current, raw));
  }, []);

  const removeTag = useCallback((tag: string) => {
    setTags((current) => current.filter((item) => item !== tag));
  }, []);

  const addImageUrl = useCallback((raw: string) => {
    setResultImages((current) => appendImageUrl(current, raw));
  }, []);

  const appendImages = useCallback((images: string[]) => {
    setResultImages((current) => {
      const room = MAX_RESULT_IMAGES - current.length;
      if (room <= 0) return current;
      return [...current, ...images.slice(0, room)];
    });
  }, []);

  const removeImage = useCallback((index: number) => {
    setResultImages((current) => current.filter((_, idx) => idx !== index));
    setUrlError(null);
  }, []);

  const resetCreateForm = useCallback(() => {
    setSuccess(false);
    setTitle('');
    setDesc('');
    setModelId('gptImage2');
    setPrompt('');
    setCategory('');
    setTags(['Cinematic', 'Portrait']);
    setTagInput('');
    setResultImages([]);
    setUrlDraft('');
    setUrlError(null);
    setXImportUrl('');
    setAuthorHandle('');
  }, []);

  return {
    templateVisibility,
    setTemplateVisibility,
    title,
    setTitle,
    desc,
    setDesc,
    modelId,
    setModelId,
    prompt,
    setPrompt,
    category,
    setCategory,
    tags,
    setTags,
    tagInput,
    setTagInput,
    resultImages,
    setResultImages,
    previewImageUrls,
    imagesFull,
    urlDraft,
    setUrlDraft,
    urlError,
    setUrlError,
    uploadDrag,
    setUploadDrag,
    xImportUrl,
    setXImportUrl,
    authorHandle,
    setAuthorHandle,
    success,
    setSuccess,
    submissionId,
    setSubmissionId,
    applyTemplateValues,
    applyXImportValues,
    markSubmitted,
    addTag,
    removeTag,
    addImageUrl,
    appendImages,
    removeImage,
    resetCreateForm,
  };
}