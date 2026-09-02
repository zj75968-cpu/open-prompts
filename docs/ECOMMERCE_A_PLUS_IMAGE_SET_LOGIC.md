# 电商 A+ 套图生成逻辑设计

> 基于以下两个参考仓库，并结合当前 `open-prompts` 的生成链路整理：
>
> - `amazon-listing-generator-skill`
> - `sellerpilot-product-image-industrial`
>
> 文档目标：定义一个“上传一张商品图，补充少量商品信息，自动生成一套电商 A+ 详情图”的可落地产品逻辑。本文重点是领域逻辑和工程边界，不是直接复制两个仓库的实现。

---

## 1. 结论先行

### 1.1 最值得借鉴的不是 Prompt，而是生产流程

两个参考仓库真正有价值的部分不是某一条图片提示词，而是把“出图”拆成了几个有职责边界的阶段：

1. 先理解商品事实。
2. 再理解买家的购买疑虑。
3. 再决定每一张图片的商业任务。
4. 再决定画面、版式和文案。
5. 再生成图片。
6. 生成后验证商品是否变形、卖点是否有证据、文字是否可读。
7. 只修复失败的图片或区域，而不是整套重新生成。
8. 最后按平台要求导出和交付。

这套顺序应成为 `open-prompts` 的 A+ 套图核心逻辑。

### 1.2 推荐的产品定义

第一版不应定义为“一个 Prompt 生成多张图片”，而应定义为：

> 一个商品视觉生产任务系统，把一张商品原图转换成商品事实、买家问题、A+ 模块蓝图、逐模块生成任务、审核结果和最终下载包。

### 1.3 推荐的第一版输出

默认生成一套 5 张 A+ 模块图，而不是固定生成 7～8 张：

- `AD-01` 品牌主视觉与产品定位
- `AD-02` 用户痛点与解决方案
- `AD-03` 核心卖点与视觉证明
- `AD-04` 产品结构、材质或关键细节
- `AD-05` 使用场景与适用人群

当商品信息足够完整时，再追加：

- `AD-06` 尺寸、规格、适配关系
- `AD-07` 包装、安装、使用步骤或 FAQ

不应该为了凑数量生成弱模块。模块数量由“买家问题是否已经被回答”决定。

---

## 2. 参考仓库的价值判断

### 2.1 `amazon-listing-generator-skill` 值得借鉴的部分

参考文件：

- `amazon-listing-generator-skill/SKILL.md`
- `amazon-listing-generator-skill/references/amazon-image-strategy.md`
- `amazon-listing-generator-skill/scripts/generate_excel.py`

#### 可直接借鉴

- 明确区分 Amazon 轮播副图和 A+ 详情页模块。
- 使用稳定的槽位编号，例如 `AS-02` 和 `AD-03`，便于用户单独重做某一张。
- 将“副图”请求拆成 5～7 张有独立价值的图片，而不是无条件生成 8 张。
- 使用买家疑虑地图，而不是按原始参数一项一张图片。
- 将卖点拆分成 `Claim`、`Proof`、`Mechanism`、`Fit/Size`、`Use Case`、`Comfort/Safety`、`Included/Installation`。
- 一个图片只承担一个主要观点，但可以把互相证明的卖点合并到同一张图。
- 生成图片前先做版式决策，决定是否需要标题、文字放在哪、是否需要文本背景、人物和产品如何配合。
- 参考竞品的表达策略，不复制竞品的文字、布局、图标、色彩和人物动作。
- 支持用户只重做某一个槽位，例如“只重做尺寸图”。
- 导出结构化汇总文件，而不是只返回散落在聊天中的图片。

#### 需要改造

- 该仓库以 Codex Skill 为主要载体，输入和执行依赖对话，不适合直接作为 Web 后台。
- 它把大量规则写在 Skill 文本中，Web 版本需要转成领域函数、JSON Schema、任务状态和可追踪的数据库记录。
- 现有槽位偏 Amazon Listing，A+ 模块需要独立增加模块节奏、横幅比例、文字安全区和模块组合规则。
- `generate_excel.py` 更适合作为交付参考，不能作为核心数据模型。Web 产品需要以 JSON/数据库为主，Excel/ZIP 只是导出格式。
- 仓库的 GitHub 元数据没有识别到明确许可证。当前阶段应只借鉴方法和结构，不直接复制代码；如果后续复制代码，先获得作者授权。

#### 应避免

- 把 A+ 套图简单理解成“多个 Prompt 并发调用”。
- 每张图都套相同的标题、卡片和标签。
- 只把产品参数改写成大字，而没有画面证据。
- 为了完整覆盖字段而生成重复图片。
- 让图片模型直接承担复杂中文/英文排版，导致最终文字乱码。

### 2.2 `sellerpilot-product-image-industrial` 值得借鉴的部分

参考文件：

- `sellerpilot-product-image-industrial/AGENTS.md`
- `sellerpilot-product-image-industrial/docs/architecture.md`
- `sellerpilot-product-image-industrial/docs/data-contracts.md`
- `sellerpilot-product-image-industrial/workflows/ecommerce-product-image-generation.yaml`
- `sellerpilot-product-image-industrial/contracts/production-contract.json`
- `sellerpilot-product-image-industrial/templates/*.yaml`
- `sellerpilot-product-image-industrial/skills/**/prompt.md`

#### 可直接借鉴

