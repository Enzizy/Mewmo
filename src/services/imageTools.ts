import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type ImageToolMode = 'convert' | 'compress' | 'resize';
export type ImageFormat = 'JPEG' | 'PNG' | 'WebP';
export type ImageQuality = 'Smaller' | 'Balanced' | 'High';

export type SelectedImage = {
  id: string;
  uri: string;
  name: string;
  size: number | null;
  width: number;
  height: number;
  mimeType: string | null;
};

export type ProcessedImage = SelectedImage & {
  originalId: string;
  originalName: string;
  originalSize: number | null;
  targetReached: boolean | null;
};

export type ImageProcessingSettings = {
  mode: ImageToolMode;
  format: ImageFormat;
  quality: ImageQuality;
  targetBytes: number | null;
  width: number | null;
  height: number | null;
};

const MAX_SELECTION = 10;
const MAX_INPUT_BYTES = 40 * 1024 * 1024;
const MAX_INPUT_PIXELS = 50_000_000;
const QUALITY_VALUES: Record<ImageQuality, number> = { Smaller: 0.45, Balanced: 0.72, High: 0.9 };
const FORMAT_VALUES: Record<ImageFormat, SaveFormat> = { JPEG: SaveFormat.JPEG, PNG: SaveFormat.PNG, WebP: SaveFormat.WEBP };
const MIME_TYPES: Record<ImageFormat, string> = { JPEG: 'image/jpeg', PNG: 'image/png', WebP: 'image/webp' };
const EXTENSIONS: Record<ImageFormat, string> = { JPEG: 'jpg', PNG: 'png', WebP: 'webp' };

async function readFileSize(uri: string): Promise<number | null> {
  try {
    if (Platform.OS === 'web') return (await (await fetch(uri)).blob()).size;
    const { File: ExpoFile } = await import('expo-file-system');
    return new ExpoFile(uri).size;
  } catch {
    return null;
  }
}

async function normalizePickedAssets(assets: ImagePicker.ImagePickerAsset[]): Promise<SelectedImage[]> {
  if (assets.length > MAX_SELECTION) throw new Error(`Choose no more than ${MAX_SELECTION} images at once.`);
  return Promise.all(assets.map(async (asset, index) => {
    if (asset.type && asset.type !== 'image') throw new Error('Only still images are supported.');
    const size = asset.fileSize ?? await readFileSize(asset.uri);
    if (size !== null && size > MAX_INPUT_BYTES) throw new Error(`${asset.fileName ?? `Image ${index + 1}`} is larger than 40 MB.`);
    if (asset.width > 0 && asset.height > 0 && asset.width * asset.height > MAX_INPUT_PIXELS) throw new Error(`${asset.fileName ?? `Image ${index + 1}`} has too many pixels to process safely on this device.`);
    return {
      id: `${asset.assetId ?? asset.uri}-${index}`,
      uri: asset.uri,
      name: asset.fileName || `image-${index + 1}`,
      size,
      width: asset.width,
      height: asset.height,
      mimeType: asset.mimeType ?? null,
    };
  }));
}

export async function pickImages(): Promise<SelectedImage[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: MAX_SELECTION,
    orderedSelection: true,
    quality: 1,
    shouldDownloadFromNetwork: true,
  });
  if (result.canceled) return [];
  return normalizePickedAssets(result.assets);
}

export async function recoverPendingImageSelection(): Promise<SelectedImage[]> {
  const result = await ImagePicker.getPendingResultAsync();
  if (!result || 'code' in result || result.canceled) return [];
  return normalizePickedAssets(result.assets);
}

async function removeTemporaryFile(uri: string) {
  try {
    if (Platform.OS === 'web') {
      if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
      return;
    }
    const { File: ExpoFile } = await import('expo-file-system');
    const file = new ExpoFile(uri);
    if (file.exists) file.delete();
  } catch {
    // Temporary-file cleanup is best effort and must never remove a selected original.
  }
}

async function saveImage(image: ImageRef, format: ImageFormat, quality: number) {
  const saved = await image.saveAsync({ format: FORMAT_VALUES[format], compress: quality });
  return { ...saved, size: await readFileSize(saved.uri) };
}

