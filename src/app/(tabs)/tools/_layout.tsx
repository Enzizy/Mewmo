import { Stack } from 'expo-router/stack';
import { colors } from '@/constants/theme';

export default function ToolsLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.background } }} />;
}