- 分层架构：基础设施、商品事实、商业视觉、生成控制、审核交付分开。
- `Product Fact Sheet` 商品事实表。
- `Product Identity Lock` 商品身份锁。
- `Physical Truth Lock` 商品物理真实性锁。
- `Image Set Blueprint` 套图蓝图。
- `Prompt Layer Stack` Prompt 分层栈。
- `Run ID`、任务清单、进度文件、生成清单和交付清单。
- Anchor-first：先生成 1～3 张锚点图，通过审核后再生成剩余图片。
- 有边界的并发：锚点通过后，再并发独立模块，避免方向错误时整套浪费额度。
- 重试必须有证据变化，不能用同一个 Prompt 无限重试。
- QA 失败要路由回最早责任节点，只修复受影响的模块。
- 平台规则以 Profile/Overlay 方式叠加，不要为每个平台复制整条流程。
- 店铺风格记忆与平台偏好记忆独立于商品事实，避免风格记忆覆盖真实产品信息。
- 通过 Lineage 记录图片由什么源图、什么 Prompt、什么模型、什么版本生成。
- 多图交付时生成总览图，但总览图不能替代每张独立成品的审核。

#### 需要改造

- SellerPilot 的控制面比较重，包含较多 Codex、Canvas、Provider 和审计机制。`open-prompts` 的 MVP 不应整体搬迁。
- 参考仓库的 `run-state`、DAG 和 telemetry 需要压缩成当前项目能维护的最小状态模型。
- tldraw 画布可以作为后续人工批注能力，不应阻塞第一版 A+ 生成。
- 研究、竞品抓取、季节/地区规划都应设置触发条件，不能每次任务都执行。
- Provider 适配层必须支持参考图；当前 `open-prompts` 的 Provider 只接受文本 Prompt，需要先扩展接口。

#### 应避免

- 把整个 SellerPilot 仓库直接嵌入 Next.js 应用。
- 把所有中间报告都暴露给普通用户。
- 把最终交付 Gate 当成失败原因；Gate 只能汇总，不能负责生成。
- 没有新的事实变化就重复调用同一个图片模型。
- 用本地确定性拼图冒充真实 AI 场景图。

---

## 3. 产品边界

### 3.1 第一版要解决的问题

用户上传一张商品图，填写或确认少量信息后，系统自动输出：

- 一套有顺序、有故事、有商业目的的 A+ 图片。
- 每张图的标题、卖点、视觉证明和生成状态。
- 商品主体在多张图片中保持一致。
- 图片中文字可读，且只使用已确认的商品事实。
- 失败时可以只重做一张，而不是整套重跑。
- 最终可下载独立图片和完整 ZIP 包。

### 3.2 第一版明确不做

- 不自动发布到 Amazon、Temu、Shopify 或其他平台。
- 不保证 CTR、CVR、ROAS、销量或排名。
- 不自动编造认证、承重、防水、防火、医疗、儿童安全等高风险卖点。
- 不默认抓取竞品，也不在没有用户授权时上传竞品图片到图片生成 Provider。
- 不第一版支持几十个平台的所有规格。
- 不第一版做复杂视频生成。
- 不第一版做全自动品牌资产管理和多人协作。
- 不第一版强制接入 Canvas/tldraw。

---

## 4. 核心设计原则

### 4.1 商品事实优先于文案创意

任何进入图片的文字或视觉动作，都必须能追溯到：

- 用户输入。
- 上传图片中可确认的事实。
- 用户确认的补充信息。
- 平台规则或品牌资料。

不确定的信息必须单独标记，不能在最终图片里以确定语气呈现。

### 4.2 一张图只回答一个主要购买问题

每个模块都必须回答：

- 买家在这一阶段担心什么？
- 这张图让买家相信什么？
- 哪个视觉证据支持这个结论？
- 如果删掉这张图，整套 A+ 会缺少哪一项信息？

无法回答这些问题的图片应被合并、降级或跳过。

### 4.3 Claim + Proof + Mechanism

卖点不要直接平铺到图片上，而应组织成：

- `Claim`：买家能理解的结果或价值。
- `Proof`：支持这个结果的材质、结构、尺寸或实际表现。
- `Mechanism`：产品通过什么结构或操作实现这个结果。

例如：

- Claim：稳固支撑，减少使用时晃动。
- Proof：加宽底座、防滑脚垫、已确认的结构材质。
- Mechanism：底部接触面更大，受力点更稳定。

如果只有参数，没有真实证据，就不能把参数写成夸张的广告结论。

### 4.4 生成和排版分离

建议把最终图片拆成两层：

1. AI 生成层：商品、人物、背景、光影、场景和真实使用动作。
2. 确定性排版层：标题、尺寸线、图标、数字、模块边界和语言文本。

这样可以显著降低商品变形、数字错误、中文乱码和版式不可控的问题。

### 4.5 风格统一，但模块不能同质化

同一套图应统一：

- 产品身份。
- 品牌主色。
- 字体和间距规则。
- 摄影质感。
- 场景的现实程度。

但不同模块需要有不同的视觉角色：

- 主视觉强调定位。
- 痛点图强调情境和结果。
- 结构图强调清晰和可信。
- 场景图强调尺度和使用方式。
- 规格图强调准确和快速阅读。

---

## 5. 用户端输入设计

### 5.1 必填输入

第一版只要求：

- 商品原图，至少 1 张。
- 商品名称或商品类别。
- 目标平台，默认 Amazon US 或通用电商。
- 目标语言，默认中文或英文。

### 5.2 推荐输入

- 3～7 个商品卖点。
- 尺寸、重量、材质、容量、兼容范围。
- 包装清单。
- 使用场景。
- 目标人群。
- 品牌名称、Logo、品牌色。
- 风格偏好，例如专业、家庭、户外、轻奢、极简。
- 禁止表达，例如不能写“防水”、不能出现人物、不能出现竞品。

### 5.3 产品前台的最小追问

系统不应把所有缺失字段一次性抛给用户。最多询问 1～3 个高价值问题：

1. 影响图片真实性的问题，例如尺寸、材质、容量、使用状态。
2. 影响平台输出的问题，例如目标平台和语言。
3. 影响视觉方向的问题，例如家庭场景还是专业摄影棚。

低风险缺口可以记录为假设，但必须在内部状态中标记，不得伪装成已确认事实。

### 5.4 前台输入组件建议

建议把输入页分为四步：

1. 上传商品图。
2. 确认 AI 识别到的商品信息。
3. 选择目标平台、语言和风格。
4. 查看系统生成的 A+ 结构并开始生产。

