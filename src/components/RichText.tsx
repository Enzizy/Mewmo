import { useMemo } from 'react';
import { Platform, Text, TextStyle, View } from 'react-native';
import { colors, fonts, themedStyles } from '@/constants/theme';
import { useTheme } from '@/store/ThemeContext';
import { parseRichText, RichSpan } from '@/utils/rich-text';

/** Renders an assistant reply's light Markdown as native text. */
export function RichText({ text, style }: { text: string; style?: TextStyle }) {
  useTheme();
  const blocks = useMemo(() => parseRichText(text), [text]);
  if (!blocks.length) return <Text selectable style={[styles.body, style]}>{text}</Text>;
  return (
    <View style={styles.stack}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') return <Text key={index} selectable accessibilityRole="header" style={[styles.body, style, styles.heading]}><Spans spans={block.spans} /></Text>;
        if (block.type === 'paragraph') return <Text key={index} selectable style={[styles.body, style]}><Spans spans={block.spans} /></Text>;
        const marker = block.type === 'bullet' ? (block.depth ? '◦' : '•') : block.marker;
        return (
          <View key={index} style={[styles.listRow, { paddingLeft: block.depth * 16 }]}>
            <Text style={[styles.body, style, styles.marker, block.type === 'numbered' && styles.numberMarker]}>{marker}</Text>
            <Text selectable style={[styles.body, style, styles.listText]}><Spans spans={block.spans} /></Text>
          </View>
        );
      })}
    </View>
  );
}

function Spans({ spans }: { spans: RichSpan[] }) {
  return <>{spans.map((span, index) => (
    <Text key={index} style={[span.bold && styles.bold, span.italic && styles.italic, span.code && styles.code]}>{span.text}</Text>
  ))}</>;
}

const styles = themedStyles(() => ({
  stack: { gap: 6 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  heading: { marginTop: 2, fontFamily: fonts.bodyBold, fontSize: 15 },
  bold: { fontFamily: fonts.bodySemiBold },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 13, color: colors.accent, backgroundColor: colors.accentSoft },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  marker: { width: 12, color: colors.secondary, textAlign: 'center' },
  numberMarker: { width: 20, fontFamily: fonts.bodySemiBold, fontVariant: ['tabular-nums'], textAlign: 'right' },
  listText: { flex: 1 },
}));
