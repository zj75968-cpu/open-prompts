import type { XSourceDuplicate } from '~/lib/x-import/x-source-duplicate';

export type XImportRequestDto = {
  url: string;
};

export type XImportSuccessResponseDto = {
  ok: true;
  title: string;
  description: string;
  prompt: string;
  imageUrls: string[];
  sourceUrl: string;
  authorHandle: string;
};

export type XImportErrorResponseDto = {
  error: string;
  duplicate?: XSourceDuplicate;
};

export type XImportResponseDto =
  | XImportSuccessResponseDto
  | XImportErrorResponseDto;

export type XSourceCheckQueryDto = {
  url: string;
  excludeId?: number;
};

export type XSourceCheckResponseDto = {
  duplicate: XSourceDuplicate | null;
  invalid?: true;
};

export type XSourceCheckApiResponseDto =
  | XSourceCheckResponseDto
  | XImportErrorResponseDto;