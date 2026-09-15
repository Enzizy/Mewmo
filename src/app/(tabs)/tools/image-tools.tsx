import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { InlineError } from '@/components/converter-ui';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeading } from '@/components/section-heading';
import { colors, fonts, radius, themedStyles } from '@/constants/theme';
import { useTheme } from '@/store/ThemeContext';
import {
  deleteProcessedImages,
  ImageFormat,
  ImageQuality,
  ImageToolMode,
  pickImages,
  ProcessedImage,
  processImages,
  recoverPendingImageSelection,
  saveProcessedImages,
  SelectedImage,
  shareProcessedImage,
} from '@/services/imageTools';

const modes: ImageToolMode[] = ['convert', 'compress', 'resize'];
const formats: ImageFormat[] = ['JPEG', 'PNG', 'WebP'];
const qualities: ImageQuality[] = ['Smaller', 'Balanced', 'High'];
const targets = [
  { label: 'No target', bytes: null },
  { label: '500 KB', bytes: 500 * 1024 },
  { label: '1 MB', bytes: 1024 * 1024 },
  { label: '2 MB', bytes: 2 * 1024 * 1024 },
] as const;

export default function ImageToolsScreen() {
  useTheme();
  const [selected, setSelected] = useState<SelectedImage[]>([]);
  const [results, setResults] = useState<ProcessedImage[]>([]);
  const [mode, setMode] = useState<ImageToolMode>('convert');
  const [format, setFormat] = useState<ImageFormat>('JPEG');
  const [quality, setQuality] = useState<ImageQuality>('Balanced');
  const [targetBytes, setTargetBytes] = useState<number | null>(1024 * 1024);
  const [lockAspect, setLockAspect] = useState(true);
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const resultsRef = useRef<ProcessedImage[]>([]);

  useEffect(() => {
    resultsRef.current = results;
    return () => { void deleteProcessedImages(results); };
  }, [results]);
  useEffect(() => {
    recoverPendingImageSelection().then((recovered) => {
      if (recovered.length) setSelected(recovered);
    }).catch(() => undefined);
  }, []);

  const chooseImages = async () => {
    setError('');
    setStatus('');
    try {
      const images = await pickImages();
      if (!images.length) return;
      await deleteProcessedImages(resultsRef.current);
      setResults([]);
      setSelected(images);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The selected images could not be opened.');
    }
  };

  const removeImage = (id: string) => {
    setSelected((current) => current.filter((image) => image.id !== id));
    setResults([]);
    setStatus('');
  };

  const clearAll = async () => {
    await deleteProcessedImages(resultsRef.current);
    setResults([]);
    setSelected([]);
    setError('');
    setStatus('');
  };

  const runProcessing = async () => {
    setError('');
    setStatus('');
    const parsedWidth = parseDimension(width);
    const parsedHeight = parseDimension(height);
    if (mode === 'resize' && ((!parsedWidth && !parsedHeight) || widthInvalid(width) || widthInvalid(height))) {
      setError('Enter a whole-number width or height between 1 and 12,000 pixels.');
      return;
    }
    setProcessing(true);
    setProgress({ completed: 0, total: selected.length });
    try {
      await deleteProcessedImages(resultsRef.current);
      setResults([]);
      const output = await processImages(selected, {
        mode,
        format,
        quality,
        targetBytes: mode === 'compress' ? targetBytes : null,
        width: mode === 'resize' ? parsedWidth : null,
        height: mode === 'resize' ? parsedHeight : null,
      }, (completed, total) => setProgress({ completed, total }));
      setResults(output);
      setStatus(`${output.length} ${output.length === 1 ? 'image' : 'images'} processed. Review the results before saving.`);
    } catch (caught) {
      setResults([]);
      setError(caught instanceof Error ? caught.message : 'The images could not be processed.');
    } finally {
      setProcessing(false);
    }
  };

  const saveAll = async () => {
    setError('');
    setStatus('');
    try {
      await saveProcessedImages(results);
      setStatus(`${results.length} processed ${results.length === 1 ? 'image was' : 'images were'} saved.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The processed images could not be saved.');
    }
  };

  const shareOne = async (image: ProcessedImage) => {
    setError('');
    try {
      await shareProcessedImage(image);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The processed image could not be shared.');
    }
  };

  return <AppScreen tabbed>
    <ScreenHeader back />
    <PageHeader title="Image Tools" supporting="Convert, compress, or resize one image or a small batch." />
    <View style={styles.notice}><Feather name="shield" size={17} color={colors.accent} /><Text style={styles.noticeText}>Processing runs locally on your device. Your images are not uploaded, and originals remain unchanged.</Text></View>

    <View style={styles.section}>
      <SectionHeading title="1. Choose images" detail="Up to 10 PNG, JPEG, WebP, HEIC, or other device-supported images" />
      {!selected.length ? <View style={styles.dropzone}><View style={styles.dropIcon}><Feather name="image" size={25} color={colors.ink} /></View><Text style={styles.dropTitle}>No images selected</Text><Text style={styles.dropDetail}>Choose one image or select a batch from your photo library.</Text><PrimarySmallButton label="Choose images" icon="plus" onPress={chooseImages} /></View> : <View style={styles.fileList}>
        {selected.map((image) => <ImageRow key={image.id} image={image} onRemove={() => removeImage(image.id)} />)}
        <View style={styles.fileActions}><SecondarySmallButton label="Replace selection" icon="image" onPress={chooseImages} /><SecondarySmallButton label="Clear" icon="x" onPress={clearAll} /></View>
      </View>}
    </View>

    <View style={styles.section}>
      <SectionHeading title="2. Choose an action" />
      <View accessibilityRole="tablist" style={styles.modes}>{modes.map((value) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === value }} key={value} onPress={() => { setMode(value); setResults([]); setError(''); setStatus(''); }} style={[styles.mode, mode === value && styles.modeActive]}><Feather name={value === 'convert' ? 'repeat' : value === 'compress' ? 'minimize-2' : 'maximize'} size={17} color={mode === value ? colors.paper : colors.secondary} /><Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{capitalize(value)}</Text></Pressable>)}</View>
    </View>

    <View style={styles.section}>
      <SectionHeading title="3. Settings" detail={mode === 'convert' ? 'Choose the new file format.' : mode === 'compress' ? 'Balance file size and visual quality.' : 'Set the output dimensions.'} />
      <View style={styles.settings}>
        <ChoiceGroup label="Output format" values={formats} selected={format} onSelect={(value) => { setFormat(value as ImageFormat); setResults([]); }} />
        {mode !== 'convert' && format !== 'PNG' ? <ChoiceGroup label="Quality" values={qualities} selected={quality} onSelect={(value) => { setQuality(value as ImageQuality); setResults([]); }} /> : null}
        {mode === 'compress' ? <><ChoiceGroup label="Target size (best effort)" values={targets.map((target) => target.label)} selected={targets.find((target) => target.bytes === targetBytes)?.label ?? 'No target'} onSelect={(value) => setTargetBytes(targets.find((target) => target.label === value)?.bytes ?? null)} />{format === 'PNG' && targetBytes ? <Text style={styles.settingNote}>PNG compression is lossless, so a target size cannot be guaranteed. Choose JPEG or WebP for stronger size reduction.</Text> : null}</> : null}
        {mode === 'resize' ? <><View style={styles.fieldRow}><DimensionField label="Width" value={width} onChangeText={(next) => { setWidth(next); if (lockAspect) setHeight(''); setResults([]); }} placeholder={lockAspect && height ? 'Auto' : 'Pixels'} /><DimensionField label="Height" value={height} onChangeText={(next) => { setHeight(next); if (lockAspect) setWidth(''); setResults([]); }} placeholder={lockAspect && width ? 'Auto' : 'Pixels'} /></View><View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.settingLabel}>Lock aspect ratio</Text><Text style={styles.settingHelp}>{lockAspect ? 'Set one dimension; each image keeps its proportions.' : 'Set both dimensions to reshape every image.'}</Text></View><Switch accessibilityLabel="Lock aspect ratio" value={lockAspect} onValueChange={(next) => { setLockAspect(next); if (next && width && height) setHeight(''); }} trackColor={{ false: colors.borderStrong, true: colors.ink }} thumbColor={colors.paper} /></View></> : null}
      </View>
    </View>

    {error ? <InlineError message={error} /> : null}
    {status ? <View accessibilityLiveRegion="polite" style={styles.status}><Feather name="check-circle" size={17} color={colors.green} /><Text style={styles.statusText}>{status}</Text></View> : null}
    {processing ? <View accessibilityLiveRegion="polite" style={styles.processing}><ActivityIndicator color={colors.accent} /><Text style={styles.processingText}>Processing {progress.completed} of {progress.total}…</Text></View> : null}

    {results.length ? <View style={styles.section}>
      <SectionHeading title="4. Review results" detail="Compare each result before saving or sharing." />
      <View style={styles.resultList}>{results.map((image) => <ResultRow key={image.id} image={image} onShare={() => shareOne(image)} />)}</View>
      <Pressable accessibilityRole="button" onPress={saveAll} style={({ pressed }) => [styles.processButton, pressed && styles.pressed]}><Feather name="download" size={18} color={colors.paper} /><Text style={styles.processButtonText}>Save all results</Text></Pressable>
    </View> : <Pressable accessibilityRole="button" accessibilityState={{ disabled: !selected.length || processing, busy: processing }} disabled={!selected.length || processing} onPress={runProcessing} style={({ pressed }) => [styles.processButton, (!selected.length || processing) && styles.processDisabled, pressed && selected.length > 0 && styles.pressed]}>{processing ? <ActivityIndicator size="small" color={colors.paper} /> : <Feather name="zap" size={18} color={selected.length ? colors.paper : colors.muted} />}<Text style={[styles.processButtonText, !selected.length && styles.processDisabledText]}>{selected.length ? `Process ${selected.length} ${selected.length === 1 ? 'image' : 'images'}` : 'Select images to continue'}</Text></Pressable>}
  </AppScreen>;
}

function ImageRow({ image, onRemove }: { image: SelectedImage; onRemove: () => void }) {
  return <View style={styles.fileRow}><Image accessible={false} source={{ uri: image.uri }} style={styles.thumbnail} /><View style={styles.fileCopy}><Text numberOfLines={1} style={styles.fileName}>{image.name}</Text><Text style={styles.fileMeta}>{image.width || '?'} × {image.height || '?'} · {formatBytes(image.size)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${image.name}`} onPress={onRemove} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Feather name="x" size={18} color={colors.secondary} /></Pressable></View>;
}

function ResultRow({ image, onShare }: { image: ProcessedImage; onShare: () => void }) {
  return <View style={styles.resultRow}><Image accessible={false} source={{ uri: image.uri }} style={styles.resultPreview} resizeMode="cover" /><View style={styles.resultCopy}><Text numberOfLines={1} style={styles.fileName}>{image.name}</Text><Text style={styles.fileMeta}>{image.width} × {image.height}</Text><Text style={styles.sizeChange}>{formatBytes(image.originalSize)} → {formatBytes(image.size)}</Text>{image.targetReached === false ? <Text style={styles.targetMiss}>Closest result; target size was not reached.</Text> : image.targetReached ? <Text style={styles.targetHit}>Target size reached.</Text> : null}<SecondarySmallButton label="Share" icon="share-2" onPress={onShare} /></View></View>;
}

function ChoiceGroup({ label, values, selected, onSelect }: { label: string; values: readonly string[]; selected: string; onSelect: (value: string) => void }) {
  return <View style={styles.choiceGroup}><Text style={styles.settingLabel}>{label}</Text><View style={styles.choices}>{values.map((value) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected === value }} key={value} onPress={() => onSelect(value)} style={[styles.choice, selected === value && styles.choiceActive]}><View style={[styles.radio, selected === value && styles.radioActive]}>{selected === value ? <View style={styles.radioDot} /> : null}</View><Text style={[styles.choiceText, selected === value && styles.choiceTextActive]}>{value}</Text></Pressable>)}</View></View>;
}

