import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import { PDFDocument } from 'pdf-lib/dist/pdf-lib.esm.js';
import { Platform } from 'react-native';
import { parsePageSelection } from '@/utils/pdf';
import { pickImages } from './imageTools';

export type SelectedPdf = { name: string; uri: string; size: number | null; base64?: string; pageCount?: number };
export type ProcessedPdf = { name: string; uri: string; pageCount: number; size: number | null };

const MAX_PDFS = 10;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const MAX_PAGES = 500;
const A4 = { width: 595.28, height: 841.89 };

export async function pickPdfDocuments(multiple: boolean): Promise<SelectedPdf[]> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple, copyToCacheDirectory: true, base64: true });
  if (result.canceled) return [];
  if (result.assets.length > MAX_PDFS) throw new Error(`Choose no more than ${MAX_PDFS} PDFs.`);
  const total = result.assets.reduce((sum, asset) => sum + (asset.size ?? 0), 0);
  if (total > MAX_TOTAL_BYTES) throw new Error('The selected PDFs are larger than 40 MB combined. Choose a smaller batch.');
  return result.assets.map((asset) => ({ name: asset.name, uri: asset.uri, size: asset.size ?? null, base64: asset.base64 }));
}

export async function inspectPdf(pdf: SelectedPdf) {
  const document = await PDFDocument.load(await readBytes(pdf), { ignoreEncryption: false });
  const pageCount = document.getPageCount();
  if (pageCount > MAX_PAGES) throw new Error(`This PDF has ${pageCount} pages. The on-device limit is ${MAX_PAGES}.`);
  return { ...pdf, pageCount };
}

export async function mergePdfs(pdfs: SelectedPdf[]): Promise<ProcessedPdf> {
  if (pdfs.length < 2) throw new Error('Select at least two PDFs to merge.');
  const output = await PDFDocument.create();
  for (const pdf of pdfs) {
    const input = await PDFDocument.load(await readBytes(pdf), { ignoreEncryption: false });
    if (output.getPageCount() + input.getPageCount() > MAX_PAGES) throw new Error(`The merged PDF would exceed the ${MAX_PAGES}-page on-device limit.`);
    const pages = await output.copyPages(input, input.getPageIndices());
    pages.forEach((page) => output.addPage(page));
  }
  return savePdf(output, `lifedesk-merged-${dateStamp()}.pdf`);
}

export async function selectPdfPages(pdf: SelectedPdf, expression: string): Promise<ProcessedPdf> {
  const input = await PDFDocument.load(await readBytes(pdf), { ignoreEncryption: false });
  const indices = parsePageSelection(expression, input.getPageCount());
  const output = await PDFDocument.create();
  const pages = await output.copyPages(input, indices);
  pages.forEach((page) => output.addPage(page));
  return savePdf(output, `lifedesk-pages-${dateStamp()}.pdf`);
}

export async function imagesToPdf(): Promise<ProcessedPdf | null> {
  const images = await pickImages();
  if (!images.length) return null;
  const output = await PDFDocument.create();
  for (const image of images) {
    const rendered = await ImageManipulator.manipulate(image.uri).renderAsync();
    const jpeg = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
    try {
      const embedded = await output.embedJpg(await readUriBytes(jpeg.uri));
      const landscape = embedded.width > embedded.height;
      const pageWidth = landscape ? A4.height : A4.width;
      const pageHeight = landscape ? A4.width : A4.height;
      const margin = 24;
      const scale = Math.min((pageWidth - margin * 2) / embedded.width, (pageHeight - margin * 2) / embedded.height);
      const width = embedded.width * scale;
      const height = embedded.height * scale;
      const page = output.addPage([pageWidth, pageHeight]);
      page.drawImage(embedded, { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height });
    } finally {
      if (Platform.OS !== 'web') await FileSystem.deleteAsync(jpeg.uri, { idempotent: true });
    }
  }
  return savePdf(output, `lifedesk-images-${dateStamp()}.pdf`);
}

export async function exportPdf(pdf: ProcessedPdf) {
  if (Platform.OS === 'web') {
    const anchor = document.createElement('a');
    anchor.href = pdf.uri;
    anchor.download = pdf.name;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return;
  }
  if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(pdf.uri, { mimeType: 'application/pdf', dialogTitle: `Save or share ${pdf.name}` });
}

export async function deleteProcessedPdf(pdf: ProcessedPdf | null) {
  if (!pdf) return;
  if (Platform.OS === 'web') { if (pdf.uri.startsWith('blob:')) URL.revokeObjectURL(pdf.uri); return; }
  await FileSystem.deleteAsync(pdf.uri, { idempotent: true });
}

async function readBytes(pdf: SelectedPdf) {
  if (pdf.base64) return pdf.base64;
  if (Platform.OS === 'web') return new Uint8Array(await (await fetch(pdf.uri)).arrayBuffer());
  return FileSystem.readAsStringAsync(pdf.uri, { encoding: FileSystem.EncodingType.Base64 });
}

async function readUriBytes(uri: string) {
  if (Platform.OS === 'web') return new Uint8Array(await (await fetch(uri)).arrayBuffer());
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

async function savePdf(document: PDFDocument, name: string): Promise<ProcessedPdf> {
  const bytes = await document.save();
  if (Platform.OS === 'web') {
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
    return { name, uri: URL.createObjectURL(blob), pageCount: document.getPageCount(), size: bytes.length };
  }
  if (!FileSystem.cacheDirectory) throw new Error('Temporary storage is unavailable on this device.');
  const uri = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, await document.saveAsBase64(), { encoding: FileSystem.EncodingType.Base64 });
  return { name, uri, pageCount: document.getPageCount(), size: bytes.length };
}

function dateStamp() { return new Date().toISOString().replace(/[:.]/g, '-'); }
