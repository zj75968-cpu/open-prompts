'use client';

import { useMemo, useState } from 'react';
import { pollGenerationJob } from '~/lib/generation/generation-api-client';
import { isGenerationErrorResponse, type GenerationPollResponseDto } from '~/lib/generation/generation-dto';
import {
  A_PLUS_CANVAS_ASPECT_RATIOS,
  DEFAULT_A_PLUS_CANVAS_ASPECT_RATIO,
  buildAPlusCanvasUserPrompt,
  type APlusCanvasAspectRatio,
  type APlusInput,
} from '~/lib/a-plus/a-plus-domain';
import { editAPlusCanvas } from './a-plus-canvas-api';
import { sliceImageIntoEqualParts, CANVAS_SLICE_COUNTS, type CanvasSliceResult } from './a-plus-canvas-slice';
import { aPlusImageUrl, triggerDownload } from './a-plus-api';

type Props = {
  locale: string;
  input: APlusInput;
};

type CanvasVersion = {
  id: number;
  imageUrl: string;
  instruction: string;
  createdAt: string;
  providerJobId: string;
};

type CanvasMessage = {
  role: 'user' | 'assistant';
  text: string;
};

const copyByLocale = {
  zh: {
    title: '连续画布编辑器', subtitle: '一张完整的纵向 A+ 长图，电脑和手机都通过上下滚动查看。', ratio: '画布比例', ratioHint: '全局设置位于顶部，生成后仍可基于当前版本继续修改。', constraints: '生成约束', identity: '保留商品外观', background: '连续背景', typography: '文字后期排版', versions: '历史版本', autoSave: '自动保存', export: '导出整张图片', sliceTitle: '切割整图', sliceHint: '整图生成后，选择要切割成的张数。系统会按图片高度等分。', sliceCount: '切割张数', sliceAction: '开始切割', slicing: '正在切割…', sliced: '切割完成', sliceDownload: '下载第', sliceUnit: '张', sliceRequired: '请先生成整张图片。', sliceFailed: '切割失败，请重试。', empty: '先生成一张完整的纵向整图', emptyHint: '系统先生成一整张连续图片，完成后你可以选择切割成 1 到 5 张。', chat: '对话式修改', chatHint: '告诉我想修改哪里，其他内容会尽量保持不变。', placeholder: '例如：把第二段背景改成浅灰色，产品外观不要改变…', send: '发送', generating: '正在分析并生成新版本…', generated: '已基于上一版生成新版本。', initial: '生成整张图片', initialInstruction: '', noImage: '请先在创建页上传商品图。', noInstruction: '请输入修改内容。', failed: '本次编辑失败，请更换修改指令后重试。', current: '当前', versionEdit: '对话修改', saved: '刚刚保存', scrollHint: '纵向连续画布 · 页面上下滚动 · 无需左右滑动', editMode: '连续画布', moduleMode: '五模块套图', choose: '选择', presetGray: '背景改成浅灰色', presetLarge: '产品放大 15%', presetDark: '整体改成深色高级风', presetBedroom: '底部改成卧室场景', emptyVersion: '暂无版本', outputHint: 'AI 先生成整图，再按你的选择切割', fallback: '当前使用图片编辑接口',
  },
  en: {
    title: 'Continuous canvas editor', subtitle: 'One complete vertical A+ story. Desktop and mobile use normal vertical scrolling.', ratio: 'Canvas ratio', ratioHint: 'Global settings stay at the top. Continue editing from the current version after generation.', constraints: 'Generation constraints', identity: 'Preserve product identity', background: 'Continuous background', typography: 'Deterministic text layer', versions: 'Versions', autoSave: 'Auto saved', export: 'Export full image', sliceTitle: 'Slice full image', sliceHint: 'After the full image is ready, choose how many equal-height slices to create.', sliceCount: 'Slice count', sliceAction: 'Slice image', slicing: 'Slicing…', sliced: 'Slicing complete', sliceDownload: 'Download slice', sliceUnit: '', sliceRequired: 'Generate the full image first.', sliceFailed: 'Slicing failed. Try again.', empty: 'Generate one complete vertical image first', emptyHint: 'The system generates one full continuous image first. Then choose whether to cut it into 1 to 5 slices.', chat: 'Edit by conversation', chatHint: 'Describe what to change. Unrelated content stays locked where possible.', placeholder: 'For example: make the second section light gray without changing the product…', send: 'Send', generating: 'Analyzing and generating a new version…', generated: 'A new version was generated from the previous canvas.', initial: 'Generate full image', initialInstruction: '', noImage: 'Upload a product image on the create tab first.', noInstruction: 'Enter an edit instruction.', failed: 'The edit failed. Try a more specific instruction.', current: 'Current', versionEdit: 'Conversation edit', saved: 'Saved just now', scrollHint: 'Vertical continuous canvas · vertical scrolling · no horizontal swipe', editMode: 'Continuous canvas', moduleMode: 'Five-module set', choose: 'Select', presetGray: 'Make the background light gray', presetLarge: 'Enlarge the product 15%', presetDark: 'Make the whole style premium and dark', presetBedroom: 'Change the lower scene to a bedroom', emptyVersion: 'No versions yet', outputHint: 'Generate one full image, then slice it as requested', fallback: 'Using the image edit endpoint',
  },
} as const;

