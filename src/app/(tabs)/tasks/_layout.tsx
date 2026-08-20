import { Stack } from 'expo-router/stack';
import { colors } from '@/constants/theme';

export default function TasksLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.background } }} />;
}
