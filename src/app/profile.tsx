import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Linking, Platform, Pressable, Switch, Text, View } from 'react-native';
import { useAppDialog } from '@/components/AppDialog';
import { useAppLock } from '@/components/AppLockGate';
import { isAppLockSupportedPlatform } from '@/services/appLock';
import { AppScreen } from '@/components/AppScreen';
import { PixelCat } from '@/components/PixelCat';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PageHeader } from '@/components/page-header';
import { APP_NAME } from '@/constants/brand';
import { colors, fonts, radius, themedStyles, type ThemePreference } from '@/constants/theme';
import { isNotificationRuntimeAvailable, NotificationPermissionError } from '@/services/notifications';
import { checkOrganizerHealth, getOrganizerApiUrl } from '@/services/organizerApi';
import { useItems } from '@/store/ItemsContext';
import { useTheme } from '@/store/ThemeContext';

export default function ProfileScreen() {
  const { theme, preference, setPreference } = useTheme();
  const router = useRouter();
  const { showDialog } = useAppDialog();
  const [aiStatus, setAiStatus] = useState('Checking...');
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const notificationRuntimeAvailable = isNotificationRuntimeAvailable();
  const { items, dumps, projects, transactions, notificationEnabled, cardRemindersEnabled, weeklyReviewReminderEnabled, setNotificationEnabled, setCardRemindersEnabled, setWeeklyReviewReminderEnabled, exportData, importData } = useItems();
  const { lockEnabled, setLockEnabled } = useAppLock();
  const [lockSaving, setLockSaving] = useState(false);
  const changeLock = async (enabled: boolean) => {
    setLockSaving(true);
    try {
      const result = await setLockEnabled(enabled);
      if (!result.ok && result.message) showDialog({ title: 'App lock is not on', message: result.message, tone: 'warning' });
    } finally { setLockSaving(false); }
  };
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
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `lifedesk-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      const path = `${FileSystem.documentDirectory}lifedesk-export-${new Date().toISOString().slice(0, 10)}.json`;
      await FileSystem.writeAsStringAsync(path, contents);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: `Export ${APP_NAME} data` });
      else showDialog({ title: 'Export saved', message: path, tone: 'success' });
    } catch (error) {
      showDialog({ title: 'Export failed', message: error instanceof Error ? error.message : 'Your data could not be exported.', tone: 'danger' });
    }
  };

  const runRestore = async (uri: string, webFile?: File) => {
    setRestoring(true);
    try {
      const contents = webFile ? await webFile.text() : await FileSystem.readAsStringAsync(uri);
      const summary = await importData(contents);
      const skipped = summary.skipped ? ` ${summary.skipped} unreadable ${summary.skipped === 1 ? 'record was' : 'records were'} skipped.` : '';
      showDialog({
        title: 'Restore complete',
        message: `Restored ${summary.restored} records (${summary.description}) from the backup taken ${new Date(summary.exportedAt).toLocaleString()}.${skipped}`,
        tone: 'success',
      });
    } catch (error) {
      showDialog({ title: 'Restore failed', message: error instanceof Error ? error.message : 'That backup could not be restored. Your existing records were left unchanged.', tone: 'danger' });
    } finally {
      setRestoring(false);
    }
  };

  const chooseBackup = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
      const file = picked.assets?.[0];
      if (picked.canceled || !file) return;
      showDialog({
        title: 'Replace all local data?',
        message: `Restoring “${file.name}” deletes every record currently on this device and replaces it with the backup's contents. This cannot be undone. Export first if you are not sure.`,
        tone: 'danger',
        actions: [
          { label: 'Cancel', variant: 'secondary' },
          { label: 'Replace everything', variant: 'danger', onPress: () => void runRestore(file.uri, file.file) },
        ],
      });
    } catch (error) {
      showDialog({ title: 'Could not open that file', message: error instanceof Error ? error.message : 'Choose a LifeDesk export file.', tone: 'danger' });
    }
  };

  return (
    <AppScreen background={colors.background}>
      <ScreenHeader back />
      <PageHeader title="Settings" supporting="Preferences, connections, and local data." action={<PixelCat pose="idle" size={64} />} />
      {!getOrganizerApiUrl() ? <View style={styles.notice}><Feather name="alert-circle" size={17} color={colors.accent} /><Text selectable style={styles.noticeText}>The Assistant server is not configured for this build. Chat and voice requests are unavailable.</Text></View> : null}

      <Section title="Profile">
        <Setting icon="user" label="Zhyronne Batican" detail="Your personal workspace" />
      </Section>

      <Section title="Reflect">
        <Action icon="sunrise" label="Weekly review" detail="What got done, where money went, and what is coming up" onPress={() => router.push('/weekly-review')} />
      </Section>

      <Section title="Preferences">
        <View style={styles.row}>
          <Feather name={theme === 'dark' ? 'moon' : 'sun'} size={18} color={colors.ink} />
          <View style={styles.rowMain}>
            <Text style={styles.label}>Appearance</Text>
            <Text style={styles.detail}>{preference === 'system' ? `Following your device, currently ${theme}` : `Always ${preference}`}</Text>
          </View>
        </View>
        <View accessibilityRole="radiogroup" style={styles.themeChoices}>
          {THEME_CHOICES.map((choice) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: preference === choice.value }}
              key={choice.value}
              onPress={() => setPreference(choice.value)}
              style={({ pressed }) => [styles.themeChoice, preference === choice.value && styles.themeChoiceActive, pressed && styles.themeChoicePressed]}
            >
              <Feather name={choice.icon} size={16} color={preference === choice.value ? colors.paper : colors.ink} />
              <Text style={[styles.themeChoiceLabel, preference === choice.value && styles.themeChoiceLabelActive]}>{choice.label}</Text>
            </Pressable>
          ))}
        </View>
        <Setting icon="bell" label="Notifications" detail={notificationSaving ? 'Updating reminder schedules…' : notificationRuntimeAvailable ? 'Due-date reminders on this device' : 'Available in the installed mobile app'}><Switch accessibilityLabel="Notifications" accessibilityHint="Schedules or cancels due-date reminders on this device" disabled={!notificationRuntimeAvailable || notificationSaving} value={notificationRuntimeAvailable && notificationEnabled} onValueChange={(enabled) => void changeNotifications(enabled)} trackColor={{ false: colors.borderStrong, true: colors.accent }} thumbColor={colors.surface} /></Setting>
        <Setting icon="credit-card" label="Card payment reminders" detail={!notificationRuntimeAvailable ? 'Available in the installed mobile app' : notificationEnabled ? '3 days before and on each credit card due date, at 9 AM' : 'Turn on Notifications above to get these'}><Switch accessibilityLabel="Card payment reminders" disabled={!notificationRuntimeAvailable || !notificationEnabled} value={notificationRuntimeAvailable && notificationEnabled && cardRemindersEnabled} onValueChange={setCardRemindersEnabled} trackColor={{ false: colors.borderStrong, true: colors.accent }} thumbColor={colors.surface} /></Setting>
        <Setting icon="calendar" label="Weekly review reminder" detail={!notificationRuntimeAvailable ? 'Available in the installed mobile app' : notificationEnabled ? 'Sundays at 6 PM' : 'Turn on Notifications above to get this'}><Switch accessibilityLabel="Weekly review reminder" disabled={!notificationRuntimeAvailable || !notificationEnabled} value={notificationRuntimeAvailable && notificationEnabled && weeklyReviewReminderEnabled} onValueChange={setWeeklyReviewReminderEnabled} trackColor={{ false: colors.borderStrong, true: colors.accent }} thumbColor={colors.surface} /></Setting>
        {Platform.OS === 'android' ? <Action icon="layout" label="Android widget" detail="Choose whether the home-screen widget may show your balance" onPress={() => router.push('/home-customize')} /> : null}
      </Section>

      <Section title="Data and privacy">
        <Setting icon="lock" label="App lock" detail={!isAppLockSupportedPlatform() ? 'Available in the phone app' : lockSaving ? 'Confirm it is you…' : lockEnabled ? 'Asks for your fingerprint, face, or PIN when you open LifeDesk' : 'Require your fingerprint, face, or PIN to open LifeDesk'}><Switch accessibilityLabel="App lock" accessibilityHint="Requires your phone's fingerprint, face, or PIN to open LifeDesk" disabled={!isAppLockSupportedPlatform() || lockSaving} value={lockEnabled} onValueChange={(enabled) => void changeLock(enabled)} trackColor={{ false: colors.borderStrong, true: colors.accent }} thumbColor={colors.surface} /></Setting>
        <Action icon="cpu" label="Check Assistant connection" detail={aiStatus} onPress={() => void checkAi()} />
        <Action icon="download" label="Export data archive" detail="JSON copy of every local record, for safekeeping" onPress={shareExport} />
        <Action icon="upload" label={restoring ? 'Restoring backup…' : 'Restore from backup'} detail={restoring ? 'Rebuilding your local records' : 'Replaces all local data with a LifeDesk export file'} onPress={() => { if (!restoring) void chooseBackup(); }} />
        <Setting icon="hard-drive" label="Local storage" detail={`${dumps.length} recordings · ${items.length} items · ${projects.length} projects · ${transactions.length} money records`} />
        <Action icon="shield" label="Privacy" detail="See what stays local and what goes to the Assistant" onPress={() => showDialog({ title: 'Privacy', message: 'Your records are stored on this device. When you use the Assistant, your message or voice note and relevant saved records are sent to your configured Gemini backend. Suggested changes require your confirmation before they are saved.', tone: 'info' })} />
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

const THEME_CHOICES: { value: ThemePreference; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: 'system', label: 'System', icon: 'smartphone' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

const styles = themedStyles(() => ({
  notice: { marginTop: 22, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, backgroundColor: colors.accentSoft }, noticeText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.ink },
  themeChoices: { paddingVertical: 12, flexDirection: 'row', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  themeChoice: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  themeChoiceActive: { borderColor: colors.ink, backgroundColor: colors.ink },
  themeChoicePressed: { opacity: 0.72 },
  themeChoiceLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  themeChoiceLabelActive: { color: colors.paper },
  section: { marginTop: 30 }, sectionTitle: { marginBottom: 10, fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink }, rows: { borderTopWidth: 1, borderTopColor: colors.border }, row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: colors.border }, rowMain: { flex: 1 }, label: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink }, detail: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.secondary },
}));