不要让用户一开始就面对几十个 Prompt 字段。复杂字段应在“高级设置”中展开。

---

## 6. 领域数据模型

### 6.1 Product Fact Sheet

这是所有后续步骤的事实来源。

```yaml
schema_version: ecommerce.product_fact_sheet.v1
product_name:
category:
source_images:
  - asset_id:
    role: primary|detail|packaging|reference
    uri:
    checksum:
confirmed_visual_traits: []
confirmed_features: []
confirmed_materials: []
confirmed_dimensions: []
confirmed_colors: []
package_contents: []
use_cases: []
target_users: []
certifications: []
visible_text: []
uncertain_facts: []
prohibited_claims: []
evidence_refs: []
```

字段规则：

- `confirmed_*` 只能写已经确认的内容。
- `uncertain_facts` 不能进入最终图片文案，除非用户确认。
- `prohibited_claims` 用于生成 Negative QA 和文案拦截。
- `evidence_refs` 记录事实来自哪张图、哪段用户输入或哪条确认记录。

### 6.2 Product Identity Lock

身份锁不是一句“保持产品一致”，而是明确列出不可改变的部分。

```yaml
schema_version: ecommerce.product_identity_lock.v1
product_asset_id:
must_preserve:
  - silhouette
  - proportions
  - color_palette
  - material_surface
  - components
  - hardware
  - handles_or_straps
  - openings_and_closures
  - logos_and_visible_markings
  - texture_and_stitching
  - included_items
allowed_changes:
  - background
  - lighting
  - camera_angle
  - crop
  - scene_props
  - model_context
forbidden_changes:
  - redesign_product_shape
  - invent_accessories
  - invent_function
  - alter_dimensions
  - alter_logo_position
  - alter_package_contents
identity_check:
  compare_against:
    - source_image
    - confirmed_fact_sheet
  reject_if:
    - major_silhouette_drift
    - color_or_material_drift
    - missing_or_extra_component
    - incorrect_product_state
```

### 6.3 Buyer Concern Map

该模型把商品信息转换成购买决策问题。

```yaml
buyer_concern_map:
  - concern_id:
    concern: fit|quality|stability|function|comfort|safety|setup|maintenance|value
    buyer_question:
    evidence_available: []
    evidence_missing: []
    priority: high|medium|low
    recommended_module:
    risk_level: low|medium|high
```

典型问题：

- 能不能放进我的空间？
- 产品尺寸和我的使用环境是否匹配？
- 材质和结构是否可信？
- 实际如何使用？
- 能否调节或适配不同人群？
- 包装里有什么？是否需要安装？
- 细节、接口、开合方式是否符合预期？

### 6.4 A+ Set Blueprint

套图蓝图是生成前的核心产物。

```yaml
schema_version: ecommerce.a_plus_set_blueprint.v1
run_id:
platform:
locale:
product_fact_sheet_ref:
identity_lock_ref:
style_profile_ref:
modules:
  - module_id: AD-01
    role: brand_hero
    buyer_question:
    main_message:
    supporting_message:
    claim_refs: []
    visual_proof:
    scene_direction:
    product_view:
    layout_intent:
    text_hierarchy:
    safe_zones: []
    required_copy: []
    forbidden_elements: []
    qa_acceptance_criteria: []
    rerun_scope:
set_rules:
  identity_consistency:
  style_consistency:
  role_variation:
  max_text_density:
  mobile_readability:
  export_profile:
```

### 6.5 Prompt Layer Stack

每张图都使用分层 Prompt，而不是一条不可维护的长字符串。

```yaml
prompt_layer_stack:
  execution_contract:
    provider:
    output_size:
    output_format:
    module_id:
  product_identity:
    source_image_refs: []
    must_preserve: []
    forbidden_changes: []
  fact_boundary:
    supported_claims: []
    uncertain_facts: []
    prohibited_claims: []
  commerce_goal:
    buyer_question:
    image_job:
    success_criteria: []
  context:
    platform:
    locale:
    category:
    audience:
  creative_concept:
    visual_concept:
    mood:
    color_system: []
  photography_treatment:
    camera_angle:
    crop:
    lighting:
    scene:
    props: []
    product_placement:
  layout_copy:
    text_policy: no_text|short_caption|deterministic_overlay
    text_zone:
    hierarchy:
    copy_items: []
  negative_qa:
    negative_prompt: []
    expected_checks: []
    retry_scope:
```

### 6.6 Generation Job

每个模块都是一个独立可追踪任务。

```yaml
generation_job:
  job_id:
  run_id:
  module_id:
  status: planned|queued|running|succeeded|qa_failed|blocked|approved|exported
  provider:
  model:
  source_asset_refs: []
  prompt_hash:
  identity_lock_hash:
  attempt:
  max_attempts: 2
  depends_on: []
  output_asset_ids: []
  qa_report_id:
  failure_reason:
  retry_evidence_delta:
  created_at:
  updated_at:
```

---

## 7. A+ 模块规划逻辑

### 7.1 模块数量规则

建议使用动态模块选择：

- 基础套图：5 张。
- 商品有尺寸/适配问题：加入 `AD-06`。
- 商品有安装、包装或复杂使用步骤：加入 `AD-07`。
- 商品事实不足时，不生成对应模块，改为提示用户补充信息。
- 如果两个模块回答同一个问题，合并成一张。

### 7.2 `AD-01` 品牌主视觉与产品定位

**商业任务**

让用户在第一眼知道这是一个什么产品、适合什么场景、主价值是什么。

**主要买家问题**

- 这是什么？
- 它适合我吗？
- 它和普通产品的核心区别是什么？

**视觉构成**

- 商品完整、清晰、无遮挡。
- 适度品牌色或品牌视觉元素。
- 简洁背景或高可信场景。
- 不要放过多卖点标签。

**文案策略**

