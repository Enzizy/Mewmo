import { PropsWithChildren, ReactElement, useCallback, useState } from 'react';
import { FlatList, KeyboardAvoidingView, ListRenderItem, Platform, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, motion, themedStyles } from '@/constants/theme';
import { useTheme } from '@/store/ThemeContext';

type FrameProps = { assistant?: boolean; tabbed?: boolean; background?: string };

export function AppScreen({ children, scroll = true, assistant = false, tabbed = false, background = colors.background, onRefresh }: PropsWithChildren<FrameProps & {
  scroll?: boolean;
  /** Supplying this enables pull-to-refresh on the scrolling content. */
  onRefresh?: () => Promise<unknown>;
}>) {
  useTheme();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { refreshing, refresh } = usePullToRefresh(onRefresh);
  const bottomSpacing = { paddingBottom: (assistant || tabbed ? 112 : 40) + insets.bottom };
  const content = scroll ? (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, bottomSpacing]}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.ink} colors={[colors.ink]} /> : undefined}
    >{children}</ScrollView>
  ) : <View style={[styles.content, styles.fill, bottomSpacing]}>{children}</View>;

  return <Frame assistant={assistant} tabbed={tabbed} background={background} reduceMotion={reduceMotion}>{content}</Frame>;
}

/**
 * A screen whose body is one long record list. The page header travels as the
 * list header so rows stay virtualized instead of all mounting at once.
 */
export function AppListScreen<T>({ data, renderItem, keyExtractor, header, empty, assistant = false, tabbed = false, background = colors.background, onRefresh, estimatedRowHeight }: FrameProps & {
  data: readonly T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  header?: ReactElement;
  empty?: ReactElement;
  onRefresh?: () => Promise<unknown>;
  /** Lets the list jump to an offset without measuring every row first. */
  estimatedRowHeight?: number;
}) {
  useTheme();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { refreshing, refresh } = usePullToRefresh(onRefresh);
  const bottomSpacing = { paddingBottom: (assistant || tabbed ? 112 : 40) + insets.bottom };

  return (
    <Frame assistant={assistant} tabbed={tabbed} background={background} reduceMotion={reduceMotion}>
      <FlatList
        data={data as T[]}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={[styles.content, bottomSpacing]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
        getItemLayout={estimatedRowHeight
          ? (_, index) => ({ length: estimatedRowHeight, offset: estimatedRowHeight * index, index })
          : undefined}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.ink} colors={[colors.ink]} /> : undefined}
      />
    </Frame>
  );
}

function Frame({ children, assistant, tabbed, background = colors.background, reduceMotion }: PropsWithChildren<FrameProps & { reduceMotion: boolean }>) {
  void assistant;
  void tabbed;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.base)} style={styles.frame}>{children}</Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function usePullToRefresh(onRefresh?: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(() => {
    if (!onRefresh) return;
    setRefreshing(true);
    void Promise.resolve(onRefresh()).catch(() => undefined).finally(() => setRefreshing(false));
  }, [onRefresh]);
  return { refreshing, refresh };
}

const styles = themedStyles(() => ({
  safe: { flex: 1 },
  fill: { flex: 1 },
  frame: { width: '100%', maxWidth: 640, flex: 1, alignSelf: 'center' },
  content: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 40 },
}));
