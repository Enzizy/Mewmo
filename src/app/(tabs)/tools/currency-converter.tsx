import { useState } from 'react';
import { AppScreen } from '@/components/AppScreen';
import { InlineError, OptionStrip, PendingResult, ResultPanel, SwapButton, ToolAction, ToolNotice, ValueField } from '@/components/converter-ui';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { CurrencyCode, ExchangeRate, fetchExchangeRate } from '@/services/currencyApi';
import { parseNumericInput } from '@/utils/unit-converter';

const currencies: readonly CurrencyCode[] = ['PHP', 'USD', 'EUR', 'JPY', 'GBP'];

function formatCurrency(value: number, currency: CurrencyCode) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(value);
}

function formatRate(value: number) {
  return new Intl.NumberFormat(undefined, { maximumSignificantDigits: 7 }).format(value);
}

export default function CurrencyConverterScreen() {
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState<CurrencyCode>('PHP');
  const [to, setTo] = useState<CurrencyCode>('USD');
  const [rate, setRate] = useState<ExchangeRate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const clearResult = () => { setRate(null); setError(''); };
  const swap = () => { setFrom(to); setTo(from); clearResult(); };
  const selectFrom = (next: string) => {
    const currency = next as CurrencyCode;
    if (currency === to) setTo(from);
    setFrom(currency);
    clearResult();
  };
  const selectTo = (next: string) => {
    const currency = next as CurrencyCode;
    if (currency === from) setFrom(to);
    setTo(currency);
    clearResult();
  };

  const convert = async () => {
    const parsed = parseNumericInput(amount);
    if (parsed === null || parsed < 0) {
      setError('Enter a valid amount that is zero or greater.');
      setRate(null);
      return;
    }

    setLoading(true);
    setError('');
    try {
      setRate(await fetchExchangeRate(from, to));
    } catch (caught) {
      setRate(null);
      setError(caught instanceof Error ? caught.message : 'The exchange rate could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const parsedAmount = parseNumericInput(amount);
  const convertedAmount = rate && parsedAmount !== null ? parsedAmount * rate.rate : null;

  return <AppScreen tabbed>
    <ScreenHeader back />
    <PageHeader title="Currency Converter" supporting="Convert with a current rate and a visible update time." />
    <ToolNotice icon="wifi">Rates come from Twelve Data through your private LifeDesk server. Valid pairs are cached for 10 minutes to protect your free API allowance.</ToolNotice>
    <ValueField label={`Amount in ${from}`} value={amount} onChangeText={(next) => { setAmount(next); setError(''); }} placeholder="0.00" />
    <OptionStrip label="From currency" values={currencies} selected={from} onSelect={selectFrom} />
    <SwapButton onPress={swap} label="Swap source and destination currencies" />
    <OptionStrip label="To currency" values={currencies} selected={to} onSelect={selectTo} />
    {error ? <InlineError message={error} /> : null}
    {rate && convertedAmount !== null ? <ResultPanel
      eyebrow={`${from} to ${to}`}
      value={formatCurrency(convertedAmount, to)}
      detail={`1 ${from} = ${formatRate(rate.rate)} ${to} · ${rate.source} · Updated ${new Date(rate.asOf).toLocaleString()}`}
    /> : <PendingResult title="Ready for a current rate" detail={`Enter an amount, then load the ${from} to ${to} rate. The provider and update time will stay visible with the result.`} />}
    <ToolAction label="Convert currency" onPress={convert} loading={loading} icon="refresh-cw" />
  </AppScreen>;
}
