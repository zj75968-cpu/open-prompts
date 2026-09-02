export const A_PLUS_MODULE_IDS = ['AD-01', 'AD-02', 'AD-03', 'AD-04', 'AD-05'] as const;

export type APlusModuleId = (typeof A_PLUS_MODULE_IDS)[number];
export type APlusModuleStatus = 'planned' | 'queued' | 'running' | 'succeeded' | 'failed';
export type APlusRunStatus = 'idle' | 'running' | 'succeeded' | 'failed';

export type APlusInput = {
  productName: string;
  category: string;
  sellingPoints: string[];
  canvasAspectRatio?: APlusCanvasAspectRatio;
  platform: string;
  language: string;
  style: string;
  sourceImageName: string | null;
  sourceImage: string | null;
};

export type APlusModulePlan = {
  id: APlusModuleId;
  titleKey: string;
  roleKey: string;
  buyerQuestionKey: string;
  visualDirectionKey: string;
  aspectRatio: string;
};

export type APlusModuleResult = APlusModulePlan & {
  status: APlusModuleStatus;
  imageUrl: string | null;
  providerJobId: string | null;
  error: string | null;
  attempt: number;
};

export type APlusGenerationState = {
  runStatus: APlusRunStatus;
  activeModuleId: APlusModuleId | null;
  modules: APlusModuleResult[];
  error: string | null;
};

export type ProductFactSheet = {
  schemaVersion: 'ecommerce.product_fact_sheet.v1';
  productName: string;
  category: string;
  sourceImageName: string | null;
  confirmedFeatures: string[];
  confirmedSellingPoints: string[];
  uncertainFacts: string[];
  prohibitedClaims: string[];
};

export type ProductIdentityLock = {
  schemaVersion: 'ecommerce.product_identity_lock.v1';
  mustPreserve: string[];
  allowedChanges: string[];
  forbiddenChanges: string[];
};

export type BuyerConcern = {
  concernId: string;
  concern: 'fit' | 'quality' | 'function' | 'comfort' | 'setup' | 'value';
  buyerQuestion: string;
  evidenceAvailable: string[];
  recommendedModule: APlusModuleId;
};

export type APlusSetBlueprint = {
  schemaVersion: 'ecommerce.a_plus_set_blueprint.v1';
  platform: string;
  language: string;
  modules: Array<{
    moduleId: APlusModuleId;
    buyerQuestion: string;
    mainMessage: string;
    visualProof: string;
  }>;
};

const A_PLUS_ECOMMERCE_CANVAS_GUIDELINES = [
  'Non-negotiable commerce asset contract:',
  '- The output is an A+ / product-detail-page asset, not generic artwork, concept art, a film still, poster, album cover, editorial fashion photography, cosplay portrait, or cinematic character scene.',
  '- The uploaded image is the authoritative product reference, not a mood board or loose style reference. Copy the product from that image; do not reinterpret the image as permission to invent a different subject.',
  '- Show the referenced product as the primary subject in a commercially useful composition. The product must be easy to identify, inspect, and compare at a glance.',
  '- Keep the product materially present throughout the composition. If a person or use scene is explicitly requested, the person and environment remain secondary and must not replace or obscure the product.',
  '- Use a clean product-commercial background, controlled studio or restrained lifestyle staging, clear product hierarchy, realistic lighting, and intentional negative space. Do not use a narrative environment merely because a style word suggests one.',
  '- Choose one primary commercial presentation: studio hero, restrained lifestyle demonstration, or product-in-use proof. In every case the product occupies the largest visual area and is the first thing a buyer notices.',
  '- For apparel or wearable products, show the exact referenced garment/accessory as the product hero; a model may demonstrate fit only with a neutral commercial pose. Do not turn the result into a fashion editorial or character portrait.',
  '- For non-wearable products, do not replace the product with a person, model, character, prop, or environment. A person may appear only when explicitly requested to demonstrate use and must remain secondary.',
  '- Apply requested artistic style to the background, lighting, palette, props, or restrained scene treatment only; never convert the product asset into an unrelated story image.',
  '- Do not output a full-scene image where the product is incidental, tiny, cropped beyond recognition, redesigned, or substituted by a person wearing/holding a different product.',
  '- Preserve the exact product silhouette, proportions, geometry, color, material, components, logo, packaging, and visible markings from the reference image.',
  '- Do not invent product features, accessories, certifications, specifications, guarantees, rankings, medical claims, or performance numbers.',
  '- Keep the entire vertical canvas visually coherent. Maintain continuous background, lighting, color treatment, and visual flow from top to bottom.',
  '- Keep important product details and user-provided text away from likely equal-height slice boundaries where possible.',
  '- Do not create an artificial segmented layout, panels, section cards, dividers, horizontal rules, or repeated blocks.',
  '- Do not add headings, slogans, labels, marketing copy, watermarks, competitor branding, or extra products unless the user explicitly requests them.',
  'Text rules:',
  '- If the user requests visible text, preserve every character exactly, including spelling, capitalization, punctuation, order, and line breaks.',
  '- Do not translate, rewrite, polish, correct, replace, duplicate, abbreviate, or invent user-provided text.',
  '- If the user does not request visible text, do not render any text.',
] as const;

