import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { PixelCat } from '@/components/PixelCat';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts, themedStyles } from '@/constants/theme';
import { askPersonalAssistant, AssistantMessage, transcribeAssistantRecording } from '@/services/assistantApi';
import { useItems } from '@/store/ItemsContext';
import { useTheme } from '@/store/ThemeContext';

const HISTORY_KEY = 'lifedesk.assistant.chat.v1';
const MAX_MESSAGES = 40;
const MAX_INPUT = 4000;
const suggestions = ['Remind me tomorrow to call Mom', 'Log a ₱450 lunch expense', 'Explain something I’m learning', 'What is safe for me to spend?'];
type ChatMessage = AssistantMessage & { reviewId?: string };
const welcome: ChatMessage = { role: 'assistant', text: 'Hi — I can answer general questions and help organize your LifeDesk. Ask about your schedule, or say “remind me tomorrow”, “log an expense”, or “add an investment”. I’ll ask for details when needed, and proposed changes wait in Review until you confirm them.' };

export default function ChatScreen() {
  useTheme();
  const router = useRouter();
  const data = useItems();
  const { pendingRecording, setPendingRecording, queueReviewProposal } = data;
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const changedBeforeHydration = useRef(false);
  const transcribedUri = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(HISTORY_KEY).then((raw) => {
      if (!active) return;
      if (raw && !changedBeforeHydration.current) {
        try {
          const saved = JSON.parse(raw) as ChatMessage[];
          if (Array.isArray(saved) && saved.length && saved.every((message) => message && (message.role === 'user' || message.role === 'assistant') && typeof message.text === 'string' && (!message.reviewId || typeof message.reviewId === 'string'))) setMessages(saved.slice(-MAX_MESSAGES));
        } catch { /* Start with the welcome message if local history is invalid. */ }
      }
      setHydrated(true);
    }).catch(() => setHydrated(true));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES))).catch(() => undefined);
  }, [hydrated, messages]);

  const transcribePending = useCallback(async () => {
    if (!pendingRecording || transcribing || transcriptionError || transcribedUri.current === pendingRecording.uri) return;
    transcribedUri.current = pendingRecording.uri;
    setTranscribing(true);
    setTranscriptionError(null);
    try {
      const transcript = (await transcribeAssistantRecording(pendingRecording)).trim();
      if (!transcript) throw new Error('No speech was detected. Try recording again.');
      const combined = input.trim() ? `${input.trim()} ${transcript}` : transcript;
      if (combined.length > MAX_INPUT) throw new Error('This message exceeds 4,000 characters. Shorten the text before retrying; your recording is still here.');
      setInput(combined);
      await FileSystem.deleteAsync(pendingRecording.uri, { idempotent: true }).catch(() => undefined);
      setPendingRecording(null);
    } catch (error) {
      transcribedUri.current = null;
      setTranscriptionError(error instanceof Error ? error.message : 'Could not transcribe the recording.');
    } finally { setTranscribing(false); }
  }, [input, pendingRecording, setPendingRecording, transcribing, transcriptionError]);

  useFocusEffect(useCallback(() => {
    void transcribePending();
  }, [transcribePending]));

  const send = async (question = input, appendUserMessage = true) => {
    const text = question.trim();
    if (!text || text.length > MAX_INPUT || sending || transcribing || !hydrated || !data.hydrated) return;
    changedBeforeHydration.current = true;
    const conversation = messages.filter((message) => !message.reviewId);
    const previous = (failedQuestion === text && conversation.at(-1)?.role === 'user' && conversation.at(-1)?.text === text ? conversation.slice(0, -1) : conversation).slice(-8);
    if (failedQuestion === text) appendUserMessage = false;
    if (appendUserMessage) setMessages((current) => [...current, { role: 'user' as const, text }].slice(-MAX_MESSAGES));
    setInput('');
    setSendError(null);
    setFailedQuestion(null);
    setSending(true);
    try {
      const result = await askPersonalAssistant(text, previous, data);
      if (result.proposal) {
        const proposal = await queueReviewProposal('chat', { ...result.proposal, transcript: text });
        setMessages((current) => [...current, { role: 'assistant' as const, text: result.answer }, { role: 'assistant' as const, text: 'Review the proposed changes when you’re ready.', reviewId: proposal.id }].slice(-MAX_MESSAGES));
      } else setMessages((current) => [...current, { role: 'assistant' as const, text: result.answer }].slice(-MAX_MESSAGES));
    } catch (error) {
      setInput(text);
      setFailedQuestion(text);
      setSendError(error instanceof Error ? error.message : 'The assistant could not answer.');
    } finally { setSending(false); }
  };

  const discardPending = async () => {
    if (!pendingRecording) return;
    await FileSystem.deleteAsync(pendingRecording.uri, { idempotent: true }).catch(() => undefined);
    setPendingRecording(null);
    setTranscriptionError(null);
    transcribedUri.current = null;
  };
  const clearConversation = () => { if (sending || transcribing || !hydrated) return; changedBeforeHydration.current = true; setMessages([welcome]); setSendError(null); setFailedQuestion(null); };

  return <AppScreen scroll={false} background={colors.paper}>
    <ScreenHeader back title="ASK MY CAT" />
    <View style={styles.intro}><View style={styles.introRow}><PixelCat pose="curious" size={66} speech="ASK AWAY" /><Pressable accessibilityRole="button" onPress={clearConversation}><Text style={styles.clear}>Clear chat</Text></Pressable></View><Text style={styles.privacy}>Your messages, voice recordings, and relevant saved records are sent to Gemini. Review changes before saving.</Text></View>
    <ScrollView ref={scrollRef} style={styles.messageList} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })} contentContainerStyle={styles.messages} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled">
      {messages.map((message, index) => message.reviewId ? <ReviewCard key={`${message.reviewId}-${index}`} id={message.reviewId} available={data.reviewProposals.some((proposal) => proposal.id === message.reviewId)} onPress={() => router.push({ pathname: '/review', params: { id: message.reviewId! } })} /> : <View key={`${message.role}-${index}`} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.catBubble]}><Text selectable style={[styles.message, message.role === 'user' && styles.userMessage]}>{message.text}</Text></View>)}
      {sending ? <View style={[styles.bubble, styles.catBubble, styles.loading]}><ActivityIndicator size="small" color={colors.ink} /><Text style={styles.thinking}>THINKING...</Text></View> : null}
      {sendError ? <View style={styles.errorBox}><Text style={styles.errorText}>{sendError}</Text><View style={styles.errorActions}><Pressable onPress={() => failedQuestion && send(failedQuestion, false)} disabled={!failedQuestion || sending}><Text style={styles.retryText}>Retry</Text></Pressable><Pressable onPress={() => { setSendError(null); setFailedQuestion(null); }}><Text style={styles.editText}>Keep editing</Text></Pressable></View></View> : null}
    </ScrollView>
    {!messages.some((message) => message.role === 'user') ? <View style={styles.suggestions}>{suggestions.map((suggestion) => <Pressable accessibilityRole="button" key={suggestion} disabled={!hydrated || sending} onPress={() => send(suggestion)} style={[styles.suggestion, (!hydrated || sending) && styles.disabled]}><Text style={styles.suggestionText}>{suggestion}</Text></Pressable>)}</View> : null}
    {transcribing ? <Text style={styles.status}>TRANSCRIBING VOICE NOTE…</Text> : null}
    {transcriptionError ? <View style={styles.voiceError}><Text style={styles.errorText}>{transcriptionError}</Text><View style={styles.errorActions}><Pressable onPress={() => { transcribedUri.current = null; setTranscriptionError(null); }}><Text style={styles.retryText}>Retry</Text></Pressable><Pressable onPress={discardPending}><Text style={styles.editText}>Discard</Text></Pressable></View></View> : null}
    <View style={styles.composer}><TextInput accessibilityLabel="Ask a personal question" value={input} onChangeText={(value) => setInput(value.slice(0, MAX_INPUT))} editable={!transcribing && !sending} multiline maxLength={MAX_INPUT} onSubmitEditing={() => send()} placeholder="Ask anything or tell me what to organize…" placeholderTextColor={colors.muted} style={styles.input} /><Pressable accessibilityRole="button" accessibilityLabel="Record a voice request" disabled={!hydrated || sending || transcribing || Boolean(input.trim())} onPress={() => router.push('/record')} style={[styles.mic, (!hydrated || sending || transcribing || Boolean(input.trim())) && styles.disabled]}><Feather name="mic" size={19} color={colors.ink} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Send question" disabled={!hydrated || sending || !input.trim()} onPress={() => send()} style={[styles.send, (!hydrated || sending || !input.trim()) && styles.disabled]}><Feather name="arrow-up" size={20} color={colors.surface} /></Pressable></View>
  </AppScreen>;
}

