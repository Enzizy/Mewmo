import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, NativeSyntheticEvent, Platform, Pressable, ScrollView, Text, TextInput, TextInputKeyPressEventData, View } from 'react-native';
import Animated, { cancelAnimation, FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { AppScreen } from '@/components/AppScreen';
import { useAppDialog } from '@/components/AppDialog';
import { PixelCat } from '@/components/PixelCat';
import { RichText } from '@/components/RichText';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts, motion, radius, themedStyles } from '@/constants/theme';
import { ASSISTANT_STARTERS } from '@/features/assistant/starters';
import { suggestionKindMeta } from '@/features/assistant/suggestion-kinds';
import { askPersonalAssistant, AssistantMessage, transcribeAssistantRecording } from '@/services/assistantApi';
import { useItems } from '@/store/ItemsContext';
import { useTheme } from '@/store/ThemeContext';
import { ReviewProposal } from '@/types';

const HISTORY_KEY = 'lifedesk.assistant.chat.v1';
const MAX_MESSAGES = 40;
const MAX_INPUT = 4000;
type ChatMessage = AssistantMessage & { reviewId?: string };
const welcome: ChatMessage = { role: 'assistant', text: 'Ask me anything. I can also help plan your day, create reminders, and log money. You confirm changes before I save them.' };

