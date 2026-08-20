export const UNIT_GROUPS = {
  Length: ['Meters', 'Kilometers', 'Feet', 'Miles'],
  Weight: ['Grams', 'Kilograms', 'Pounds', 'Ounces'],
  Temperature: ['Celsius', 'Fahrenheit', 'Kelvin'],
  Data: ['MB', 'GB', 'TB'],
} as const;

export type UnitCategory = keyof typeof UNIT_GROUPS;

const linearFactors: Record<Exclude<UnitCategory, 'Temperature'>, Record<string, number>> = {
  Length: { Meters: 1, Kilometers: 1_000, Feet: 0.3048, Miles: 1_609.344 },
  Weight: { Grams: 0.001, Kilograms: 1, Pounds: 0.45359237, Ounces: 0.028349523125 },
  Data: { MB: 1_000_000, GB: 1_000_000_000, TB: 1_000_000_000_000 },
};

export function parseNumericInput(input: string) {
  const normalized = input.trim().replaceAll(',', '');
  if (!normalized || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && Math.abs(value) <= 1e15 ? value : null;
}

export function convertUnit(category: UnitCategory, value: number, from: string, to: string) {
  if (!Number.isFinite(value)) throw new Error('Enter a valid finite value.');
  if (!UNIT_GROUPS[category]?.includes(from as never) || !UNIT_GROUPS[category]?.includes(to as never)) throw new Error('Choose units from the same measurement type.');
  if (from === to) return value;
  if (category === 'Temperature') return fromCelsius(toCelsius(value, from), to);
  const factors = linearFactors[category];
  return value * factors[from] / factors[to];
}

export function formatConvertedValue(value: number) {
  if (!Number.isFinite(value)) return 'Outside supported range';
  return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 10 }).format(value);
}

function toCelsius(value: number, unit: string) {
  if (unit === 'Celsius') return value;
  if (unit === 'Fahrenheit') return (value - 32) * 5 / 9;
  return value - 273.15;
}

function fromCelsius(value: number, unit: string) {
  if (unit === 'Celsius') return value;
  if (unit === 'Fahrenheit') return value * 9 / 5 + 32;
  return value + 273.15;
}
