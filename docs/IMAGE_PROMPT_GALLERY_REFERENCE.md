# Image Prompt Gallery 二开参考

目标：以 `rudy2steiner/open-prompts` 作为主二开底座，吸收其它 image prompt gallery 项目的可复用设计、数据组织和交互能力。

## 1. 主项目：`rudy2steiner/open-prompts`

- 仓库：https://github.com/rudy2steiner/open-prompts
- Demo：https://www.open-prompts.com
- 许可证：Apache-2.0
- 技术栈：Next.js 15、TypeScript、React 18、NextAuth、Drizzle、Postgres/Supabase、next-intl、Cloudflare/OpenNext
- 定位：完整的 AI image prompt 模板平台，包含图库浏览、模板复用、生成工作台、用户体系和数据库。

### 可作为主架构的原因

1. 它不是单纯静态图库，而是“平台型”项目，适合继续扩展成产品。
2. 已经包含用户、模板、数据库、国际化、SEO、部署脚本等完整工程要素。
3. 许可证明确，Apache-2.0 对二开较友好。

### 已确认的关键目录

```text
src/app                  # Next.js App Router 页面与 API
src/components           # UI 组件
src/components/generation
src/components/prompt-gallery
src/components/open-prompts
src/lib                  # 业务逻辑层
src/lib/generation       # 生成能力相关逻辑
src/lib/prompts          # prompt 相关逻辑
src/lib/templates        # 模板相关逻辑
src/db/schema.ts         # Drizzle 数据模型
supabase/migrations      # 数据库迁移
scripts/seed-prompts.ts  # prompt 初始数据
scripts/seed-admin.ts    # 管理员初始化
scripts/import-gpt-image2-prompts.mjs # 外部 prompt 数据导入
openspec                 # 需求/变更规格管理
```

### 二开优先入口

1. **数据模型**：先读 `src/db/schema.ts`，确定 prompt、template、user、generation 之间的关系。
2. **图库 UI**：从 `src/components/prompt-gallery` 开始改，不要先动数据库。
3. **生成流程**：从 `src/lib/generation` 与 `src/components/generation` 切入。
4. **种子数据**：用 `scripts/seed-prompts.ts` 和 `scripts/import-gpt-image2-prompts.mjs` 建立自己的 prompt 数据集导入流程。
5. **国际化**：保留 `messages` 和 `next-intl`，中文站可以先把英文内容替换成中文，再考虑多语言扩展。

### 建议保留的模块边界

```text
Prompt 数据层       -> src/db/schema.ts / migrations
Prompt 业务层       -> src/lib/prompts / src/lib/templates
生成供应商适配层    -> src/lib/generation
图库展示层         -> src/components/prompt-gallery
生成工作台 UI      -> src/components/generation
路由与 SEO         -> src/app / src/lib/seo
```

不要把“图库筛选、prompt 数据、生成 API、用户收藏”都塞进组件里。二开时应保持：组件只负责展示和交互，数据转换放到 `src/lib`，持久化放到 `src/db`。

---

## 2. 可借鉴项目清单

## `ChaosRealmsAI/gpt-image-2-gallery`

- 仓库：https://github.com/ChaosRealmsAI/gpt-image-2-gallery
- Demo：https://gpt-image-2-gallery.vercel.app
- 许可证：MIT，内容标注 CC BY 4.0
- 技术栈：Vite、JavaScript、静态图库
- 特点：3800+ GPT-Image-2 作品、445 个主题、prompt 可复制。

### 可利用点

1. **大规模静态内容组织方式**：适合参考它如何管理大量作品、主题、图片和 prompt。
2. **导入/构建脚本**：它有 `works:*`、`images:optimize`、`readme:gen` 这类脚本，可借鉴为 `open-prompts` 做批量导入和图片优化。
3. **主题分类**：445 个主题的分类方式可以作为我们后续 prompt taxonomy 的参考。
4. **复制 prompt 体验**：适合借鉴卡片上的 copy-to-clipboard 交互。

### 建议迁移方式

不要直接搬 UI。更适合抽取它的“作品数据结构 + 图片优化脚本 + 分类策略”，导入到 `open-prompts` 的数据库和图库组件。

---

## `fishxcode/gpt-image-2`