export default function ChatScreen() {
  useTheme();
  const router = useRouter();
  const pathname = usePathname();
  // The desktop layout shows this screen as a tab, where a back arrow has nowhere useful to go.
  const asTab = pathname === '/capture';
  const params = useLocalSearchParams<{ prompt?: string; focus?: string }>();
  const { showDialog } = useAppDialog();
  const data = useItems();
  const { pendingRecording, setPendingRecording, queueReviewProposal } = data;
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const changedBeforeHydration = useRef(false);
  const transcribedUri = useRef<string | null>(null);
  const consumedPrompt = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const hasConversation = messages.some((message) => message.role === 'user');
  const ready = hydrated && data.hydrated;

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(HISTORY_KEY).then((raw) => {
      if (!active) return;
      if (raw && !changedBeforeHydration.current) {
        try {
          const saved = JSON.parse(raw) as ChatMessage[];
          if (Array.isArray(saved) && saved.length && saved.every((message) => message && (message.role === 'user' || message.role === 'assistant') && typeof message.text === 'string' && (!message.reviewId || typeof message.reviewId === 'string'))) {
            const recent = saved.slice(-MAX_MESSAGES);
            if (recent[0]?.role === 'assistant' && recent[0].text.startsWith('Hi — I can answer general questions and help organize your LifeDesk.')) recent[0] = welcome;
            setMessages(recent);
          }
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

  // A starter tapped elsewhere (Home) arrives as a `prompt` param and is sent once.
  useEffect(() => {
    const prompt = typeof params.prompt === 'string' ? params.prompt.trim() : '';
    if (!prompt) { consumedPrompt.current = null; return; }
    if (consumedPrompt.current === prompt || !ready || sending) return;
    consumedPrompt.current = prompt;
    router.setParams({ prompt: undefined });
    void send(prompt);
  }, [params.prompt, ready, sending]);

  const discardPending = async () => {
    if (!pendingRecording) return;
    await FileSystem.deleteAsync(pendingRecording.uri, { idempotent: true }).catch(() => undefined);
    setPendingRecording(null);
    setTranscriptionError(null);
    transcribedUri.current = null;
  };
  const clearConversation = () => {
    if (sending || transcribing || !hydrated || messages.length <= 1) return;
    showDialog({
      title: 'Start a new chat?',
      message: 'This conversation will be removed from this device. Saved LifeDesk records and pending reviews stay.',
      tone: 'warning',
      actions: [
        { label: 'Keep chat', variant: 'secondary' },
        { label: 'New chat', variant: 'danger', onPress: () => { changedBeforeHydration.current = true; setMessages([welcome]); setSendError(null); setFailedQuestion(null); } },
      ],
    });
  };

  // Enter sends on the web; Shift+Enter keeps a newline, as in most chat apps.
  const handleKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (Platform.OS !== 'web') return;
    const native = event.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean; isComposing?: boolean };
    if (native.key === 'Enter' && !native.shiftKey && !native.isComposing) {
      event.preventDefault();
      void send();
    }
  };

  const canSend = ready && !sending && !transcribing && Boolean(input.trim());
  const nearLimit = input.length > MAX_INPUT - 400;

  return <AppScreen scroll={false} docked background={colors.paper}>
    <ScreenHeader back={!asTab} title="Assistant" action={<Pressable accessibilityRole="button" accessibilityLabel="Start a new chat" accessibilityState={{ disabled: !hasConversation }} disabled={!hasConversation} onPress={clearConversation} style={({ pressed }) => [styles.headerButton, !hasConversation && styles.hidden, pressed && styles.pressed]}><Feather name="edit" size={19} color={colors.ink} /></Pressable>} />
    <ScrollView ref={scrollRef} style={styles.messageList} onContentSizeChange={() => { if (hasConversation) scrollRef.current?.scrollToEnd({ animated: true }); }} contentContainerStyle={[styles.messages, !hasConversation && styles.messagesEmpty]} showsVerticalScrollIndicator={false} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled">
      {!hasConversation ? <EmptyChat disabled={!ready || sending} onStarter={(prompt) => void send(prompt)} /> : messages.map((message, index) => {
        if (message.reviewId) return <ProposalCard key={`${message.reviewId}-${index}`} proposal={data.reviewProposals.find((proposal) => proposal.id === message.reviewId)} onPress={() => router.push({ pathname: '/review', params: { id: message.reviewId! } })} />;
        if (message.role === 'user') return <Animated.View entering={FadeInDown.duration(motion.base)} key={`user-${index}`} style={styles.userRow}><View style={styles.userBubble}><Text selectable style={styles.userText}>{message.text}</Text></View></Animated.View>;
        const grouped = index > 0 && messages[index - 1].role === 'assistant';
        return <Animated.View entering={FadeIn.duration(motion.slow)} key={`assistant-${index}`} style={[styles.assistantRow, grouped && styles.assistantGrouped]}>{grouped ? <View style={styles.avatarSpacer} /> : <Avatar />}<View style={styles.assistantBody}><RichText text={message.text} /></View></Animated.View>;
      })}
      {sending ? <View style={styles.assistantRow}><Avatar /><View style={styles.typing}><TypingDots /></View></View> : null}
      {sendError ? <View accessibilityRole="alert" style={styles.errorBox}><Feather name="alert-circle" size={17} color={colors.danger} /><View style={styles.errorMain}><Text style={styles.errorText}>{sendError}</Text><View style={styles.errorActions}><Pressable accessibilityRole="button" onPress={() => failedQuestion && send(failedQuestion, false)} disabled={!failedQuestion || sending} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}><Feather name="refresh-cw" size={13} color={colors.paper} /><Text style={styles.retryText}>Retry</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { setSendError(null); setFailedQuestion(null); inputRef.current?.focus(); }} style={styles.textButton}><Text style={styles.editText}>Edit message</Text></Pressable></View></View></View> : null}
    </ScrollView>
    {transcribing ? <View accessibilityLiveRegion="polite" style={styles.statusPill}><ActivityIndicator size="small" color={colors.accent} /><Text style={styles.status}>Transcribing your voice note…</Text></View> : null}
    {transcriptionError ? <View accessibilityRole="alert" style={styles.voiceError}><Feather name="mic-off" size={16} color={colors.danger} /><View style={styles.errorMain}><Text style={styles.errorText}>{transcriptionError}</Text><View style={styles.errorActions}><Pressable accessibilityRole="button" onPress={() => { transcribedUri.current = null; setTranscriptionError(null); }} style={styles.textButton}><Text style={styles.retryLink}>Try again</Text></Pressable><Pressable accessibilityRole="button" onPress={discardPending} style={styles.textButton}><Text style={styles.editText}>Discard recording</Text></Pressable></View></View></View> : null}
    <View style={[styles.composer, inputFocused && styles.composerFocused]}>
      <TextInput
        ref={inputRef}
        accessibilityLabel="Message the assistant"
        autoFocus={params.focus === '1'}
        value={input}
        onChangeText={(value) => setInput(value.slice(0, MAX_INPUT))}
        onFocus={() => setInputFocused(true)}
        onBlur={() => setInputFocused(false)}
        onKeyPress={handleKeyPress}
        editable={!transcribing && !sending}
        multiline
        maxLength={MAX_INPUT}
        placeholder={transcribing ? 'Transcribing your note…' : 'Ask or tell me anything…'}
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <View style={styles.composerActions}>
        {nearLimit ? <Text style={styles.counter}>{MAX_INPUT - input.length}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Record a voice message" disabled={!hydrated || sending || transcribing} onPress={() => router.push('/record')} style={({ pressed }) => [styles.mic, (!hydrated || sending || transcribing) && styles.disabled, pressed && styles.pressed]}><Feather name="mic" size={19} color={colors.ink} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Send message" accessibilityState={{ disabled: !canSend }} disabled={!canSend} onPress={() => send()} style={({ pressed }) => [styles.send, !canSend && styles.sendIdle, pressed && styles.pressed]}><Feather name="arrow-up" size={19} color={canSend ? colors.paper : colors.muted} /></Pressable>
      </View>
    </View>
  </AppScreen>;
}

function EmptyChat({ disabled, onStarter }: { disabled: boolean; onStarter: (prompt: string) => void }) {
  return <Animated.View entering={FadeIn.duration(motion.slow)} style={styles.empty}>
    <PixelCat pose="curious" size={84} />
    <Text accessibilityRole="header" style={styles.emptyTitle}>What can I help with?</Text>
    <Text style={styles.emptyText}>Ask a question, plan your day, or tell me what to remember. I suggest changes; you confirm before anything is saved.</Text>
    <View style={styles.starters}>{ASSISTANT_STARTERS.map((starter) => <Pressable accessibilityRole="button" key={starter.label} disabled={disabled} onPress={() => onStarter(starter.prompt)} style={({ pressed }) => [styles.starter, disabled && styles.disabled, pressed && styles.starterPressed]}><View style={styles.starterIcon}><Feather name={starter.icon} size={15} color={colors.ink} /></View><Text style={styles.starterText}>{starter.label}</Text></Pressable>)}</View>
    <View style={styles.privacy}><Feather name="lock" size={12} color={colors.muted} /><Text style={styles.privacyText}>Messages and relevant saved records are sent to Gemini to answer.</Text></View>
  </Animated.View>;
}

function Avatar() {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.avatar}><PixelCat pose="idle" size={26} still /></View>;
}

