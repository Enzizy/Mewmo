import { Stack } from 'expo-router/stack';
import { colors } from '@/constants/theme';

export default function WalletLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.background } }} />;
}