- 仓库：https://github.com/fishxcode/gpt-image-2
- Demo：https://fishxcode-gpt-image-2.lovable.app/
- 许可证：MIT
- 技术栈：Vite、TypeScript、React 19、TanStack、Radix UI、Cloudflare
- 定位：GPT-Image-2 在线 playground，支持 prompt plaza、自定义 API Key、双语 SEO。

### 可利用点

1. **自定义 API Key 模式**：如果希望用户使用自己的 OpenAI key，可以参考它的 BYOK 设计。
2. **Prompt Plaza 概念**：可以迁移成 `open-prompts` 的公开模板广场。
3. **现代 UI 组件组合**：Radix UI + Tailwind 的表单、弹窗、tabs、popover 交互值得参考。
4. **双语 SEO 路由**：可以与 `open-prompts` 现有 `next-intl` 结合。

### 建议迁移方式

把它作为“生成工作台 UX 参考”，不是架构底座。`open-prompts` 已经更适合做平台，不建议反向迁移到 Vite 单页应用。

---

## `jsonfm/ai-image-prompts-gallery`

- 仓库：https://github.com/jsonfm/ai-image-prompts-gallery
- Demo：https://jsonfm.github.io/ai-image-prompts-gallery
- 许可证：未明确
- 技术栈：Vite、React、TypeScript、Tailwind、Vitest
- 定位：静态 AI image prompt gallery / photography lab。

### 可利用点

1. **轻量图库 UI**：适合参考卡片、筛选、详情页布局。
2. **数据 manifest**：`data/generation-manifest.json` 的组织方式适合作为静态导入格式参考。
3. **测试配置**：带 Vitest 和 Testing Library，适合参考前端组件测试。
4. **字体和视觉风格**：`DM Sans`、`Fraunces` 的视觉组合可用于灵感参考。

### 风险

许可证未明确，不建议直接复制代码。可以学习结构和交互，不直接搬实现。

---

## `xigua222/prompt-gallery`

- 仓库：https://github.com/xigua222/prompt-gallery
- 许可证：Other
- 技术栈：Vite、React 19、TypeScript、React Router、motion、Tailwind
- 定位：中文高质量 AI 生图 Prompt 灵感库，覆盖 Midjourney、Stable Diffusion、FLUX、GPT-Image、Gemini/Nano Banana、Seedream 等。

### 可利用点

1. **中文内容组织**：适合参考中文 prompt 分类、中文 SEO 文案、中文用户习惯。
2. **多模型标签体系**：适合做 `model`、`style`、`use_case`、`provider` 标签设计。
3. **数据生成脚本**：`scripts/generate-data.mjs` 可作为构建静态索引/搜索数据的参考。
4. **模型映射**：`modelMapping.ts` / `models.ts` 类似结构适合迁移到 `open-prompts` 的 provider 层。

### 风险

许可证不是标准开源协议，直接复制代码前要确认授权。

---

## `SchmitzAndrew/prompt-gallery`

- 仓库：https://github.com/SchmitzAndrew/prompt-gallery
- Demo：https://promptgallery.app
- 许可证：GPLv3
- 技术栈：Next.js 13、TypeScript、Tailwind
- 定位：展示不同 txt2img 模型生成图片的图库。

### 可利用点

1. **多模型结果对比**：如果要展示“同一个 prompt 在不同模型下的效果”，这个方向值得参考。
2. **贡献页面**：`contribute.tsx` 可以参考如何引导用户提交 prompt 和图片。
3. **方法论页面**：`methodology.tsx` 可参考如何解释生成参数、模型差异和评测规则。

### 风险

GPLv3 传染性较强。如果我们的项目不想 GPL 开源，不建议复制代码，只参考产品思路。

---

## `piotrmacai/react-aipromptgallery-app`

- 仓库：https://github.com/piotrmacai/react-aipromptgallery-app
- Demo：https://react-aipromptgallery-app.vercel.app
- 许可证：未明确
- 技术栈：Vite、React、TypeScript、Gemini API、Notion service
- 定位：Prompt Gallery + Gemini 图片分析/生成 prompt。

### 可利用点

1.  93 5793
2. **Notion 数据源**：`notionService.ts` 可参考把 Notion 当 CMS 的方案。
3. **PromptModal**：适合参考 prompt 详情弹窗的信息结构。

### 风险

许可证未明确，不建议直接复制代码。

---

## `ComfyAssets/ComfyUI_PromptManager`