function ratioCss(value: APlusCanvasAspectRatio): string {
  return value.replace(':', ' / ');
}

function formatRatio(value: APlusCanvasAspectRatio): string {
  return value === '1464:600' ? '1464:600 · short banner' : value === '1464:2400' ? '1464:2400 · long detail page' : '1464:1800 · vertical A+ canvas';
}

const CANVAS_POLL_INTERVAL_MS = 2000;
const MAX_CANVAS_POLLS = 300;
const MAX_TRANSIENT_POLL_FAILURES = 6;

type CanvasGenerationStatus = 'queued' | 'running' | 'succeeded' | 'failed';
type CanvasSliceStatus = 'idle' | 'slicing' | 'succeeded' | 'failed';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function errorText(value: unknown, fallback: string): string {
  return value instanceof Error && value.message ? value.message : fallback;
}

async function resolveCanvasImage(
  locale: string,
  providerJobId: string,
  imageUrl?: string,
  initialStatus: CanvasGenerationStatus = 'queued',
): Promise<string> {
  if (imageUrl) return imageUrl;
  if (initialStatus === 'failed') {
    throw new Error('Canvas provider rejected the generation request.');
  }
  if (initialStatus === 'succeeded') {
    throw new Error('Canvas provider reported success without returning an image.');
  }

  let transientFailures = 0;
  for (let poll = 0; poll < MAX_CANVAS_POLLS; poll += 1) {
    if (poll > 0) await sleep(CANVAS_POLL_INTERVAL_MS);

    let response;
    try {
      response = await pollGenerationJob(locale, providerJobId);
    } catch (pollError: unknown) {
      transientFailures += 1;
      if (transientFailures <= MAX_TRANSIENT_POLL_FAILURES) continue;
      throw new Error(`Canvas generation polling failed: ${errorText(pollError, 'network error')}`);
    }

    if (!response.ok || isGenerationErrorResponse(response.data)) {
      const message = isGenerationErrorResponse(response.data)
        ? response.data.error
        : `Canvas generation polling failed (${response.status})`;
      const retryable = response.status >= 500 || response.status === 429;
      if (retryable) {
        transientFailures += 1;
        if (transientFailures <= MAX_TRANSIENT_POLL_FAILURES) continue;
      }
      throw new Error(message);
    }

    transientFailures = 0;
    const payload = response.data as GenerationPollResponseDto;
    if (payload.status === 'succeeded') {
      if (payload.images?.[0]) return payload.images[0];
      throw new Error('Canvas provider reported success without returning an image.');
    }
    if (payload.status === 'failed') {
      throw new Error(payload.error || 'Canvas generation failed');
    }
  }

  throw new Error(
    `Canvas generation timed out after ${Math.round((MAX_CANVAS_POLLS * CANVAS_POLL_INTERVAL_MS) / 60000)} minutes. The provider job may still be running.`,
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={on} className={`a-plus-canvas-toggle ${on ? 'on' : ''}`} onClick={onClick}><span /></button>;
}

export function ContinuousCanvasPanel({ locale, input }: Props) {
  const text = locale === 'zh' ? copyByLocale.zh : copyByLocale.en;
  const [aspectRatio, setAspectRatio] = useState<APlusCanvasAspectRatio>(input.canvasAspectRatio || DEFAULT_A_PLUS_CANVAS_ASPECT_RATIO);
  const [preserveIdentity, setPreserveIdentity] = useState(true);
  const [continuousBackground, setContinuousBackground] = useState(true);
  const [deterministicTypography, setDeterministicTypography] = useState(true);
  const [instruction, setInstruction] = useState('');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [versions, setVersions] = useState<CanvasVersion[]>([]);
  const [messages, setMessages] = useState<CanvasMessage[]>([]);
  const [sliceCount, setSliceCount] = useState(3);
  const [slices, setSlices] = useState<CanvasSliceResult[]>([]);
  const [sliceStatus, setSliceStatus] = useState<CanvasSliceStatus>('idle');
  const [status, setStatus] = useState<'idle' | 'generating' | 'succeeded' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [imageLoadFallback, setImageLoadFallback] = useState(false);

  const ratioLabel = useMemo(() => formatRatio(aspectRatio), [aspectRatio]);
  const latestVersion = versions[versions.length - 1] || null;
  const activeVersion = versions.find((version) => version.imageUrl === currentImage) || latestVersion;
  const currentPreviewUrl = currentImage ? aPlusImageUrl(locale, currentImage) : null;
  const addMessage = (message: CanvasMessage) => setMessages((current) => [...current, message]);

  const runEdit = async (requestedInstruction: string) => {
    const editInstruction = requestedInstruction;
    if (!input.sourceImage) {
      setError(text.noImage);
      return;
    }
    if (!editInstruction.trim()) {
      setError(text.noInstruction);
      return;
    }

    setError(null);
    setStatus('generating');
    setSliceStatus('idle');
    setSlices([]);
    setInstruction('');
    addMessage({ role: 'user', text: requestedInstruction });
    try {
      const result = await editAPlusCanvas(locale, {
        currentImage: currentImage || input.sourceImage,
        sourceImage: currentImage ? input.sourceImage : null,
        editInstruction: requestedInstruction,
        aspectRatio,
        preserveIdentity,
        continuousBackground,
        deterministicTypography,
        language: input.language,
        productName: input.productName,
        category: input.category,
        sellingPoints: input.sellingPoints,
      });
      const imageUrl = await resolveCanvasImage(
        locale,
        result.providerJobId,
        result.imageUrl,
        result.status,
      );
      const nextVersion: CanvasVersion = {
        id: (latestVersion?.id || 0) + 1,
        imageUrl,
        instruction: editInstruction,
        createdAt: new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
        providerJobId: result.providerJobId,
      };
      setVersions((current) => [...current, nextVersion]);
      setImageLoadFallback(false);
      setCurrentImage(imageUrl);
      setStatus('succeeded');
      addMessage({ role: 'assistant', text: text.generated });
    } catch (editError: unknown) {
      setStatus('failed');
      const message = editError instanceof Error ? editError.message : text.failed;
      setError(message);
      addMessage({ role: 'assistant', text: text.failed });
    }
  };

  const handleSlice = async () => {
    if (!currentImage || !currentPreviewUrl) {
      setError(text.sliceRequired);
      return;
    }

    setError(null);
    setSliceStatus('slicing');
    try {
      const nextSlices = await sliceImageIntoEqualParts(currentPreviewUrl, sliceCount);
      setSlices(nextSlices);
      setSliceStatus('succeeded');
    } catch (sliceError: unknown) {
      setSlices([]);
      setSliceStatus('failed');
      setError(sliceError instanceof Error ? sliceError.message : text.sliceFailed);
    }
  };

  const downloadCurrent = () => {
    if (!currentImage) return;
    const link = document.createElement('a');
    link.href = currentPreviewUrl || currentImage;
    link.download = `${input.productName || 'a-plus-canvas'}-v${activeVersion?.id || 1}.png`;
    link.click();
  };

  return (
    <section className="a-plus-canvas-mode" aria-label={text.editMode}>
      <div className="a-plus-canvas-topbar">
        <div>
          <div className="a-plus-canvas-eyebrow">A+ CANVAS / EDIT MODE</div>
          <h2>{text.title}</h2>
          <p>{text.subtitle}</p>
        </div>
        <div className="a-plus-canvas-mode-badge">{text.fallback}</div>
      </div>

      <div className="a-plus-canvas-settings">
        <div className="a-plus-canvas-setting-group ratio-setting">
          <h3>{text.ratio}</h3>
          <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as APlusCanvasAspectRatio)} disabled={status === 'generating'}>
            {A_PLUS_CANVAS_ASPECT_RATIOS.map((ratio) => <option key={ratio} value={ratio}>{formatRatio(ratio)}</option>)}
          </select>
          <small>{text.ratioHint}</small>
        </div>
        <div className="a-plus-canvas-setting-group">
          <h3>{text.constraints}</h3>
          <label><span>{text.identity}</span><Toggle on={preserveIdentity} onClick={() => setPreserveIdentity((value) => !value)} /></label>
          <label><span>{text.background}</span><Toggle on={continuousBackground} onClick={() => setContinuousBackground((value) => !value)} /></label>
          <label><span>{text.typography}</span><Toggle on={deterministicTypography} onClick={() => setDeterministicTypography((value) => !value)} /></label>
        </div>
        <div className="a-plus-canvas-setting-group version-setting">
          <div className="a-plus-canvas-setting-heading"><h3>{text.versions}</h3><span>{text.autoSave}</span></div>
          <div className="a-plus-canvas-versions">
            {versions.length ? versions.map((version) => <button type="button" key={version.id} className={version.imageUrl === currentImage ? 'active' : ''} onClick={() => { setImageLoadFallback(false); setCurrentImage(version.imageUrl); }}><span>v{version.id}</span><small>{version.id === activeVersion?.id ? text.current : text.choose} · {version.createdAt}</small></button>) : <span className="a-plus-canvas-empty-version">{text.emptyVersion}</span>}
          </div>
        </div>
        <div className="a-plus-canvas-setting-group slice-setting">
          <h3>{text.sliceTitle}</h3>
          <select value={sliceCount} onChange={(event) => setSliceCount(Number(event.target.value))} disabled={!currentImage || sliceStatus === 'slicing'}>
            {CANVAS_SLICE_COUNTS.map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
          <button type="button" className="a-plus-button" onClick={() => void handleSlice()} disabled={!currentImage || sliceStatus === 'slicing'}>
            {sliceStatus === 'slicing' ? text.slicing : text.sliceAction}
          </button>
          <small>{text.sliceHint}</small>
        </div>
        <div className="a-plus-canvas-setting-group export-setting">
          <button type="button" className="a-plus-button a-plus-button-primary" onClick={downloadCurrent} disabled={!currentImage}>{text.export}</button>
          <small>{text.outputHint}</small>
        </div>
      </div>

      <div className="a-plus-canvas-layout">
        <aside className="a-plus-canvas-chat">
          <div className="a-plus-canvas-panel-heading"><h3>{text.chat}</h3><p>{text.chatHint}</p></div>
          <div className="a-plus-canvas-message-list">
            {!messages.length ? <div className="a-plus-canvas-message assistant">{text.initial}</div> : messages.map((message, index) => <div className={`a-plus-canvas-message ${message.role}`} key={`${message.role}-${index}`}>{message.text}</div>)}
            {status === 'generating' ? <div className="a-plus-canvas-message assistant pending">{text.generating}</div> : null}
          </div>
          <div className="a-plus-canvas-presets">
            {[text.presetGray, text.presetLarge, text.presetDark, text.presetBedroom].map((preset) => <button type="button" key={preset} onClick={() => void runEdit(preset)} disabled={status === 'generating'}>{preset}</button>)}
          </div>
          <div className="a-plus-canvas-composer"><textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder={text.placeholder} disabled={status === 'generating'} /><button type="button" onClick={() => void runEdit(instruction)} disabled={status === 'generating'}>{text.send}</button></div>
          {error ? <div className="a-plus-error">{error}</div> : null}
        </aside>

        <div className="a-plus-canvas-preview-column">
          <div className="a-plus-canvas-preview-meta"><span>{ratioLabel} · {text.scrollHint}</span><span className={status === 'failed' ? 'failed' : 'ready'}>{status === 'generating' ? text.generating : status === 'failed' ? text.failed : text.saved}</span></div>
          <div className="a-plus-canvas-preview" style={{ aspectRatio: ratioCss(aspectRatio) }}>
            {currentPreviewUrl ? <img
              key={currentImage || currentPreviewUrl}
              src={imageLoadFallback && currentImage ? currentImage : currentPreviewUrl}
              alt={text.title}
              onError={(event) => {
                if (!imageLoadFallback && currentImage && currentPreviewUrl !== currentImage) {
                  setImageLoadFallback(true);
                  return;
                }
                event.currentTarget.style.display = 'none';
                setError(text.failed);
              }}
            /> : <div className="a-plus-canvas-empty"><strong>{text.empty}</strong><span>{text.emptyHint}</span><button type="button" className="a-plus-button a-plus-button-primary" onClick={() => void runEdit(buildAPlusCanvasUserPrompt(input))} disabled={status === 'generating'}>{text.initial}</button></div>}
          </div>
          {slices.length ? (
            <div className="a-plus-canvas-slice-results" aria-live="polite">
              <div className="a-plus-canvas-slice-results-heading">
                <h3>{text.sliced}</h3>
                <span>{slices.length} {text.sliceUnit}</span>
              </div>
              <div className="a-plus-canvas-slice-grid">
                {slices.map((slice) => (
                  <article key={slice.index} className="a-plus-canvas-slice-card">
                    <img src={slice.imageUrl} alt={`${text.sliceDownload} ${slice.index}`} />
                    <button type="button" className="a-plus-button a-plus-button-small" onClick={() => triggerDownload(slice.imageUrl, `${input.productName || 'a-plus-canvas'}-slice-${slice.index}-of-${slice.total}.png`)}>
                      {text.sliceDownload} {slice.index} {text.sliceUnit}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}