function ReviewCard({ id, available, onPress }: { id: string; available: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={!available} onPress={onPress} style={[styles.reviewButton, !available && styles.reviewUnavailable]}><Feather name="inbox" size={17} color={available ? colors.paper : colors.muted} /><Text style={[styles.reviewButtonText, !available && styles.unavailableText]}>{available ? 'Review proposed changes' : 'This proposal is no longer available'}</Text>{available ? <Feather name="chevron-right" size={17} color={colors.paper} /> : null}</Pressable>;
}

const styles = themedStyles(() => ({
  intro: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }, introRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, clear: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.secondary }, privacy: { marginTop: 8, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary }, messageList: { flex: 1 }, messages: { paddingVertical: 16, gap: 10 }, bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1 }, catBubble: { alignSelf: 'flex-start', borderColor: colors.borderStrong, backgroundColor: colors.surface }, userBubble: { alignSelf: 'flex-end', borderColor: colors.ink, backgroundColor: colors.ink }, message: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink }, userMessage: { color: colors.surface }, loading: { flexDirection: 'row', alignItems: 'center', gap: 8 }, thinking: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.secondary }, suggestions: { paddingVertical: 10, gap: 7 }, suggestion: { minHeight: 42, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong }, suggestionText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink }, composer: { paddingTop: 10, paddingBottom: 8, flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'flex-end' }, input: { flex: 1, minHeight: 48, maxHeight: 110, paddingHorizontal: 13, paddingVertical: 12, borderWidth: 1, borderColor: colors.borderStrong, fontFamily: fonts.body, fontSize: 14, color: colors.ink, backgroundColor: colors.surface }, mic: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface }, send: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink }, disabled: { opacity: 0.35 }, reviewButton: { alignSelf: 'flex-start', minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.ink }, reviewUnavailable: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }, reviewButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.paper }, unavailableText: { color: colors.muted }, errorBox: { padding: 12, borderWidth: 1, borderColor: colors.terracotta, backgroundColor: colors.dangerSoft }, voiceError: { paddingVertical: 8 }, errorText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.terracotta }, errorActions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 8 }, retryText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink }, editText: { fontFamily: fonts.body, fontSize: 12, color: colors.secondary }, status: { paddingVertical: 8, fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.secondary },
}));