- 仓库：https://github.com/ComfyAssets/ComfyUI_PromptManager
- 许可证：MIT
- 技术栈：Python / ComfyUI 插件
- 定位：ComfyUI Prompt 管理器，含搜索、标签、评分、图片图库、亮暗主题和批量操作。

### 可利用点

1. **Prompt 管理能力**：收藏、评分、标签、批量操作适合迁移成平台功能。
2. **图库 + 元数据**：适合参考如何把生成结果和 prompt 元数据绑定。
3. **本地工作流适配**：后续如果接 ComfyUI，可以参考它的数据存储和 UI 扩展方式。

### 建议迁移方式

作为功能清单参考，不作为 Web 主项目代码来源。

---

## `dr413677671/PromptGallery-stable-diffusion-webui`

- 仓库：https://github.com/dr413677671/PromptGallery-stable-diffusion-webui
- 许可证：Apache-2.0
- 技术栈：Python / Stable Diffusion WebUI 扩展
- 定位：A1111 Stable Diffusion WebUI 的 prompt cookbook/gallery 扩展。

### 可利用点

1. **Prompt cookbook 形态**：适合参考 prompt 按风格、人物、构图、光照等模块拆分。
2. **WebUI 插件体验**：如果未来要接 A1111，可以参考它的插件入口。
3. **提示词片段复用**：可以迁移成 `prompt block` / `prompt snippet` 功能。

---

## 3. 推荐二开路线

### 阶段 1：先把 `open-prompts` 跑起来

1. 安装依赖：`npm install`
2. 启动 Supabase：`npm run supabase:start`
3. 初始化数据库：`npm run db:push`
4. 导入示例 prompt：`npm run seed:prompts`
5. 启动开发：`npm run dev`

具体环境变量以 `.env.example` 和 `.dev.vars.example` 为准。

### 阶段 2：改图库，而不是先改生成 API

优先做这些：

1. 首页改成 image prompt gallery 信息架构。
2. Prompt 卡片增加：模型、风格、用途、语言、尺寸、生成参数、复制按钮。
3. 详情页增加：原图、prompt、negative prompt、seed、model、provider、可复用按钮。
4. 加搜索与筛选：模型、风格、场景、横竖图、中文/英文。

### 阶段 3：导入外部数据

借鉴 `ChaosRealmsAI/gpt-image-2-gallery` 的静态作品数据，把外部 prompt 转换成统一结构：

```ts
type PromptAsset = {
  title: string;
  prompt: string;
  negativePrompt?: string;
  imageUrl: string;
  provider: 'openai' | 'midjourney' | 'stable-diffusion' | 'flux' | 'gemini' | 'seedream';
  model: string;
  tags: string[];
  style: string[];
  useCase: string[];
  params?: {
    size?: string;
    seed?: string;
    guidanceScale?: number;
    steps?: number;
  };
  license?: string;
  sourceUrl?: string;
};
```

### 阶段 4：再做生成工作台

生成工作台建议保持 provider adapter 结构：

```text
src/lib/generation/providers/openai.ts
src/lib/generation/providers/gemini.ts
src/lib/generation/providers/flux.ts
src/lib/generation/providers/comfyui.ts
```

这样不会让生成供应商逻辑污染 UI，也方便以后切换模型。

---

## 4. 不建议直接采用的东西

1. 不建议把 Vite 静态图库整体塞进 `open-prompts`，会造成路由、状态、数据层混乱。
2. 不建议直接复制无 LICENSE 项目的源码。
3. 不建议先做复杂生成 API。Gallery 的核心价值是“prompt 发现、筛选、复用”，生成只是后续闭环。
4. 不建议把 prompt 数据直接硬编码到组件里，应该走数据库或统一导入脚本。

---

## 5. 当前推荐结论

主底座：`rudy2steiner/open-prompts`

最值得吸收的外部能力：

1. `ChaosRealmsAI/gpt-image-2-gallery`：大规模图库数据结构、图片优化、主题分类。
2. `fishxcode/gpt-image-2`：生成 playground、BYOK、自定义 API Key、现代交互组件。
3. `xigua222/prompt-gallery`：中文内容组织、多模型标签体系。
4. `ComfyAssets/ComfyUI_PromptManager`：收藏、评分、标签、批量管理、元数据绑定。
5. `SchmitzAndrew/prompt-gallery`：同 prompt 多模型对比、贡献页、方法论页。