- 一个核心价值短句。
- 可选一句类别说明。
- 不使用没有事实依据的“顶级”“第一”“革命性”等词。

**审核条件**

- 商品外观完整。
- 品牌 Logo/文字没有被模型重绘。
- 商品是画面主角。
- 缩略图状态下仍能看清商品类别。

### 7.3 `AD-02` 用户痛点与解决方案

**商业任务**

把用户原本的使用问题转化为可理解的产品解决方案。

**主要买家问题**

- 购买前的主要烦恼是什么？
- 产品如何改善使用过程？

**视觉构成**

- 可以使用轻量 before/after、问题场景/解决场景或使用前后对照。
- 痛点必须是该类目真实存在的问题。
- 不要制造过度夸张、危险或医疗化的痛点。

**文案策略**

- 痛点短句 + 产品解决方式。
- 避免只写“更好”“更方便”，要说明改善对象。

**审核条件**

- 痛点与产品功能有真实关联。
- 解决状态没有改变商品结构。
- 没有承诺用户无法验证的结果。

### 7.4 `AD-03` 核心卖点与视觉证明

**商业任务**

把一个最重要的卖点讲清楚，并给出看得见的证明。

**主要买家问题**

- 为什么这个产品值得购买？
- 核心卖点如何被证明？

**规划公式**

```text
Claim + Proof + Mechanism
```

**示例**

- Claim：更稳固的日常支撑。
- Proof：已确认的底座、材质、结构或受力点。
- Mechanism：产品通过接触面、锁定件或结构设计实现稳定。

**视觉构成**

- 产品局部特写。
- 结构示意或受力位置。
- 简短数据标注。
- 必要时使用连接线、放大圈或局部 inset。

**审核条件**

- 所有数字来自确认事实。
- 视觉证明指向产品真实部件。
- 文字没有把“材料参数”夸大成“绝对性能”。

### 7.5 `AD-04` 产品结构、材质或关键细节

**商业任务**

降低用户对做工、材质、接口和结构细节的疑虑。

**主要买家问题**

- 这个产品具体哪里好？
- 细节是否真实？
- 使用过程中最关键的部位是什么？

**视觉构成**

- 真实局部放大。
- 结构连接关系。
- 材质纹理或表面细节。
- 适量标注，不做 2x2 机械卡片墙。

**文案策略**

- 使用具体名词，不使用空泛广告语。
- 只有证据充足时才写材质、厚度、防滑、耐磨等结论。

**审核条件**

- 局部特写能在源图中找到对应部件。
- 不出现新增按钮、孔位、接口、缝线、纹理或配件。
- 材质颜色和纹理没有被重绘。

### 7.6 `AD-05` 使用场景与适用人群

**商业任务**

让用户想象产品如何进入自己的生活或工作环境。

**主要买家问题**

- 我会在什么地方使用？
- 产品在真实环境中多大？
- 适合什么人或什么场景？

**视觉构成**

- 真实环境，而不是纯幻想场景。
- 人物只用于证明尺度、动作或使用方式。
- 人物不遮挡产品关键结构。
- 一个场景只表达一个主要动作。

**文案策略**

- 可不加大标题。
- 只保留能提升尺度、场景或适用性的短标签。

**审核条件**

- 人物接触点正确。
- 产品比例和人体比例可信。
- 场景道具不喧宾夺主。
- 没有生造产品的功能或使用方式。

### 7.7 `AD-06` 尺寸、规格与适配

**触发条件**

当用户购买前最关心占地、身高、容量、接口、兼容设备或安装空间时启用。

**视觉构成**

- 商品完整视图。
- 清晰的尺寸线、箭头和单位。
- 房间、人体、容器或设备作为尺度参照。
- 白底、浅灰或低干扰背景优先。

**文案策略**

- 大数字优先。
- 单位统一。
- 不把不确定尺寸写进图中。

**审核条件**

- 数值与输入事实一致。
- 长宽高方向正确。
- 尺寸线不遮挡产品关键部件。
- 移动端缩略图仍能辨认主要数值。

### 7.8 `AD-07` 包装、安装、使用步骤或 FAQ

**触发条件**

当商品需要组装、配件较多、使用顺序重要或退货风险来自预期不一致时启用。

**视觉构成**

- 包装全家福。
- 1～4 步安装或使用步骤。
- 以真实配件和操作为准。
- FAQ 只保留高频且事实明确的问题。

**审核条件**

- 包装内容没有多出或缺少物件。
- 步骤顺序正确。
- 手部、接口、扣件和方向正确。
- 没有把“建议”“可选”写成“包装包含”。

---

## 8. 套图编排算法

### 8.1 规划阶段

```text
输入商品图和卖点
  -> 商品事实抽取
  -> 商品身份锁
  -> 买家疑虑地图
  -> Claim/Proof/Mechanism 归类
  -> 候选 A+ 模块
  -> 去重与合并
  -> 生成 A+ Blueprint
  -> 用户确认或系统自动选择
```

### 8.2 模块选择规则

伪代码如下：

```text
selectModules(factSheet, concernMap, platform):
  modules = [AD-01, AD-02, AD-03, AD-04, AD-05]

  if concernMap.contains(high, fit) and factSheet.hasConfirmedDimensions:
    modules.append(AD-06)

  if concernMap.contains(high, setup) and factSheet.hasPackageOrSteps:
    modules.append(AD-07)

  modules = mergeModulesWithSameBuyerQuestion(modules)
  modules = removeModulesWithoutEvidence(modules)
  modules = enforceRoleVariation(modules)

  return modules
```

### 8.3 先锚点，后全套

建议第一版生成顺序：

1. `AD-01` 作为身份和品牌锚点。
2. 从 `AD-03`、`AD-05`、`AD-06` 中选择一个风险最高的模块作为第二张锚点。
3. 两张锚点完成身份、比例、风格和文字测试。
4. 锚点通过后再生成其他模块。
5. 剩余模块最多并发 2 个。