async function saveTowardTarget(image: ImageRef, format: ImageFormat, initialQuality: number, targetBytes: number) {
  let fallback = await saveImage(image, format, initialQuality);
  if (fallback.size !== null && fallback.size <= targetBytes) return fallback;
  let accepted: Awaited<ReturnType<typeof saveImage>> | null = null;

  let lower = 0.12;
  let upper = Math.max(lower, initialQuality);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const quality = attempt === 0 ? lower : (lower + upper) / 2;
    const candidate = await saveImage(image, format, quality);
    if (candidate.size === null) {
      await removeTemporaryFile(fallback.uri);
      if (accepted) await removeTemporaryFile(accepted.uri);
      return candidate;
    }
    if (candidate.size <= targetBytes) {
      if (accepted) await removeTemporaryFile(accepted.uri);
      accepted = candidate;
      lower = quality;
    } else {
      upper = quality;
      if (fallback.size === null || candidate.size < fallback.size) {
        await removeTemporaryFile(fallback.uri);
        fallback = candidate;
      } else {
        await removeTemporaryFile(candidate.uri);
      }
    }
  }
  if (accepted) {
    await removeTemporaryFile(fallback.uri);
    return accepted;
  }
  return fallback;
}

function outputName(name: string, format: ImageFormat) {
  const base = name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'image';
  return `${base}-mewmo.${EXTENSIONS[format]}`;
}

async function processOne(image: SelectedImage, settings: ImageProcessingSettings): Promise<ProcessedImage> {
  const context = ImageManipulator.manipulate(image.uri);
  if (settings.mode === 'resize') {
    const resize: { width?: number; height?: number } = {};
    if (settings.width) resize.width = settings.width;
    if (settings.height) resize.height = settings.height;
    context.resize(resize);
  }
  const rendered = await context.renderAsync();
  const initialQuality = settings.mode === 'convert' ? 0.92 : QUALITY_VALUES[settings.quality];
  const saved = settings.mode === 'compress' && settings.targetBytes && settings.format !== 'PNG'
    ? await saveTowardTarget(rendered, settings.format, initialQuality, settings.targetBytes)
    : await saveImage(rendered, settings.format, initialQuality);

  return {
    id: saved.uri,
    uri: saved.uri,
    name: outputName(image.name, settings.format),
    size: saved.size,
    width: saved.width,
    height: saved.height,
    mimeType: MIME_TYPES[settings.format],
    originalId: image.id,
    originalName: image.name,
    originalSize: image.size,
    targetReached: settings.mode === 'compress' && settings.targetBytes
      ? saved.size === null ? null : saved.size <= settings.targetBytes
      : null,
  };
}

export async function processImages(images: SelectedImage[], settings: ImageProcessingSettings, onProgress?: (completed: number, total: number) => void) {
  if (images.length < 1 || images.length > MAX_SELECTION) throw new Error(`Select between 1 and ${MAX_SELECTION} images.`);
  if (settings.mode === 'resize' && !settings.width && !settings.height) throw new Error('Enter a width, a height, or both.');
  const results: ProcessedImage[] = [];
  try {
    for (const image of images) {
      results.push(await processOne(image, settings));
      onProgress?.(results.length, images.length);
    }
    return results;
  } catch (error) {
    await deleteProcessedImages(results);
    throw error;
  }
}

function downloadOnWeb(image: ProcessedImage) {
  const anchor = document.createElement('a');
  anchor.href = image.uri;
  anchor.download = image.name;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function saveProcessedImages(images: ProcessedImage[]) {
  if (!images.length) throw new Error('There are no processed images to save.');
  if (Platform.OS === 'web') {
    images.forEach(downloadOnWeb);
    return;
  }
  const MediaLibrary = await import('expo-media-library');
  const permission = await MediaLibrary.requestPermissionsAsync(true, []);
  if (!permission.granted) throw new Error('Photo-library access is required to save processed images. You can allow it in your device settings.');
  for (const image of images) await MediaLibrary.Asset.create(image.uri);
}

export async function shareProcessedImage(image: ProcessedImage) {
  if (Platform.OS === 'web') {
    downloadOnWeb(image);
    return;
  }
  if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(image.uri, { mimeType: image.mimeType ?? undefined, dialogTitle: `Share ${image.name}` });
}

export async function deleteProcessedImages(images: ProcessedImage[]) {
  await Promise.all(images.map((image) => removeTemporaryFile(image.uri)));
}
