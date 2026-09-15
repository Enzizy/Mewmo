import { Text, View } from 'react-native';
import { colors, fonts, themedStyles } from '@/constants/theme';
import { InvestmentAsset } from '@/types';
import { useTheme } from '@/store/ThemeContext';

type InvestmentMarkProps = {
  asset: InvestmentAsset;
  size?: number;
};

export function InvestmentMark({ asset, size = 36 }: InvestmentMarkProps) {
  useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: asset === 'BTC' ? colors.bitcoin : colors.vanguard,
        },
      ]}
    >
      <Text style={[styles.symbol, { fontSize: size * (asset === 'BTC' ? 0.53 : 0.43) }]}>
        {asset === 'BTC' ? '₿' : 'V'}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  mark: { alignItems: 'center', justifyContent: 'center' },
  symbol: { fontFamily: fonts.bodyBold, lineHeight: undefined, color: colors.paper },
}));