function TypingDots() {
  const reduceMotion = useReducedMotion();
  return <View accessible accessibilityLabel="The assistant is writing a reply" accessibilityRole="progressbar" style={styles.dots}>{[0, 1, 2].map((index) => <Dot key={index} index={index} animate={!reduceMotion} />)}</View>;
}

function Dot({ index, animate }: { index: number; animate: boolean }) {
  const level = useSharedValue(animate ? 0.3 : 0.6);
  useEffect(() => {
    if (!animate) return undefined;
    level.value = withDelay(index * 150, withRepeat(withSequence(withTiming(1, { duration: 340 }), withTiming(0.3, { duration: 340 })), -1));
    return () => cancelAnimation(level);
  }, [animate, index, level]);
  const style = useAnimatedStyle(() => ({ opacity: level.value, transform: [{ translateY: (1 - level.value) * 2.5 }] }));
  return <Animated.View style={[styles.dot, style]} />;
}

function ProposalCard({ proposal, onPress }: { proposal?: ReviewProposal; onPress: () => void }) {
  if (!proposal) return <View style={styles.proposalDone}><Feather name="check-circle" size={15} color={colors.muted} /><Text style={styles.proposalDoneText}>These suggestions were already reviewed.</Text></View>;
  const items = proposal.organized.items;
  return <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.proposal}>
    <View style={styles.proposalHead}><Feather name="inbox" size={15} color={colors.accent} /><Text style={styles.proposalEyebrow}>Waiting for your confirmation</Text></View>
    <View style={styles.proposalItems}>{items.slice(0, 3).map((item, index) => { const kind = suggestionKindMeta(item.category); return <View key={`${item.category}-${index}`} style={styles.proposalItem}><View style={[styles.kindIcon, { backgroundColor: kind.soft }]}><Feather name={kind.icon} size={14} color={kind.color} /></View><Text numberOfLines={1} style={styles.proposalTitle}>{item.title}</Text><Text style={styles.proposalKind}>{kind.label}</Text></View>; })}</View>
    {items.length > 3 ? <Text style={styles.proposalMore}>+{items.length - 3} more</Text> : null}
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.proposalButton, pressed && styles.pressed]}><Text style={styles.proposalButtonText}>Review {items.length} {items.length === 1 ? 'change' : 'changes'}</Text><Feather name="arrow-right" size={16} color={colors.paper} /></Pressable>
  </Animated.View>;
}

