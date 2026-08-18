import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { PixelCat } from '@/components/PixelCat';
import { colors, fonts } from '@/constants/theme';
import { isNotificationRuntimeAvailable } from '@/services/notifications';
import { checkOrganizerHealth, getOrganizerApiUrl } from '@/services/organizerApi';
import { useItems } from '@/store/ItemsContext';

export default function ProfileScreen() {
  const [aiStatus, setAiStatus] = useState('Checking...');
  const notificationRuntimeAvailable = isNotificationRuntimeAvailable();
  const { items, dumps, projects, transactions, notificationEnabled, rewardsEnabled, level, totalXp, setNotificationEnabled, setRewardsEnabled, exportData } = useItems();
  const checkAi = () => checkOrganizerHealth().then((result) => setAiStatus(result.message));
  useEffect(() => { checkAi(); }, []);

  const shareExport = async () => {
    try {
      const contents = await exportData();
      const path = `${FileSystem.documentDirectory}mewmo-export-${new Date().toISOString().slice(0, 10)}.json`;
      await FileSystem.writeAsStringAsync(path, contents);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Export Mewmo data' });
      else Alert.alert('Export saved', path);
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Your data could not be exported.');
    }
  };

  return (
    <AppScreen bottomNav background={colors.paper}>
      <View style={styles.top}><View style={styles.identity}><Text style={styles.title}>PROFILE</Text><Text style={styles.name}>Zhyronne Batican</Text><Text style={styles.subline}>LV. {String(level).padStart(2, '0')} · {totalXp} XP</Text></View><PixelCat pose="idle" size={88} speech="HELLO" /></View>
      {!getOrganizerApiUrl() ? <View style={styles.notice}><Feather name="alert-circle" size={17} color={colors.accent} /><Text selectable style={styles.noticeText}>Add EXPO_PUBLIC_MEWMO_API_URL to .env to enable Gemini processing.</Text></View> : null}

      <Section title="PREFERENCES">
        <Setting icon="bell" label="Notifications" detail={notificationRuntimeAvailable ? 'Due-date reminders' : 'Development build required'}><Switch accessibilityLabel="Notifications" disabled={!notificationRuntimeAvailable} value={notificationRuntimeAvailable && notificationEnabled} onValueChange={setNotificationEnabled} trackColor={{ false: colors.borderStrong, true: colors.accent }} thumbColor={colors.surface} /></Setting>
        <Setting icon="award" label="Momentum and XP" detail="Optional, never punitive"><Switch accessibilityLabel="Momentum and XP" value={rewardsEnabled} onValueChange={setRewardsEnabled} trackColor={{ false: colors.borderStrong, true: colors.accent }} thumbColor={colors.surface} /></Setting>
        <Setting icon="move" label="Cat motion" detail="Respects device reduced motion" />
      </Section>

      <Section title="DATA & PRIVACY">
        <Action icon="cpu" label="Gemini connection" detail={aiStatus} onPress={checkAi} />
        <Action icon="download" label="Export all data" detail="Portable JSON backup" onPress={shareExport} />
        <Setting icon="hard-drive" label="Local storage" detail={`${dumps.length} recordings · ${items.length} items · ${projects.length} projects · ${transactions.length} money records`} />
        <Action icon="shield" label="Privacy" detail="Audio is sent only when you process it" onPress={() => Alert.alert('Privacy', 'Your records are stored locally in SQLite. Voice audio is sent to your configured Gemini backend only for processing. Financial suggestions require your review before they are saved.')} />
      </Section>

      <Section title="ABOUT">
        <Setting icon="heart" label="Mascot" detail="Your black pixel cat" />
        <Setting icon="info" label="Mewmo" detail="Version 1.0.0 · Expo 57" />
      </Section>
    </AppScreen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.rows}>{children}</View></View>; }
function Setting({ icon, label, detail, children }: { icon: keyof typeof Feather.glyphMap; label: string; detail: string; children?: React.ReactNode }) { return <View style={styles.row}><Feather name={icon} size={18} color={colors.ink} /><View style={styles.rowMain}><Text style={styles.label}>{label}</Text><Text numberOfLines={2} style={styles.detail}>{detail}</Text></View>{children}</View>; }
function Action({ icon, label, detail, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; detail: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}><Feather name={icon} size={18} color={colors.ink} /><View style={styles.rowMain}><Text style={styles.label}>{label}</Text><Text numberOfLines={2} style={styles.detail}>{detail}</Text></View><Feather name="chevron-right" size={18} color={colors.secondary} /></Pressable>; }

const styles = StyleSheet.create({
  top: { minHeight: 130, flexDirection: 'row', alignItems: 'center' }, identity: { flex: 1 }, title: { fontFamily: fonts.pixelBold, fontSize: 30, color: colors.ink }, name: { marginTop: 8, fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink }, subline: { marginTop: 4, fontFamily: fonts.pixel, fontSize: 11, color: colors.accent },
  notice: { padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentSoft }, noticeText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.ink },
  section: { marginTop: 28 }, sectionTitle: { marginBottom: 8, fontFamily: fonts.pixelSemiBold, fontSize: 13, color: colors.secondary }, rows: { borderTopWidth: 1, borderTopColor: colors.borderStrong }, row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: colors.border }, rowMain: { flex: 1 }, label: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink }, detail: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary },
});
