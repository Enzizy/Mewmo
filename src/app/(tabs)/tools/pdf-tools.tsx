import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { useAppDialog } from '@/components/AppDialog';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeading } from '@/components/section-heading';
import { colors, fonts, radius } from '@/constants/theme';
import { deleteProcessedPdf, exportPdf, imagesToPdf, inspectPdf, mergePdfs, pickPdfDocuments, ProcessedPdf, SelectedPdf, selectPdfPages } from '@/services/pdfTools';

type Mode = 'images' | 'merge' | 'pages';

export default function PdfToolsScreen() {
  const { showDialog } = useAppDialog();
  const [mode, setMode] = useState<Mode | null>(null);
  const [selected, setSelected] = useState<SelectedPdf[]>([]);
  const [pages, setPages] = useState('');
  const [result, setResult] = useState<ProcessedPdf | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (error: unknown) => showDialog({ title: 'PDF could not be processed', message: error instanceof Error ? error.message : 'Try again with a different file.', tone: 'danger' });
  const prepare = async (next: Mode) => {
    setBusy(true);
    try {
      await deleteProcessedPdf(result);
      setResult(null); setSelected([]); setPages(''); setMode(next);
      if (next === 'images') {
        const output = await imagesToPdf();
        if (output) setResult(output); else setMode(null);
      } else if (next === 'merge') {
        const files = await pickPdfDocuments(true);
        if (files.length) setSelected(files); else setMode(null);
      } else {
        const files = await pickPdfDocuments(false);
        if (files[0]) setSelected([await inspectPdf(files[0])]); else setMode(null);
      }
    } catch (error) { setMode(null); fail(error); }
    finally { setBusy(false); }
  };
  const process = async () => {
    setBusy(true);
    try {
      const output = mode === 'merge' ? await mergePdfs(selected) : mode === 'pages' && selected[0] ? await selectPdfPages(selected[0], pages) : null;
      if (output) setResult(output);
    } catch (error) { fail(error); }
    finally { setBusy(false); }
  };
  const save = async () => { if (!result) return; try { await exportPdf(result); } catch (error) { fail(error); } };

  return (
    <AppScreen tabbed assistant={!busy}>
      <ScreenHeader back />
      <PageHeader title="PDF and document tools" supporting="Build and organize PDFs locally on your device. Your files are not uploaded." />

      <View style={styles.privacy}><Feather name="lock" size={17} color={colors.green} /><View style={styles.main}><Text style={styles.privacyTitle}>Private by default</Text><Text style={styles.privacyText}>Processing stays on this device. Temporary output is removed when replaced.</Text></View></View>

      <View style={styles.section}>
        <SectionHeading title="Choose an action" />
        <View style={styles.actions}>
          <ToolAction icon="image" title="Images to PDF" detail="Turn up to 10 selected images into one PDF." onPress={() => prepare('images')} />
          <ToolAction icon="layers" title="Merge PDFs" detail="Combine up to 10 PDFs in the order selected." onPress={() => prepare('merge')} />
          <ToolAction icon="file-text" title="Select and reorder pages" detail="Create a new PDF from chosen pages in your preferred order." onPress={() => prepare('pages')} />
        </View>
      </View>

      {busy ? <View style={styles.processing}><ActivityIndicator color={colors.ink} /><Text style={styles.processingText}>Processing on your device…</Text></View> : null}

      {!busy && mode === 'merge' && selected.length ? <View style={styles.workspace}><Text style={styles.workspaceTitle}>{selected.length} PDFs selected</Text>{selected.map((file, index) => <View key={`${file.uri}-${index}`} style={styles.fileRow}><View style={styles.fileIndex}><Text style={styles.fileIndexText}>{index + 1}</Text></View><View style={styles.main}><Text numberOfLines={1} style={styles.fileName}>{file.name}</Text><Text style={styles.fileMeta}>{formatBytes(file.size)}</Text></View></View>)}<PrimaryButton label="Merge PDFs" onPress={process} /></View> : null}

      {!busy && mode === 'pages' && selected[0] ? <View style={styles.workspace}><Text style={styles.workspaceTitle}>{selected[0].name}</Text><Text style={styles.workspaceDetail}>{selected[0].pageCount} pages · Enter pages in the exact output order.</Text><Text style={styles.label}>Pages</Text><TextInput accessibilityLabel="Pages to include" autoCorrect={false} keyboardType="numbers-and-punctuation" value={pages} onChangeText={setPages} placeholder="For example: 3, 1-2, 5" placeholderTextColor={colors.muted} style={styles.input} /><Text style={styles.hint}>Ranges run low to high. Use separate page numbers to reorder them.</Text><PrimaryButton label="Create selected PDF" onPress={process} /></View> : null}

      {!busy && result ? <View style={styles.result}><View style={styles.resultIcon}><Feather name="check" size={23} color={colors.paper} /></View><View style={styles.main}><Text style={styles.resultTitle}>PDF ready</Text><Text numberOfLines={1} style={styles.resultName}>{result.name}</Text><Text style={styles.resultMeta}>{result.pageCount} {result.pageCount === 1 ? 'page' : 'pages'} · {formatBytes(result.size)}</Text></View><Pressable accessibilityRole="button" onPress={save} style={({ pressed }) => [styles.save, pressed && styles.pressed]}><Feather name="share-2" size={17} color={colors.paper} /><Text style={styles.saveText}>Save</Text></Pressable></View> : null}

      <Text style={styles.limit}>Encrypted or password-protected PDFs are not supported. The current on-device limit is 40 MB per selection and 500 output pages. PDF compression, signing, and OCR are not included because this version does not upload files or pretend to compress content losslessly.</Text>
    </AppScreen>
  );
}

