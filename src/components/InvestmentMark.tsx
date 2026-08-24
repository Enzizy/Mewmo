import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/constants/theme';
import { InvestmentAsset } from '@/types';

type InvestmentMarkProps = {
  asset: InvestmentAsset;
  size?: number;
};

export function InvestmentMark({ asset, size = 36 }: InvestmentMarkProps) {
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

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center' },
  symbol: { fontFamily: fonts.bodyBold, lineHeight: undefined, color: colors.paper },
});