const styles = themedStyles(() => ({
  headerButton: { width: 44, height: 44, marginRight: -8, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  hidden: { opacity: 0 },
  messageList: { flex: 1 },
  messages: { paddingTop: 4, paddingBottom: 18, gap: 14 },
  messagesEmpty: { flexGrow: 1, justifyContent: 'center' },
  userRow: { alignItems: 'flex-end', paddingLeft: 48 },
  userBubble: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, borderBottomRightRadius: 6, backgroundColor: colors.ink },
  userText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.paper },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingRight: 12 },
  assistantGrouped: { marginTop: -6 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  avatarSpacer: { width: 32 },
  assistantBody: { flex: 1, minWidth: 0, paddingTop: 4 },
  typing: { minHeight: 32, justifyContent: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 11, alignSelf: 'flex-start', borderRadius: 16, backgroundColor: colors.background },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.secondary },
  empty: { alignItems: 'center', paddingVertical: 12 },
  emptyTitle: { marginTop: 14, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5, color: colors.ink },
  emptyText: { maxWidth: 360, marginTop: 7, textAlign: 'center', fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.secondary },
  starters: { width: '100%', maxWidth: 520, marginTop: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  starter: { width: '48%', flexGrow: 1, minHeight: 56, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  starterPressed: { backgroundColor: colors.background },
  starterIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  starterText: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 17, color: colors.ink },
  privacy: { maxWidth: 360, marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
  privacyText: { flexShrink: 1, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.muted },
  proposal: { marginLeft: 42, padding: 14, gap: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  proposalHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  proposalEyebrow: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.accent },
  proposalItems: { gap: 8 },
  proposalItem: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  kindIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  proposalTitle: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  proposalKind: { fontFamily: fonts.body, fontSize: 11, color: colors.secondary },
  proposalMore: { marginLeft: 35, fontFamily: fonts.body, fontSize: 11, color: colors.secondary },
  proposalButton: { minHeight: 44, marginTop: 2, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, backgroundColor: colors.ink },
  proposalButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.paper },
  proposalDone: { marginLeft: 42, flexDirection: 'row', alignItems: 'center', gap: 7 },
  proposalDoneText: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  errorBox: { padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
  errorMain: { flex: 1, minWidth: 0 },
  errorText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.ink },
  errorActions: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 14 },
  retryButton: { minHeight: 34, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 17, backgroundColor: colors.ink },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.paper },
  textButton: { minHeight: 34, justifyContent: 'center' },
  retryLink: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  editText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.secondary },
  statusPill: { alignSelf: 'center', marginBottom: 8, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.full, backgroundColor: colors.accentSoft },
  status: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },
  voiceError: { marginBottom: 8, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
  composer: { minHeight: 56, paddingLeft: 16, paddingRight: 6, paddingVertical: 6, flexDirection: 'row', alignItems: 'flex-end', gap: 6, borderRadius: 28, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.paper },
  composerFocused: { borderColor: colors.ink },
  input: { flex: 1, minHeight: 42, maxHeight: 132, paddingTop: 11, paddingBottom: 11, fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: colors.ink, outlineStyle: 'none' } as never,
  composerActions: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 4 },
  counter: { marginRight: 4, fontFamily: fonts.bodyMedium, fontSize: 11, fontVariant: ['tabular-nums'], color: colors.mustard },
  mic: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  sendIdle: { backgroundColor: colors.border },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
}));
