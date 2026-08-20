import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { InlineError, OptionStrip, PendingResult, ResultPanel, SwapButton, ToolAction, ToolNotice, ValueField } from '@/components/converter-ui';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts, radius } from '@/constants/theme';
import { LanguageCode, TranslationResult, translateText } from '@/services/translationApi';

const languages = ['Auto detect', 'English', 'Filipino', 'Spanish', 'Japanese'] as const;
const outputLanguages = languages.filter((language) => language !== 'Auto detect');
const languageCodes: Record<(typeof languages)[number], LanguageCode> = {
  'Auto detect': 'auto',
  English: 'en',
  Filipino: 'fil',
  Spanish: 'es',
  Japanese: 'ja',
};
const outputLanguageCodes: Record<(typeof outputLanguages)[number], Exclude<LanguageCode, 'auto'>> = {
  English: 'en',
  Filipino: 'fil',
  Spanish: 'es',
  Japanese: 'ja',
};

export default function TranslatorScreen() {
  const [text, setText] = useState('');
  const [from, setFrom] = useState<(typeof languages)[number]>('Auto detect');
  const [to, setTo] = useState<(typeof outputLanguages)[number]>('English');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const clearResult = () => { setResult(null); setError(''); setCopied(false); };
  const swap = () => {
    if (from === 'Auto detect') return;
    setFrom(to);
    setTo(from);
    clearResult();
  };
  const selectFrom = (next: string) => {
    const language = next as (typeof languages)[number];
    setFrom(language);
    if (language !== 'Auto detect' && language === to) setTo(language === 'English' ? 'Filipino' : 'English');
    clearResult();
  };
  const selectTo = (next: string) => {
    const language = next as (typeof outputLanguages)[number];
    setTo(language);
    if (language === from) setFrom('Auto detect');
    clearResult();
  };

  const runTranslation = async () => {
    if (!text.trim()) {
      setError('Enter or paste text to translate.');
      return;
    }
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      setResult(await translateText(text.trim(), languageCodes[from], outputLanguageCodes[to]));
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : 'The translation could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result.translation);
    setCopied(true);
  };

  const useAsSource = () => {
    if (!result) return;
    setText(result.translation);
    setFrom(to);
    setTo(to === 'English' ? 'Filipino' : 'English');
    clearResult();
  };

  return <AppScreen tabbed>
    <ScreenHeader back />
    <PageHeader title="Translator" supporting="Write, review, and translate without clutter around your text." />
    <ToolNotice icon="shield">Your text is sent to Gemini through your private Mewmo server only when you tap Translate. It is not added to your personal records.</ToolNotice>
    <OptionStrip label="Translate from" values={languages} selected={from} onSelect={selectFrom} />
    <ValueField label="Text to translate" value={text} onChangeText={(next) => { setText(next); setError(''); }} placeholder="Type or paste text here" multiline maxLength={2000} />
    <View style={styles.countRow}><Text style={styles.count}>{text.length.toLocaleString()} / 2,000</Text></View>
    <SwapButton onPress={swap} label={from === 'Auto detect' ? 'Choose a source language before swapping' : 'Swap source and destination languages'} disabled={from === 'Auto detect'} />
    {from === 'Auto detect' ? <Text style={styles.swapHelp}>Choose a specific source language to swap.</Text> : null}
    <OptionStrip label="Translate to" values={outputLanguages} selected={to} onSelect={selectTo} />
    {error ? <InlineError message={error} /> : null}
    {result ? <ResultPanel
      eyebrow={`${result.detectedLanguage ?? from} to ${to}`}
      value={result.translation}
      detail="Review the result before using it for important communication."
    >
      <Pressable accessibilityRole="button" onPress={copyResult} style={({ pressed }) => [styles.resultAction, pressed && styles.pressed]}><Text style={styles.resultActionText}>{copied ? 'Copied' : 'Copy'}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={useAsSource} style={({ pressed }) => [styles.resultAction, pressed && styles.pressed]}><Text style={styles.resultActionText}>Use as source</Text></Pressable>
    </ResultPanel> : <PendingResult title="Translation will appear here" detail={`Your ${to} result stays separate from the original so you can copy it or translate it again.`} />}
    <ToolAction label="Translate" onPress={runTranslation} loading={loading} icon="zap" />
  </AppScreen>;
}

const styles = StyleSheet.create({
  countRow: { marginTop: 6, alignItems: 'flex-end' },
  count: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  swapHelp: { marginTop: -6, textAlign: 'center', fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  resultAction: { minHeight: 40, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  resultActionText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  pressed: { opacity: 0.65 },
});
