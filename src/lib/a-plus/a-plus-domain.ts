export const A_PLUS_MODULE_IDS = ['AD-01', 'AD-02', 'AD-03', 'AD-04', 'AD-05'] as const;

export type APlusModuleId = (typeof A_PLUS_MODULE_IDS)[number];
export type APlusModuleStatus = 'planned' | 'queued' | 'running' | 'succeeded' | 'failed';
export type APlusRunStatus = 'idle' | 'running' | 'succeeded' | 'failed';

export type APlusInput = {
  productName: string;
  category: string;
  sellingPoints: string[];
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

export function isAPlusInputValid(input: APlusInput): boolean {
  return Boolean(
    input.productName.trim() &&
      input.category.trim() &&
      input.sellingPoints.length > 0 &&
      input.sourceImageName &&
      input.sourceImage,
  );
}