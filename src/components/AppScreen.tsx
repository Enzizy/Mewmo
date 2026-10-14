import { PropsWithChildren, ReactElement, useCallback, useState } from 'react';
import { FlatList, KeyboardAvoidingView, ListRenderItem, Platform, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, motion, themedStyles } from '@/constants/theme';
import { useTheme } from '@/store/ThemeContext';

type FrameProps = { assistant?: boolean; tabbed?: boolean; background?: string; layout?: 'standard' | 'wide' };

export function AppScreen({ children, scroll = true, assistant = false, tabbed = false, docked = false, background = colors.background, layout = 'standard', onRefresh }: PropsWithChildren<FrameProps & {
  scroll?: boolean;
  /** For screens whose controls sit on the bottom edge, such as a chat composer. */
  docked?: boolean;
  /** Supplying this enables pull-to-refresh on the scrolling content. */
  onRefresh?: () => Promise<unknown>;
}>) {
  useTheme();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const { refreshing, refresh } = usePullToRefresh(onRefresh);
  const bottomSpacing = { paddingBottom: (docked ? (desktop ? 24 : 10) : desktop ? 48 : assistant || tabbed ? 112 : 40) + insets.bottom };
  const contentSpacing = desktop ? styles.desktopContent : undefined;
  const content = scroll ? (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, contentSpacing, bottomSpacing]}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.ink} colors={[colors.ink]} /> : undefined}
    >{children}</ScrollView>
  ) : <View style={[styles.content, contentSpacing, styles.fill, bottomSpacing]}>{children}</View>;

  return <Frame assistant={assistant} tabbed={tabbed} background={background} layout={layout} reduceMotion={reduceMotion}>{content}</Frame>;
}

/**
 * A screen whose body is one long record list. The page header travels as the
 * list header so rows stay virtualized instead of all mounting at once.
 */
export function AppListScreen<T>({ data, renderItem, keyExtractor, header, empty, assistant = false, tabbed = false, background = colors.background, layout = 'standard', onRefresh, estimatedRowHeight }: FrameProps & {
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
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const { refreshing, refresh } = usePullToRefresh(onRefresh);
  const bottomSpacing = { paddingBottom: (desktop ? 48 : assistant || tabbed ? 112 : 40) + insets.bottom };
  const contentSpacing = desktop ? styles.desktopContent : undefined;

  return (
    <Frame assistant={assistant} tabbed={tabbed} background={background} layout={layout} reduceMotion={reduceMotion}>
      <FlatList
        data={data as T[]}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={[styles.content, contentSpacing, bottomSpacing]}
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

function Frame({ children, assistant, tabbed, background = colors.background, layout = 'standard', reduceMotion }: PropsWithChildren<FrameProps & { reduceMotion: boolean }>) {
  void assistant;
  void tabbed;
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const frameWidth = desktop ? (layout === 'wide' ? 1360 : 960) : 640;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.base)} style={[styles.frame, { maxWidth: frameWidth }]}>{children}</Animated.View>
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
  desktopContent: { paddingHorizontal: 32, paddingTop: 30 },
}));