锚点不通过时：

- 不继续生成整套。
- 先判断是身份问题、场景问题、版式问题还是文案问题。
- 只修复锚点相关 Prompt 层。

### 8.4 套图去重规则

相邻模块不能同时满足以下条件：

- 相同相机角度。
- 相同背景。
- 相同文字位置。
- 相同标题句式。
- 相同产品裁切。
- 相同人物动作。

每个模块至少要有一个明确差异：

- 视觉角色不同。
- 买家问题不同。
- 证明方式不同。
- 场景或裁切不同。
- 文案层级不同。

---

## 9. Prompt 生成逻辑

### 9.1 不允许直接把所有字段拼成一段话

Prompt 生成器需要按照固定层级编译：

```text
execution contract
  + product identity
  + fact boundary
  + commerce goal
  + platform context
  + creative concept
  + photography treatment
  + layout and copy policy
  + negative QA
```

每一层都可以独立审查、缓存和重试。

### 9.2 每层职责

#### Execution Contract

定义：

- 模块 ID。
- 输出文件名。
- 宽高和格式。
- 目标 Provider。
- 是否需要参考图。
- 是否允许文本生成。

#### Product Identity

定义：

- 使用哪一张源图。
- 必须保持哪些结构。
- 允许改变哪些环境元素。
- 禁止出现哪些新增物件。

#### Fact Boundary

定义：

- 允许使用的事实。
- 不确定事实。
- 禁止声称的性能。
- 必须让用户确认的字段。

#### Commerce Goal

定义：

- 买家问题。
- 当前模块的商业任务。
- 成功条件。
- 失败条件。

#### Photography Treatment

定义：

- 相机角度。
- 镜头感。
- 裁切。
- 光线方向。
- 色温。
- 场景。
- 产品摆放。
- 人物或道具。

#### Layout and Copy

定义：

- 文案是否由确定性合成器叠加。
- 文案安全区。
- 标题、数字、说明的层级。
- 文字背景和对比度。
- 不遮挡产品的区域。

#### Negative QA

定义：

- 不得改变产品颜色、轮廓、配件和结构。
- 不得生成竞品 Logo、品牌和水印。
- 不得生成没有证据的数字和性能。
- 不得出现错误人物动作和物理关系。
- 不得出现乱码和内部审核术语。

### 9.3 Prompt 缓存与重试

同一个模块只有在以下内容发生变化时才允许重试：

- 商品事实被用户确认或修正。
- 源图换成了更好的参考图。
- 版式安全区被调整。
- 场景方向被调整。
- 失败的 QA 层被修正。
- Provider、模型或输出规格发生变化。

仅仅因为图片“不够喜欢”而重复提交同一个 Prompt，不应消耗自动重试额度。

---

## 10. 生成、QA 和修订流程

### 10.1 任务状态机

```text
DRAFT
  -> NORMALIZED
  -> FACTS_READY
  -> BLUEPRINT_READY
  -> AWAITING_CONFIRMATION
  -> ANCHOR_QUEUED
  -> ANCHOR_RUNNING
  -> ANCHOR_QA
  -> GENERATING_REMAINING
  -> MODULE_QA
  -> REVIEW_READY
  -> REVISION_REQUIRED
  -> FINAL_GATE
  -> EXPORTED
```

异常状态：

- `BLOCKED_MISSING_FACTS`
- `BLOCKED_PROVIDER`
- `BLOCKED_RETRY_BUDGET`
- `PAUSED_FOR_USER_DECISION`
- `FAILED_UPLOAD`
- `FAILED_GENERATION`

### 10.2 QA 检查层

#### 商品身份 QA

检查：

- 轮廓。
- 颜色。
- 材质。
- 比例。
- 零件数量。
- Logo 和可见文字位置。
- 开合、折叠、展开等产品状态。

#### 物理和动作 QA

适用于家具、工具、运动器材、厨房用品、穿戴产品等：

- 人手是否接触正确部件。
- 人体比例是否合理。
- 产品是否支撑在正确位置。
- 安装方向是否正确。
- 是否出现不存在的锁扣、接口、磁吸或支撑结构。

#### 事实和文案 QA

检查：

- 数字、单位、尺寸。
- 材质、容量和兼容范围。
- 禁止承诺。
- 禁止竞品名称。
- 禁止内部词汇，例如“待确认”“QA 失败”“以源图为准”。

#### 文本和版式 QA

检查：

- 拼写和语言。
- 文字是否被裁切。
- 文字是否覆盖产品关键区域。
- 标题层级是否清晰。
- 移动端缩略图是否仍能读懂。
- 中英文或 RTL 语言方向是否正确。

#### 场景 QA

检查：

- 场景是否真实。
- 道具是否符合品类。
- 光影和接触阴影是否可信。
- 人物是否遮挡商品。
- 场景是否能证明该模块的核心卖点。

#### 套图 QA

检查：

- 模块之间是否重复。
- 视觉风格是否一致。
- 商品在不同模块中的外观是否一致。
- 每个模块是否有独立买家问题。
- 是否存在一个模块完全没有必要。

#### 导出 QA

检查：

- 图片数量。
- 文件名。
- 宽高和比例。
- 文件格式。
- 图片是否可下载。
- 任务中的图片是否与其他任务隔离。
- ZIP 是否包含 manifest、图片、文案和 QA 摘要。

### 10.3 修订路由

QA 失败后不要统一整图重生：

- 商品形状错误：只重跑 `product_identity` 层。
- 场景不真实：只重跑 `photography_treatment` 层。
- 文字错位：不重新生成背景，只重新排版。
- 数字错误：回到 `fact_boundary` 和 `copy` 层。
- 风格不统一：回到 `creative_concept` 和 `style_profile` 层。
- 模块重复：回到 `blueprint`，重新分配模块角色。

每次修订都记录：

```yaml
revision:
  revision_id:
  target_module_id:
  target_region:
  issue_type:
  current_problem:
  requested_change:
  keep_unchanged: []
  evidence_delta:
  new_prompt_hash:
  result:
```