export const A_PLUS_CANVAS_ASPECT_RATIOS = ['1464:600', '1464:1800', '1464:2400'] as const;
export type APlusCanvasAspectRatio = (typeof A_PLUS_CANVAS_ASPECT_RATIOS)[number];
export const DEFAULT_A_PLUS_CANVAS_ASPECT_RATIO: APlusCanvasAspectRatio = '1464:1800';

export function normalizeCanvasSellingPoints(value: string): string[] {
  return value.trim() ? [value] : [];
}

export type APlusCanvasEditRequest = {
  currentImage: string;
  sourceImage?: string | null;
  editInstruction: string;
  aspectRatio: APlusCanvasAspectRatio;
  preserveIdentity: boolean;
  continuousBackground: boolean;
  deterministicTypography: boolean;
  language: string;
  productName: string;
  category: string;
  sellingPoints: string[];
};

export type APlusCanvasEditResponse = {
  mode: 'edit';
  fallbackUsed: false;
  aspectRatio: APlusCanvasAspectRatio;
  provider: string;
  providerJobId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  imageUrl?: string;
  error?: string;
};

export type APlusCanvasApiResponse = APlusCanvasEditResponse | { error: string; detail?: string };

export function buildProductFactSheet(input: APlusInput): ProductFactSheet {
  return {
    schemaVersion: 'ecommerce.product_fact_sheet.v1',
    productName: input.productName.trim(),
    category: input.category.trim(),
    sourceImageName: input.sourceImageName,
    confirmedFeatures: input.sellingPoints,
    confirmedSellingPoints: input.sellingPoints,
    uncertainFacts: [],
    prohibitedClaims: ['best', 'number one', 'waterproof', 'fireproof', 'medical guarantee', 'unverified certification'],
  };
}

export function buildProductIdentityLock(): ProductIdentityLock {
  return {
    schemaVersion: 'ecommerce.product_identity_lock.v1',
    mustPreserve: ['silhouette', 'proportions', 'color palette', 'material surface', 'components', 'logos and visible markings'],
    allowedChanges: ['background', 'lighting', 'camera angle', 'crop', 'scene props', 'model context'],
    forbiddenChanges: ['redesign product shape', 'invent accessories', 'invent function', 'alter dimensions', 'alter package contents'],
  };
}

export function buildBuyerConcernMap(input: APlusInput): BuyerConcern[] {
  const evidence = input.sellingPoints;
  return [
    { concernId: 'fit', concern: 'fit', buyerQuestion: 'Will this fit my needs and space?', evidenceAvailable: evidence, recommendedModule: 'AD-05' },
    { concernId: 'value', concern: 'value', buyerQuestion: 'What is the main reason to choose it?', evidenceAvailable: evidence, recommendedModule: 'AD-01' },
    { concernId: 'function', concern: 'function', buyerQuestion: 'How does it solve the practical problem?', evidenceAvailable: evidence, recommendedModule: 'AD-02' },
    { concernId: 'quality', concern: 'quality', buyerQuestion: 'What visible evidence supports the quality?', evidenceAvailable: evidence, recommendedModule: 'AD-03' },
    { concernId: 'setup', concern: 'setup', buyerQuestion: 'What details should I inspect before buying?', evidenceAvailable: evidence, recommendedModule: 'AD-04' },
  ];
}

export const A_PLUS_MODULE_PLAN: APlusModulePlan[] = [
  {
    id: 'AD-01',
    titleKey: 'modules.ad01.title',
    roleKey: 'modules.ad01.role',
    buyerQuestionKey: 'modules.ad01.question',
    visualDirectionKey: 'modules.ad01.visual',
    aspectRatio: '2:1',
  },
  {
    id: 'AD-02',
    titleKey: 'modules.ad02.title',
    roleKey: 'modules.ad02.role',
    buyerQuestionKey: 'modules.ad02.question',
    visualDirectionKey: 'modules.ad02.visual',
    aspectRatio: '2:1',
  },
  {
    id: 'AD-03',
    titleKey: 'modules.ad03.title',
    roleKey: 'modules.ad03.role',
    buyerQuestionKey: 'modules.ad03.question',
    visualDirectionKey: 'modules.ad03.visual',
    aspectRatio: '2:1',
  },
  {
    id: 'AD-04',
    titleKey: 'modules.ad04.title',
    roleKey: 'modules.ad04.role',
    buyerQuestionKey: 'modules.ad04.question',
    visualDirectionKey: 'modules.ad04.visual',
    aspectRatio: '2:1',
  },
  {
    id: 'AD-05',
    titleKey: 'modules.ad05.title',
    roleKey: 'modules.ad05.role',
    buyerQuestionKey: 'modules.ad05.question',
    visualDirectionKey: 'modules.ad05.visual',
    aspectRatio: '2:1',
  },
];