function DimensionField({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return <View style={styles.dimensionField}><Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={`${label} in pixels`} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} keyboardType="number-pad" maxLength={5} style={styles.dimensionInput} /></View>;
}

function PrimarySmallButton({ label, icon, onPress }: ButtonProps) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primarySmall, pressed && styles.pressed]}><Feather name={icon} size={17} color={colors.paper} /><Text style={styles.primarySmallText}>{label}</Text></Pressable>; }
function SecondarySmallButton({ label, icon, onPress }: ButtonProps) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondarySmall, pressed && styles.pressed]}><Feather name={icon} size={15} color={colors.ink} /><Text style={styles.secondarySmallText}>{label}</Text></Pressable>; }
type ButtonProps = { label: string; icon: React.ComponentProps<typeof Feather>['name']; onPress: () => void };
function capitalize(value: string) { return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`; }
function parseDimension(value: string) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 && parsed <= 12_000 ? parsed : null; }
function widthInvalid(value: string) { return value.trim().length > 0 && parseDimension(value) === null; }
function formatBytes(value: number | null) { if (value === null) return 'Size unavailable'; if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`; return `${(value / (1024 * 1024)).toFixed(2)} MB`; }

const styles = themedStyles(() => ({
  notice: { marginTop: 22, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  noticeText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.ink },
  section: { marginTop: 32 },
  dropzone: { marginTop: 14, paddingHorizontal: 22, paddingVertical: 28, alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong, backgroundColor: colors.paper },
  dropIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  dropTitle: { marginTop: 14, fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink },
  dropDetail: { marginTop: 5, maxWidth: 330, textAlign: 'center', fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
  primarySmall: { minHeight: 44, marginTop: 18, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, backgroundColor: colors.ink },
  primarySmallText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.paper },
  secondarySmall: { minHeight: 40, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  secondarySmallText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  fileList: { marginTop: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.paper },
  fileRow: { minHeight: 76, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  thumbnail: { width: 50, height: 50, borderRadius: 9, backgroundColor: colors.background },
  fileCopy: { flex: 1, minWidth: 0 },
  fileName: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  fileMeta: { marginTop: 4, fontFamily: fonts.body, fontSize: 11, color: colors.secondary },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fileActions: { padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modes: { marginTop: 14, flexDirection: 'row', gap: 8 },
  mode: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  modeActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  modeText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary },
  modeTextActive: { fontFamily: fonts.bodySemiBold, color: colors.paper },
  settings: { marginTop: 14, paddingHorizontal: 18, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  choiceGroup: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.border },
  settingLabel: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  choices: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 42, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  choiceActive: { borderColor: colors.ink, backgroundColor: colors.paper },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.ink },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink },
  choiceText: { fontFamily: fonts.body, fontSize: 12, color: colors.secondary },
  choiceTextActive: { fontFamily: fonts.bodyMedium, color: colors.ink },
  settingNote: { marginTop: -1, paddingBottom: 16, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.mustard },
  fieldRow: { paddingVertical: 18, flexDirection: 'row', gap: 12 },
  dimensionField: { flex: 1, minHeight: 68, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  fieldLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.secondary },
  dimensionInput: { minHeight: 38, paddingVertical: 2, fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  switchRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderTopColor: colors.border },
  switchCopy: { flex: 1 },
  settingHelp: { marginTop: 4, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary },
  status: { marginTop: 20, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: radius.md, backgroundColor: colors.greenSoft },
  statusText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.green },
  processing: { minHeight: 64, marginTop: 22, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  processingText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.secondary },
  resultList: { marginTop: 14, gap: 10 },
  resultRow: { padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  resultPreview: { width: 78, height: 78, borderRadius: 10, backgroundColor: colors.background },
  resultCopy: { flex: 1, minWidth: 0 },
  sizeChange: { marginTop: 5, fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  targetMiss: { marginTop: 4, marginBottom: 9, fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.mustard },
  targetHit: { marginTop: 4, marginBottom: 9, fontFamily: fonts.body, fontSize: 10, color: colors.green },
  processButton: { minHeight: 54, marginTop: 24, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: radius.md, backgroundColor: colors.ink },
  processDisabled: { backgroundColor: colors.border },
  processButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.paper },
  processDisabledText: { color: colors.muted },
  pressed: { opacity: 0.68 },
}));