---

## 11. `open-prompts` 的现状与接入点

### 11.1 当前已有能力

当前项目已经具备以下可以复用的基础：

- Next.js 15 App Router。
- 生成服务和 Provider Registry。
- 生成任务创建接口。
- 生成状态轮询接口。
- Provider Job ID 编码和解码。
- Provider 能力配置，例如比例、质量和最大数量。
- 内部 Provider 和用户 BYOK Provider 路由。
- 前台生成状态：`idle`、`queued`、`running`、`succeeded`、`failed`。
- 图片代理和下载能力。
- 生成历史和当前图片预览。
- Drizzle/Postgres 数据层。
- Cloudflare/OpenNext 部署结构。

关键文件：

- `open-prompts/src/lib/generation/types.ts`
- `open-prompts/src/lib/generation/generation-create-service.ts`
- `open-prompts/src/lib/generation/generation-poll-service.ts`
- `open-prompts/src/lib/generation/provider-runtime.ts`
- `open-prompts/src/lib/generation/capabilities.ts`
- `open-prompts/src/app/[locale]/api/generations/route.ts`
- `open-prompts/src/app/[locale]/api/generations/[providerJobId]/route.ts`
- `open-prompts/src/app/[locale]/create/use-generation-job.ts`

### 11.2 当前限制

当前图片生成请求的核心类型只有：

- `prompt`
- `negativePrompt`
- `model`
- `aspectRatio`
- `quality`
- `count`

当前 Provider 请求没有标准化的：

- 商品源图。
- 参考图列表。
- 图片资产 ID。
- 商品身份锁。
- A+ 模块角色。
- 任务 ID 和 run ID。
- QA 状态。
- 局部重试范围。

当前生成历史主要存储在浏览器 `localStorage` 中，适合个人生成记录，不适合作为 A+ 生产任务的长期状态和交付记录。

当前前台生成页的主体仍然是 Prompt 编辑器和模型设置，没有商品上传、事实确认、套图蓝图确认和模块级审核流程。

### 11.3 推荐新增的领域目录

建议新增独立领域模块，不要把 A+ 逻辑塞入现有通用 generation service：

```text
open-prompts/src/lib/a-plus/
├── types.ts
├── schemas.ts
├── input-normalizer.ts
├── product-fact-sheet.ts
├── identity-lock.ts
├── buyer-concern-map.ts
├── module-catalog.ts
├── blueprint-planner.ts
├── blueprint-validator.ts
├── prompt-layer-compiler.ts
├── job-planner.ts
├── qa-router.ts
├── revision-planner.ts
├── export-manifest.ts
└── provider-reference-images.ts
```

职责边界：

- `input-normalizer.ts`：把前台输入转成统一任务输入。
- `product-fact-sheet.ts`：管理确认事实、不确定事实和证据。
- `identity-lock.ts`：建立商品不可变约束。
- `buyer-concern-map.ts`：将卖点转成购买问题。
- `module-catalog.ts`：定义 `AD-01` 到 `AD-07` 的模块角色。
- `blueprint-planner.ts`：选择模块、合并卖点、避免重复。
- `prompt-layer-compiler.ts`：按层编译 Provider Prompt。
- `job-planner.ts`：生成锚点任务、剩余任务和依赖关系。
- `qa-router.ts`：按失败类型决定回到哪一层。
- `export-manifest.ts`：输出可下载的最终资产清单。

### 11.4 推荐新增 API

```text
POST /api/a-plus/jobs
创建 A+ 套图任务，接收商品图、卖点、平台、语言和风格。

GET /api/a-plus/jobs/:jobId
读取任务状态、当前阶段和总体进度。

GET /api/a-plus/jobs/:jobId/blueprint
读取 A+ 模块蓝图。

POST /api/a-plus/jobs/:jobId/blueprint/confirm
确认蓝图并启动锚点生成。

POST /api/a-plus/jobs/:jobId/modules/:moduleId/regenerate
只重做指定模块。

POST /api/a-plus/jobs/:jobId/modules/:moduleId/approve
批准单个模块。

GET /api/a-plus/jobs/:jobId/review
读取 QA、失败项和修订建议。

POST /api/a-plus/jobs/:jobId/export
生成 ZIP 和最终 manifest。
```

### 11.5 推荐扩展 Provider 接口

现有通用生成接口可以保留，A+ 领域通过适配层传入参考图和模块上下文：

```typescript
export type ReferenceImageInput = {
  assetId: string;
  uri: string;
  role: 'product-primary' | 'product-detail' | 'packaging';
  checksum: string;
};

export type APlusGenerationParams = {
  prompt: string;
  negativePrompt?: string;
  model?: string;
  aspectRatio?: string;
  quality?: string;
  moduleId: string;
  referenceImages: ReferenceImageInput[];
  identityLockHash: string;
};
```

Provider 层只负责生成，不负责决定 A+ 模块、买家问题和事实真假。

### 11.6 推荐新增数据表

建议至少新增以下表，命名可以遵循当前 `p_` 前缀：

- `p_a_plus_jobs`
  - 任务基本信息、用户、平台、语言、状态、当前阶段。
- `p_a_plus_assets`
  - 源图、生成图、缩略图、checksum、存储地址、来源。
- `p_a_plus_facts`
  - 商品事实、证据引用、确认状态和禁止声明。
- `p_a_plus_modules`
  - 模块 ID、买家问题、Prompt 层、状态、输出资产。
- `p_a_plus_qa_reports`
  - 身份、事实、文字、场景、导出和套图检查结果。
- `p_a_plus_revisions`
  - 修订范围、失败原因、证据变化和结果。
- `p_a_plus_exports`
  - ZIP 地址、manifest、导出时间和文件状态。

不建议把这些状态继续放入浏览器 `localStorage`。浏览器历史可以保留为快捷缓存，但服务器数据库必须是生产任务的权威来源。

