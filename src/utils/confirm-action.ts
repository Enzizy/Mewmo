import { AppDialogOptions } from '@/components/AppDialog';

export function confirmAction({ title, message, confirmLabel, cancelLabel = 'Cancel', onConfirm }: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
}): AppDialogOptions {
  return {
    title,
    message,
    tone: 'danger',
    dismissible: true,
    actions: [
      { label: cancelLabel, variant: 'secondary' },
      { label: confirmLabel, variant: 'danger', onPress: onConfirm },
    ],
  };
}
