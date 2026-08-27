import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useAppDialog } from '@/components/AppDialog';
import { AppScreen } from '@/components/AppScreen';
import { PixelCat } from '@/components/PixelCat';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PageHeader } from '@/components/page-header';
import { APP_NAME } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';
import { isNotificationRuntimeAvailable, NotificationPermissionError } from '@/services/notifications';
import { checkOrganizerHealth, getOrganizerApiUrl } from '@/services/organizerApi';
import { useItems } from '@/store/ItemsContext';

export default function ProfileScreen() {
  const { showDialog } = useAppDialog();
  const [aiStatus, setAiStatus] = useState('Checking...');
  const [notificationSaving, setNotificationSaving] = useState(false);
  const notificationRuntimeAvailable = isNotificationRuntimeAvailable();
  const { items, dumps, projects, transactions, notificationEnabled, rewardsEnabled, level, totalXp, setNotificationEnabled, setRewardsEnabled, exportData } = useItems();
  const checkAi = async () => {
    setAiStatus('Checking protected connection…');
    const result = await checkOrganizerHealth();
    setAiStatus(result.message);
  };
  useEffect(() => { checkAi(); }, []);

  const changeNotifications = async (enabled: boolean) => {
    setNotificationSaving(true);
    try {
      await setNotificationEnabled(enabled);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Notification settings could not be updated.';
      showDialog({
        title: 'Could not enable notifications',
        message,
        tone: 'warning',
        actions: error instanceof NotificationPermissionError
          ? [{ label: 'Not now', variant: 'secondary' }, { label: 'Open settings', onPress: () => Linking.openSettings() }]
          : undefined,
      });
    } finally {
      setNotificationSaving(false);
    }
  };

  const shareExport = async () => {
    try {
      const contents = await exportData();
      const path = `${FileSystem.documentDirectory}lifedesk-export-${new Date().toISOString().slice(0, 10)}.json`;
      await FileSystem.writeAsStringAsync(path, contents);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: `Export ${APP_NAME} data` });
      else showDialog({ title: 'Export saved', message: path, tone: 'success' });
    } catch (error) {
      showDialog({ title: 'Export failed', message: error instanceof Error ? error.message : 'Your data could not be exported.', tone: 'danger' });
    }
  };

  return (
    <AppScreen background={colors.background}>
      <ScreenHeader back />
      <PageHeader title="Settings" supporting="Preferences, connections, and local data." action={<PixelCat pose="idle" size={64} />} />
      {!getOrganizerApiUrl() ? <View style={styles.notice}><Feather name="alert-circle" size={17} color={colors.accent} /><Text selectable style={styles.noticeText}>Add EXPO_PUBLIC_LIFEDESK_API_URL to .env to enable Gemini processing.</Text></View> : null}

      <Section title="Profile">
        <Setting icon="user" label="Zhyronne Batican" detail={`Level ${String(level).padStart(2, '0')} · ${totalXp} XP`} />
      </Section>

      <Section title="Preferences">
        <Setting icon="bell" label="Notifications" detail={notificationSaving ? 'Updating reminder schedules…' : notificationRuntimeAvailable ? 'Due-date reminders on this device' : 'Available in the installed mobile app'}><Switch accessibilityLabel="Notifications" accessibilityHint="Schedules or cancels due-date reminders on this device" disabled={!notificationRuntimeAvailable || notificationSaving} value={notificationRuntimeAvailable && notificationEnabled} onValueChange={(enabled) => void changeNotifications(enabled)} trackColor={{ false: colors.borderStrong, true: colors.accent }} thumbColor={colors.surface} /></Setting>
        <Setting icon="award" label="Momentum and XP" detail="Optional, never punitive"><Switch accessibilityLabel="Momentum and XP" value={rewardsEnabled} onValueChange={setRewardsEnabled} trackColor={{ false: colors.borderStrong, true: colors.accent }} thumbColor={colors.surface} /></Setting>
      </Section>

      <Section title="Data and privacy">
        <Action icon="cpu" label="Check AI connection" detail={aiStatus} onPress={() => void checkAi()} />
        <Action icon="download" label="Export data archive" detail="JSON copy for safekeeping; restore is not yet supported" onPress={shareExport} />
        <Setting icon="hard-drive" label="Local storage" detail={`${dumps.length} recordings · ${items.length} items · ${projects.length} projects · ${transactions.length} money records`} />
        <Action icon="shield" label="Privacy" detail="Audio is sent only when you process it" onPress={() => showDialog({ title: 'Privacy', message: 'Your records are stored locally in SQLite. Voice audio is sent to your configured Gemini backend only for processing. Financial suggestions require your review before they are saved.', tone: 'info' })} />
      </Section>

      <Section title="About">
        <Setting icon="info" label={APP_NAME} detail="Version 1.0.0 · Expo 57" />
      </Section>
    </AppScreen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.rows}>{children}</View></View>; }
function Setting({ icon, label, detail, children }: { icon: keyof typeof Feather.glyphMap; label: string; detail: string; children?: React.ReactNode }) { return <View style={styles.row}><Feather name={icon} size={18} color={colors.ink} /><View style={styles.rowMain}><Text style={styles.label}>{label}</Text><Text numberOfLines={2} style={styles.detail}>{detail}</Text></View>{children}</View>; }
function Action({ icon, label, detail, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; detail: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}><Feather name={icon} size={18} color={colors.ink} /><View style={styles.rowMain}><Text style={styles.label}>{label}</Text><Text numberOfLines={2} style={styles.detail}>{detail}</Text></View><Feather name="chevron-right" size={18} color={colors.secondary} /></Pressable>; }

const styles = StyleSheet.create({
  notice: { marginTop: 22, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, backgroundColor: colors.accentSoft }, noticeText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.ink },
  section: { marginTop: 30 }, sectionTitle: { marginBottom: 10, fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink }, rows: { borderTopWidth: 1, borderTopColor: colors.border }, row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: colors.border }, rowMain: { flex: 1 }, label: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink }, detail: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary },
});