export function buildAPlusSetBlueprint(input: APlusInput): APlusSetBlueprint {
  const concerns = buildBuyerConcernMap(input);
  return {
    schemaVersion: 'ecommerce.a_plus_set_blueprint.v1',
    platform: input.platform,
    language: input.language,
    modules: A_PLUS_MODULE_PLAN.map((module) => {
      const concern = concerns.find((item) => item.recommendedModule === module.id);
      return {
        moduleId: module.id,
        buyerQuestion: concern?.buyerQuestion || 'What should the buyer understand here?',
        mainMessage: input.sellingPoints[0] || 'A clear, useful product benefit.',
        visualProof: input.sellingPoints.join('; '),
      };
    }),
  };
}

export function normalizeSellingPoints(value: string): string[] {
  return value
    .split(/[\n,，、]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 7);
}

export function createInitialAPlusModules(): APlusModuleResult[] {
  return A_PLUS_MODULE_PLAN.map((plan) => ({
    ...plan,
    status: 'planned',
    imageUrl: null,
    providerJobId: null,
    error: null,
    attempt: 0,
  }));
}

export function buildAPlusModulePrompt(input: APlusInput, module: APlusModulePlan): string {
  const points = input.sellingPoints.length
    ? input.sellingPoints.join('; ')
    : 'Use only visible, conservative product benefits.';
  const source = input.sourceImageName
    ? `A source product image named ${input.sourceImageName} is available to the workflow; preserve that product identity.`
    : 'Preserve the product identity from the provided product reference.';
  const factSheet = buildProductFactSheet(input);
  const identityLock = buildProductIdentityLock();
  const blueprint = buildAPlusSetBlueprint(input);
  const blueprintModule = blueprint.modules.find((item) => item.moduleId === module.id);
  const briefByModule: Record<APlusModuleId, { role: string; question: string; visual: string }> = {
    'AD-01': {
      role: 'hero visual and product positioning',
      question: 'What is this product and who is it for?',
      visual: 'Show the complete product as the clear hero with restrained brand context.',
    },
    'AD-02': {
      role: 'buyer pain point and solution',
      question: 'What problem does it solve?',
      visual: 'Show a credible use situation and the product improving that situation.',
    },
    'AD-03': {
      role: 'claim, visual proof, and mechanism',
      question: 'Why should I believe the main benefit?',
      visual: 'Use a product detail or mechanism-focused composition as visual proof.',
    },
    'AD-04': {
      role: 'material, structure, and close-up detail',
      question: 'Does the product feel trustworthy?',
      visual: 'Make confirmed physical details easy to inspect without inventing components.',
    },
    'AD-05': {
      role: 'realistic use scene and intended user',
      question: 'How will this fit my life?',
      visual: 'Show realistic context with clear scale and a natural product interaction.',
    },
  };
  const brief = briefByModule[module.id];

  return [
    'E-commerce A+ detail page module image.',
    `Module ${module.id}: ${brief.role}.`,
    `Product: ${input.productName || 'unspecified product'}; category: ${input.category || 'general merchandise'}.`,
    `Platform: ${input.platform}; language: ${input.language}; visual style: ${input.style}.`,
    `Buyer question: ${brief.question}. Visual direction: ${brief.visual}`,
    `Blueprint message: ${blueprintModule?.mainMessage || 'Keep the module focused on one buyer question.'}`,
    `Confirmed fact sheet: ${factSheet.confirmedFeatures.join('; ') || 'none provided'}.`,
    `Identity lock: preserve ${identityLock.mustPreserve.join(', ')}; allowed changes are ${identityLock.allowedChanges.join(', ')}.`,
    `Prohibited claims: ${factSheet.prohibitedClaims.join(', ')}.`,
    `Confirmed selling points only: ${points}.`,
    source,
    'Keep silhouette, proportions, color, materials, components, logo placement, and package contents unchanged.',
    'Do not invent certifications, safety guarantees, medical claims, rankings, performance numbers, accessories, or unsupported specifications.',
    'Create a clean, premium, mobile-readable composition with restrained copy space. Avoid illegible text; the interface may add deterministic copy later.',
    'No competitor branding, no watermark, no extra products, no distorted product, no duplicated components.',
  ].join('\n');
}

