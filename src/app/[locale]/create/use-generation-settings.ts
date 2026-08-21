'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  PROVIDER_CAPABILITIES,
  type ProviderCapabilities,
} from '~/lib/generation/capabilities';
import { useProviderApiKeys } from './use-provider-api-keys';

export function useGenerationSettings(args: {
  templateId: string;
  templateModel?: string;
}) {
  const [provider, setProvider] = useState<string>('internal');
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [aspectTouched, setAspectTouched] = useState(false);
  const [model, setModel] = useState<string>('');
  const [quality, setQuality] = useState<string>('1k');
  const [count, setCount] = useState<number>(1);
  const { getApiKeyOverride, saveApiKeyOverride, clearApiKeyOverride } =
    useProviderApiKeys();

  const capabilities = useMemo(() => {
    if (provider !== 'internal') {
      return PROVIDER_CAPABILITIES[provider] || PROVIDER_CAPABILITIES.atlascloud;
    }

    const allCapabilities = Object.values(PROVIDER_CAPABILITIES);
    const aspectRatios = Array.from(
      new Set(
        allCapabilities.flatMap((capability) => capability.aspectRatios || []),
      ),
    );
    const qualities = Array.from(
      new Set(allCapabilities.flatMap((capability) => capability.qualities || [])),
    );
    const maxCount = Math.max(
      1,
      ...allCapabilities.map((capability) => Number(capability.maxCount || 1)),
    );
    const models = Array.from(
      new Map(
        allCapabilities
          .flatMap((capability) =>
            Array.isArray(capability.models) ? capability.models : [],
          )
          .map((modelOption) => [
            String(modelOption.value ?? modelOption.label ?? ''),
            {
              label: String(modelOption.label ?? ''),
              value: modelOption.value,
            },
          ]),
      ).values(),
    ).filter((modelOption) => modelOption.label);

    return { aspectRatios, qualities, maxCount, models } satisfies ProviderCapabilities;
  }, [provider]);

  const modelOptions = useMemo(() => {
    const templateModel = args.templateModel ?? '';
    if (provider !== 'internal') {
      const providerModels = PROVIDER_CAPABILITIES[provider]?.models;
      return Array.isArray(providerModels) && providerModels.length
        ? providerModels
        : [{ label: templateModel || 'Default', value: templateModel || 'Default' }];
    }

    const internalModels = PROVIDER_CAPABILITIES.internal?.models;
    const options =
      Array.isArray(internalModels) && internalModels.length
        ? internalModels
        : [{ label: templateModel || 'GPT Image 2', value: templateModel || 'GPT Image 2' }];
    const normalizedTemplateModel = templateModel.trim();
    if (!normalizedTemplateModel) return options;

    const exists = options.some(
      (modelOption) =>
        String(modelOption.value ?? modelOption.label) === normalizedTemplateModel,
    );
    return exists
      ? options
      : [
          { label: normalizedTemplateModel, value: normalizedTemplateModel },
          ...options,
        ];
  }, [args.templateModel, provider]);

  useEffect(() => {
    const values = modelOptions.map((option) =>
      String(option.value ?? option.label),
    );
    const preferred = String(args.templateModel || '').trim();
    const next =
      (preferred && values.includes(preferred) ? preferred : '') ||
      (model && values.includes(model) ? model : '') ||
      values[0] ||
      '';
    setModel((previous) => (previous === next ? previous : next));
    // Model reconciliation intentionally runs only when provider/template options change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.templateId, args.templateModel, modelOptions, provider]);

  useEffect(() => {
    setAspectTouched(false);
  }, [args.templateId]);

  return {
    provider,
    setProvider,
    aspectRatio,
    setAspectRatio,
    aspectTouched,
    setAspectTouched,
    model,
    setModel,
    quality,
    setQuality,
    count,
    setCount,
    capabilities,
    modelOptions,
    getApiKeyOverride,
    saveApiKeyOverride,
    clearApiKeyOverride,
  };
}