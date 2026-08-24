import { Alert, Platform } from 'react-native';

export function confirmAction({ title, message, confirmLabel, cancelLabel = 'Cancel', onConfirm }: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
}) {
  if (Platform.OS === 'web') {
    const confirm = (globalThis as typeof globalThis & { confirm?: (value?: string) => boolean }).confirm;
    if (confirm?.(`${title}\n\n${message}`)) void onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: () => void onConfirm() },
  ]);
}