export function buildAPlusCanvasUserPrompt(input: APlusInput): string {
  return input.sellingPoints
    .filter((point) => point.trim())
    .join('\n');
}

// Keep the legacy export name for callers outside the current page boundary.
export const buildAPlusCanvasGenerationInstruction = buildAPlusCanvasUserPrompt;

export function buildAPlusCanvasEditPrompt(request: APlusCanvasEditRequest): string {
  const instruction = request.editInstruction;
  const sellingPoints = request.sellingPoints.filter((point) => point.trim());
  const additionalSellingPoints = sellingPoints.filter((point) => point !== instruction);
  const sellingPointsRule = request.sourceImage && additionalSellingPoints.length
    ? [
        'Original user-provided selling points, verbatim:',
        ...additionalSellingPoints,
        'Use these strings as factual input only; do not render them as visible text unless the user prompt explicitly requests those exact strings.',
      ].join('\n')
    : null;
  const identityRule = request.preserveIdentity
    ? 'Preserve the exact product identity from the reference: silhouette, proportions, geometry, color, material, components, logo, packaging, and visible markings.'
    : 'Keep the product recognizable and do not invent unsupported product claims, components, or accessories.';
  const referenceRule = request.sourceImage
    ? 'Input image 1 is the current finished canvas and is the composition to edit. Input image 2 is the original authoritative product reference. Preserve the current canvas outside the requested change, and use the original product reference to prevent product drift.'
    : 'Input image 1 is the sole authoritative product reference, not a finished scene or mood board. Extract and preserve the exact product, then merchandise it in a new commercial product-detail composition. Do not copy a non-product background, character, pose, or story from the reference unless the user explicitly requests it.';
  const backgroundRule = request.continuousBackground
    ? 'Keep the background, lighting, color treatment, and visual direction continuous across the entire canvas.'
    : 'Allow background changes only where the user prompt explicitly requests them.';
  const typographyRule = request.deterministicTypography
    ? 'Preserve user-provided text exactly and do not invent any additional typography.'
    : 'Use text only when explicitly requested by the user prompt.';

  return [
    'Generate or edit one commercial e-commerce A+ product-detail-page image.',
    'The commerce asset contract below is mandatory. The user prompt controls subject, style, scene, layout, and text only within this commercial product-detail purpose.',
    'Merchandise the referenced product as the unmistakable retail subject. Build a product-led sales visual, not an illustration whose product happens to be a prop.',
    'User prompt, verbatim:',
    instruction,
    ...(sellingPointsRule ? [sellingPointsRule] : []),
    ...A_PLUS_ECOMMERCE_CANVAS_GUIDELINES,
    `Canvas ratio: ${request.aspectRatio}. Use the requested vertical composition and preserve one continuous visual flow from top to bottom.`,
    identityRule,
    referenceRule,
    backgroundRule,
    typographyRule,
    'Before rendering, verify all of these are true: the exact reference product is the largest recognizable subject; the composition reads as a product-detail-page asset; any person or scene is secondary; there is no unrelated cinematic/editorial artwork; and no unrequested text is present.',
    'Treat the user prompt as a creative brief, not as permission to remove the product-commercial purpose or replace the product with an unrelated scene.',
    'Return only the generated visual result; do not output an explanation or a rewritten prompt.',
  ].join('\n');
}

export const buildContinuousCanvasPrompt = buildAPlusCanvasEditPrompt;

export function isAPlusCanvasEditRequest(value: unknown): value is APlusCanvasEditRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const request = value as Partial<APlusCanvasEditRequest>;
  return Boolean(
    typeof request.currentImage === 'string' &&
      request.currentImage.trim() &&
      typeof request.editInstruction === 'string' &&
      request.editInstruction.trim() &&
      typeof request.aspectRatio === 'string' &&
      A_PLUS_CANVAS_ASPECT_RATIOS.includes(request.aspectRatio as APlusCanvasAspectRatio) &&
      typeof request.preserveIdentity === 'boolean' &&
      typeof request.continuousBackground === 'boolean' &&
      typeof request.deterministicTypography === 'boolean' &&
      typeof request.language === 'string' &&
      typeof request.productName === 'string' &&
      typeof request.category === 'string' &&
      Array.isArray(request.sellingPoints) &&
      request.sellingPoints.every((point) => typeof point === 'string'),
  );
}

export function isAPlusInputValid(input: APlusInput): boolean {
  return Boolean(
    input.productName.trim() &&
      input.category.trim() &&
      input.sellingPoints.length > 0 &&
      input.sourceImageName &&
      input.sourceImage,
  );
}