function ToolAction({ icon, title, detail, onPress }: { icon: keyof typeof Feather.glyphMap; title: string; detail: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><View style={styles.actionIcon}><Feather name={icon} size={20} color={colors.ink} /></View><View style={styles.main}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionDetail}>{detail}</Text></View><Feather name="chevron-right" size={19} color={colors.muted} /></Pressable>; }
function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}><Text style={styles.primaryText}>{label}</Text><Feather name="arrow-right" size={18} color={colors.paper} /></Pressable>; }
function formatBytes(value: number | null) { if (value == null) return 'Size unavailable'; if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`; return `${(value / 1024 / 1024).toFixed(1)} MB`; }

const styles = StyleSheet.create({
  privacy: { minHeight: 76, marginTop: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, backgroundColor: '#F0F7F3', borderWidth: 1, borderColor: '#D8EADF' },
  privacyTitle: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  privacyText: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary },
  main: { flex: 1, minWidth: 0 },
  section: { marginTop: 32 },
  actions: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  action: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  actionTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
  actionDetail: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary },
  processing: { minHeight: 110, marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  processingText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary },
  workspace: { marginTop: 24, padding: 17, gap: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  workspaceTitle: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 23, color: colors.ink },
  workspaceDetail: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
  fileRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  fileIndex: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  fileIndexText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.ink },
  fileName: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },
  fileMeta: { marginTop: 2, fontFamily: fonts.body, fontSize: 10, color: colors.secondary },
  label: { marginTop: 8, fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  input: { minHeight: 50, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.background, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  hint: { fontFamily: fonts.body, fontSize: 10, lineHeight: 15, color: colors.muted },
  primary: { minHeight: 52, marginTop: 8, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 11, backgroundColor: colors.ink },
  primaryText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.paper },
  primaryPressed: { opacity: 0.82 },
  result: { minHeight: 94, marginTop: 20, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  resultIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.green },
  resultTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  resultName: { marginTop: 2, fontFamily: fonts.body, fontSize: 11, color: colors.secondary },
  resultMeta: { marginTop: 3, fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.muted },
  save: { minHeight: 44, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, backgroundColor: colors.ink },
  saveText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.paper },
  limit: { marginTop: 22, fontFamily: fonts.body, fontSize: 10, lineHeight: 16, color: colors.muted },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
});