---

## 12. 推荐的 MVP 实现顺序

### Phase 1：商品输入和事实确认

目标：用户可以上传一张图并确认商品事实。

实现：

- 商品图上传。
- 图片元信息和 checksum。
- AI 识别商品类别、颜色、材质、可见文字和当前状态。
- 用户确认/修改事实。
- 生成 Product Fact Sheet 和 Identity Lock。

验收：

- 没有事实确认时，不能启动正式生成。
- 能看到哪些信息是确认的、哪些是不确定的。
- 源图不会被覆盖或改写。

### Phase 2：A+ 蓝图规划

目标：先看到系统准备生成哪些图。

实现：

- Buyer Concern Map。
- Claim/Proof/Mechanism 归类。
- `AD-01` 到 `AD-07` 模块选择。
- 模块去重和证据检查。
- 用户可以删除、调整或确认模块。

验收：

- 每个模块都有一个独立买家问题。
- 每个模块都有主要视觉证明。
- 不支持的卖点不会被分配到图片。

### Phase 3：参考图生成和模块任务

目标：让 Provider 真正收到商品参考图。

实现：

- 扩展 Provider Reference Image 接口。
- A+ Prompt Layer Compiler。
- 模块级 Generation Job。
- 锚点生成。
- 状态轮询和实时进度。

验收：

- 每个生成任务能追溯到源图和 identity lock。
- 锚点未通过时，不自动生成整套。
- Provider 失败不会让整个任务丢失。

### Phase 4：确定性排版和 QA

目标：提高 A+ 商业交付质量。

实现：

- 图片背景生成和文字排版分离。
- 标题、尺寸线、标签、图标使用 SVG/Canvas/Sharp 等确定性方式生成。
- 身份、文字、事实、场景和套图 QA。
- 只重做失败模块。

验收：

- 数字和文字不会依赖图片模型生成。
- 文字布局失败可以不重跑背景。
- QA 能指出具体失败原因和修复范围。

### Phase 5：导出和历史任务

目标：用户可以下载、复用和修改一套 A+ 套图。

实现：

- 任务详情页。
- 模块审核和单张重做。
- ZIP 导出。
- manifest、事实摘要、图片和 QA 摘要。
- 服务端任务历史。

验收：

- 下载包中的图片、文件名、顺序和 manifest 一致。
- 同一用户可以回到旧任务继续修订。
- 不同任务的图片不会串联。

---

## 13. 推荐的用户体验

### 13.1 任务进度不是单一百分比

不要只显示“正在生成 42%”。建议显示阶段：

1. 正在读取商品图。
2. 正在确认商品事实。
3. 正在规划 A+ 模块。
4. 正在生成风格锚点。
5. 正在生成剩余模块。
6. 正在检查商品一致性和文字。
7. 已完成，可下载。

### 13.2 蓝图确认页

蓝图确认页应展示每个模块的：

- 模块名称。
- 买家问题。
- 主要卖点。
- 视觉证明。
- 是否使用人物/场景。
- 是否包含文字。
- 预计图片比例。
- 风险提示。

用户可以：

- 删除模块。
- 修改模块目标。
- 替换场景。
- 补充事实。
- 直接确认生成。

### 13.3 审核页

每张成品图旁边显示：

- 商品一致性：通过/需修改。
- 事实准确性：通过/需确认。
- 文案可读性：通过/需修改。
- 场景真实性：通过/需修改。
- 与上一张的差异：通过/重复。

用户只需要点击“重做本张”，不需要重新填写整个 Prompt。

---

## 14. 平台适配逻辑

平台差异应该通过配置 Overlay 处理，不应复制整套生成流程。

```yaml
platform_profile:
  platform: amazon-us
  locale: en-US
  main_image:
    required: true
    background: pure-white
  a_plus:
    enabled: true
    default_module_count: 5
    supported_ratios: []
    max_text_density: medium
    mobile_thumbnail_rule: product_and_claim_visible
  export:
    image_format: png|jpg
    filename_pattern: '{module_id}-{slug}.{ext}'
    include_manifest: true
```

第一版建议只支持：

- Amazon US。
- 中文电商通用版。
- 一个通用场景/信息图比例策略。

后续再加入 Temu、TikTok Shop、Shopee、Ozon 等平台的 Profile。

平台 Overlay 不能覆盖：

- 商品身份锁。
- 用户明确要求。
- 已确认商品事实。
- 禁止声明。

---

## 15. 质量与安全边界

### 15.1 源图和参考图

- 商品源图必须和生成任务绑定。
- 竞品图只能用于研究和策略提取。
- 未确认归属的图片不能作为商品身份参考发送给 Provider。
- 超过 Provider 限制时必须显式提示，不能静默删除或压缩到不可识别。
- 图片资产需要记录 checksum 和来源。

### 15.2 用户密钥

当前 `open-prompts` 支持部分 BYOK Provider。A+ 任务引入上传图片后，需要额外注意：

- API Key 不能写入任务记录、日志或导出包。
- Provider 请求日志只能记录模型、任务 ID、状态和耗时。
- 源图外发必须通过用户已选择的 Provider 路由。
- 前台不能把完整 Provider 原始错误直接显示给用户。

### 15.3 商业声明

系统需要拦截或要求确认：

- 绝对化词汇。
- 第一、最好、销量第一等排名词。
- 医疗、健康和安全保证。
- 防水、防火、防摔、承重等没有证据的性能词。
- 认证、检测、材质等级和兼容范围。
- 包装中未确认存在的配件。

---

## 16. 不建议直接搬迁的内容

### `amazon-listing-generator-skill`

不建议直接搬迁：

- 依赖聊天上下文的命令识别。
- 所有长篇 Skill 文本作为运行时逻辑。
- 直接将 Excel 作为主数据源。
- 竞品扫描和图片生成耦合在一个对话步骤中。

适合抽取：

