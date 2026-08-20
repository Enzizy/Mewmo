import { useState } from 'react';
import { AppScreen } from '@/components/AppScreen';
import { InlineError, OptionStrip, PendingResult, ResultPanel, SwapButton, ToolNotice, ValueField } from '@/components/converter-ui';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { UNIT_GROUPS, UnitCategory, convertUnit, formatConvertedValue, parseNumericInput } from '@/utils/unit-converter';

const categories = Object.keys(UNIT_GROUPS) as UnitCategory[];

export default function UnitConverterScreen() {
  const [category, setCategory] = useState<UnitCategory>('Length');
  const [value, setValue] = useState('');
  const [from, setFrom] = useState('Meters');
  const [to, setTo] = useState('Feet');
  const selectCategory = (next: string) => {
    const typed = next as UnitCategory;
    setCategory(typed);
    setFrom(UNIT_GROUPS[typed][0]);
    setTo(UNIT_GROUPS[typed][1]);
  };
  const swap = () => { setFrom(to); setTo(from); };
  const selectFrom = (next: string) => { if (next === to) setTo(from); setFrom(next); };
  const selectTo = (next: string) => { if (next === from) setFrom(to); setTo(next); };

  const parsedValue = parseNumericInput(value);
  const convertedValue = parsedValue === null ? null : convertUnit(category, parsedValue, from, to);
  const invalid = value.trim().length > 0 && parsedValue === null;

  return <AppScreen tabbed>
    <ScreenHeader back />
    <PageHeader title="Unit Converter" supporting="Quick, private conversions for everyday and technical units." />
    <ToolNotice icon="smartphone">Calculations run entirely on your device. Data conversions use decimal units: 1 GB equals 1,000 MB.</ToolNotice>
    <OptionStrip label="Measurement type" values={categories} selected={category} onSelect={selectCategory} />
    <ValueField label={`Value in ${from}`} value={value} onChangeText={setValue} placeholder="0" />
    <OptionStrip label="From unit" values={UNIT_GROUPS[category]} selected={from} onSelect={selectFrom} />
    <SwapButton onPress={swap} label="Swap source and destination units" />
    <OptionStrip label="To unit" values={UNIT_GROUPS[category]} selected={to} onSelect={selectTo} />
    {invalid ? <InlineError message="Enter a valid number. Commas and decimal values are supported." /> : null}
    {convertedValue !== null ? <ResultPanel
      eyebrow={`${from} to ${to}`}
      value={`${formatConvertedValue(convertedValue)} ${to}`}
      detail={`${formatConvertedValue(parsedValue ?? 0)} ${from} equals ${formatConvertedValue(convertedValue)} ${to}.`}
    /> : <PendingResult title="Start typing to convert" detail={`Your ${from} to ${to} result will update instantly without using an internet connection.`} />}
  </AppScreen>;
}
