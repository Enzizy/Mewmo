import { Feather } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { PixelCat } from '@/components/PixelCat';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts } from '@/constants/theme';
import { askPersonalAssistant, AssistantMessage } from '@/services/assistantApi';
import { useItems } from '@/store/ItemsContext';

const suggestions = ['What is on my schedule?', 'How much are my investments worth?', 'How is my grocery budget?'];

export default function ChatScreen() {
  const data = useItems();
  const [messages, setMessages] = useState<AssistantMessage[]>([{ role: 'assistant', text: 'Ask me about your confirmed schedule, projects, budget, or investments.' }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async (question = input) => {
    const text = question.trim();
    if (!text || sending) return;
    const previous = messages;
    setMessages([...previous, { role: 'user', text }]);
    setInput('');
    setSending(true);
    try {
      const answer = await askPersonalAssistant(text, previous, data);
      setMessages((current) => [...current, { role: 'assistant', text: answer }]);
    } catch (error) {
      Alert.alert('Assistant unavailable', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSending(false);
    }
  };

  return <AppScreen scroll={false} background={colors.paper}>
    <ScreenHeader back title="ASK MY CAT" />
    <View style={styles.intro}><PixelCat pose="curious" size={66} speech="ASK AWAY" /><Text style={styles.privacy}>Your question and a summary of confirmed app records are sent to Gemini. Voice recordings and transcripts are not included.</Text></View>
    <ScrollView ref={scrollRef} style={styles.messageList} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })} contentContainerStyle={styles.messages} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled">
      {messages.map((message, index) => <View key={`${message.role}-${index}`} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.catBubble]}><Text selectable style={[styles.message, message.role === 'user' && styles.userMessage]}>{message.text}</Text></View>)}
      {sending ? <View style={[styles.bubble, styles.catBubble, styles.loading]}><ActivityIndicator size="small" color={colors.ink} /><Text style={styles.thinking}>CHECKING YOUR RECORDS...</Text></View> : null}
    </ScrollView>
    {!messages.some((message) => message.role === 'user') ? <View style={styles.suggestions}>{suggestions.map((suggestion) => <Pressable key={suggestion} onPress={() => send(suggestion)} style={styles.suggestion}><Text style={styles.suggestionText}>{suggestion}</Text></Pressable>)}</View> : null}
    <View style={styles.composer}><TextInput accessibilityLabel="Ask a personal question" value={input} onChangeText={setInput} onSubmitEditing={() => send()} returnKeyType="send" placeholder="Ask about your life..." placeholderTextColor={colors.muted} style={styles.input} /><Pressable accessibilityLabel="Send question" disabled={sending || !input.trim()} onPress={() => send()} style={[styles.send, (sending || !input.trim()) && styles.disabled]}><Feather name="arrow-up" size={20} color={colors.surface} /></Pressable></View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  intro: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  privacy: { marginTop: 8, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary },
  messageList: { flex: 1 },
  messages: { paddingVertical: 16, gap: 10 },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1 },
  catBubble: { alignSelf: 'flex-start', borderColor: colors.borderStrong, backgroundColor: colors.surface },
  userBubble: { alignSelf: 'flex-end', borderColor: colors.ink, backgroundColor: colors.ink },
  message: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  userMessage: { color: colors.surface },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thinking: { fontFamily: fonts.pixelSemiBold, fontSize: 10, color: colors.secondary },
  suggestions: { paddingVertical: 10, gap: 7 },
  suggestion: { minHeight: 42, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong },
  suggestionText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },
  composer: { paddingTop: 10, paddingBottom: 8, flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.borderStrong, fontFamily: fonts.body, fontSize: 14, color: colors.ink, backgroundColor: colors.surface },
  send: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  disabled: { opacity: 0.35 },
});
