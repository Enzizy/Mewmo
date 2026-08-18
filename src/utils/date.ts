export function dateLabelFor(dateInput: string | Date, now = new Date()) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return 'No date';
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const difference = Math.round((startDate.getTime() - startToday.getTime()) / 86_400_000);
  if (difference === 0) return 'Today';
  if (difference === -1) return 'Yesterday';
  if (difference === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

export function timeLabelFor(dateInput: string | Date) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

export function relativeDateTimeLabel(dateInput: string | Date) {
  const date = new Date(dateInput);
  return `${dateLabelFor(date)}, ${timeLabelFor(date)}`;
}

export function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
