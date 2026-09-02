export const CANVAS_SLICE_COUNTS = [1, 2, 3, 4, 5] as const;

export type CanvasSliceResult = {
  index: number;
  total: number;
  width: number;
  height: number;
  imageUrl: string;
};

export async function sliceImageIntoEqualParts(
  sourceUrl: string,
  count: number,
): Promise<CanvasSliceResult[]> {
  if (!sourceUrl) throw new Error('Missing canvas image.');
  if (!Number.isInteger(count) || count < CANVAS_SLICE_COUNTS[0] || count > CANVAS_SLICE_COUNTS[CANVAS_SLICE_COUNTS.length - 1]) {
    throw new Error('Choose between 1 and 5 slices.');
  }

  const image = await loadImage(sourceUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error('The canvas image has no usable dimensions.');

  return Array.from({ length: count }, (_, index) => {
    const top = Math.floor((height * index) / count);
    const bottom = Math.floor((height * (index + 1)) / count);
    const sliceHeight = Math.max(1, bottom - top);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = sliceHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The browser cannot create a canvas context.');

    context.drawImage(image, 0, top, width, sliceHeight, 0, 0, width, sliceHeight);
    return {
      index: index + 1,
      total: count,
      width,
      height: sliceHeight,
      imageUrl: canvas.toDataURL('image/png'),
    };
  });
}

function loadImage(sourceUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The generated canvas image could not be loaded for slicing.'));
    image.src = sourceUrl;
  });
}