- 槽位命名。
- 买家疑虑地图。
- Claim/Proof/Mechanism 归类。
- A+ 模块角色。
- 单模块重做语义。
- 版式决策和图片去重规则。

### `sellerpilot-product-image-industrial`

不建议直接搬迁：

- 全部 scripts 和完整运行控制面。
- 全量 tldraw 工作台。
- 所有 Provider profile 和第三方代理配置。
- 工业审计模式的全部产物。
- 每次任务都执行的完整市场研究。

适合抽取：

- Product Fact Sheet。
- Identity Lock。
- Physical Truth Lock。
- Image Set Blueprint。
- Prompt Layer Stack。
- Anchor-first。
- QA 路由和局部修订。
- Lineage、manifest 和 run-local 状态。

---

## 17. 推荐的 Definition of Done

一套 A+ 任务只有在以下条件全部满足时才算完成：

### 事实和身份

- 商品图来源明确。
- 商品事实已确认或明确标记不确定。
- 每张图都有身份锁引用。
- 没有新增商品组件或改变产品比例。

### 商业逻辑

- 每张图对应一个买家问题。
- 每个主要 Claim 都有视觉 Proof 或明确事实依据。
- 模块之间没有明显重复。
- 模块顺序符合从认知到信任、从场景到规格的购买路径。

### 生成和审核

- 锚点图已经通过审核。
- 所有失败模块都有具体失败原因。
- 重试包含证据变化。
- 文字、数字和单位经过最终检查。
- 真实场景和人物动作经过检查。

### 交付

- 图片数量和文件名正确。
- 图片比例和分辨率符合目标平台。
- ZIP 中包含图片、manifest、事实摘要、Prompt 版本和 QA 摘要。
- 没有 API Key、内部路径和内部诊断泄漏到交付包。
- 用户可以单独重做某一模块。

---

## 18. 最终推荐架构

```text
A+ 前台
  -> 商品图上传
  -> 商品事实确认
  -> 风格/平台/语言设置
  -> A+ Blueprint 预览
  -> 用户确认

A+ 领域服务
  -> Fact Sheet
  -> Identity Lock
  -> Buyer Concern Map
  -> Module Planner
  -> Prompt Layer Compiler
  -> Job Planner

生成控制层
  -> Anchor Generation
  -> Anchor QA
  -> Bounded Parallel Generation
  -> Module QA
  -> Revision Router

交付层
  -> Deterministic Layout Composer
  -> Final Delivery Gate
  -> Manifest
  -> ZIP Export
  -> Task History

通用图片 Provider 层
  -> reference image input
  -> prompt
  -> model
  -> async job
  -> polling
  -> output URLs
```

核心决策是：

> `open-prompts` 保留现有通用图片生成能力，在其上新增独立的 `a-plus` 领域层；不要把 A+ 逻辑散落到现有 Prompt 编辑器、Provider 实现和通用生成接口中。

这样可以同时获得：

- `amazon-listing-generator-skill` 的商业图片规划能力。
- `sellerpilot-product-image-industrial` 的商品真实性、任务编排和 QA 能力。
- `open-prompts` 已有的 Next.js 前台、Provider、轮询、下载和用户体系。

---

## 19. 参考文件索引

### Amazon Listing Skill

- `amazon-listing-generator-skill/SKILL.md`
- `amazon-listing-generator-skill/references/amazon-image-strategy.md`
- `amazon-listing-generator-skill/scripts/generate_excel.py`

### SellerPilot

- `sellerpilot-product-image-industrial/AGENTS.md`
- `sellerpilot-product-image-industrial/docs/architecture.md`
- `sellerpilot-product-image-industrial/docs/data-contracts.md`
- `sellerpilot-product-image-industrial/workflows/ecommerce-product-image-generation.yaml`
- `sellerpilot-product-image-industrial/contracts/production-contract.json`
- `sellerpilot-product-image-industrial/templates/product-fact-sheet-template.yaml`
- `sellerpilot-product-image-industrial/templates/image-set-blueprint-template.yaml`
- `sellerpilot-product-image-industrial/templates/prompt-layer-stack-template.yaml`
- `sellerpilot-product-image-industrial/templates/quality-production-blueprint-template.yaml`
- `sellerpilot-product-image-industrial/skills/commerce-visual/visual-strategy/prompt.md`
- `sellerpilot-product-image-industrial/skills/commerce-visual/visual-director/prompt.md`
- `sellerpilot-product-image-industrial/skills/commerce-visual/image-generation/prompt.md`
- `sellerpilot-product-image-industrial/skills/commerce-visual/qa-compliance/prompt.md`

### 当前 `open-prompts`

- `open-prompts/src/lib/generation/types.ts`
- `open-prompts/src/lib/generation/generation-create-service.ts`
- `open-prompts/src/lib/generation/generation-poll-service.ts`
- `open-prompts/src/lib/generation/provider-runtime.ts`
- `open-prompts/src/lib/generation/capabilities.ts`
- `open-prompts/src/app/[locale]/api/generations/route.ts`
- `open-prompts/src/app/[locale]/api/generations/[providerJobId]/route.ts`
- `open-prompts/src/app/[locale]/create/use-generation-job.ts`
- `open-prompts/src/db/schema.ts`

---

## 20. 下一步建议

下一步不要先写图片 Prompt。建议按下面顺序执行：

1. 先确定第一版支持的平台、语言和默认模块数量。
2. 先新增 A+ 领域类型和模块目录。
3. 再做商品图上传与 Product Fact Sheet 确认页。
4. 再做 Blueprint 预览和确认页。
5. 再扩展 Provider 参考图接口。
6. 最后接入锚点生成、QA 和单模块重做。

推荐的第一个真实 MVP 请求：

> 上传 1 张商品图，选择 Amazon US，输入 3 个卖点，生成 5 张 A+ 模块图；先生成 `AD-01` 和 `AD-03` 两张锚点，确认后生成剩余模块，并支持单独重做任意一张。