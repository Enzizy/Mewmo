import AsyncStorage from '@react-native-async-storage/async-storage';

export type WeatherLocation = {
  id: number;
  name: string;
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type WeatherDay = {
  date: string;
  code: number;
  high: number;
  low: number;
  precipitationChance: number;
  sunrise: string;
  sunset: string;
};

export type WeatherSnapshot = {
  location: WeatherLocation;
  fetchedAt: string;
  current: { temperature: number; apparentTemperature: number; code: number; windSpeed: number; isDay: boolean };
  days: WeatherDay[];
};

const LOCATION_KEY = 'mewmo.weather.location.v1';
const FORECAST_KEY = 'mewmo.weather.forecast.v1';
const CACHE_MS = 30 * 60 * 1000;

export async function searchWeatherLocations(query: string, signal?: AbortSignal) {
  const name = query.trim();
  if (name.length < 2) throw new Error('Enter at least two characters of a city or postal code.');
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=8&language=en&format=json`;
  const body = await requestJson(url, signal) as { results?: unknown[] };
  return (body.results ?? []).flatMap(normalizeLocation);
}

export async function fetchWeather(location: WeatherLocation, signal?: AbortSignal): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
    timezone: 'auto',
    forecast_days: '7',
  });
  const body = await requestJson(`https://api.open-meteo.com/v1/forecast?${params}`, signal) as WeatherResponse;
  const current = body.current;
  const daily = body.daily;
  if (!current || !daily || !finite(current.temperature_2m) || !Array.isArray(daily.time)) throw new Error('The weather provider returned an incomplete forecast.');
  const days = daily.time.map((date, index) => ({
    date,
    code: numberAt(daily.weather_code, index),
    high: numberAt(daily.temperature_2m_max, index),
    low: numberAt(daily.temperature_2m_min, index),
    precipitationChance: numberAt(daily.precipitation_probability_max, index),
    sunrise: stringAt(daily.sunrise, index),
    sunset: stringAt(daily.sunset, index),
  }));
  if (!days.length || days.some((day) => !finite(day.code) || !finite(day.high) || !finite(day.low))) throw new Error('The weather provider returned invalid daily values.');
  return {
    location: { ...location, timezone: body.timezone || location.timezone },
    fetchedAt: new Date().toISOString(),
    current: {
      temperature: current.temperature_2m,
      apparentTemperature: current.apparent_temperature,
      code: current.weather_code,
      windSpeed: current.wind_speed_10m,
      isDay: current.is_day === 1,
    },
    days,
  };
}

export async function saveWeatherLocation(location: WeatherLocation, signal?: AbortSignal) {
  const forecast = await fetchWeather(location, signal);
  await AsyncStorage.multiSet([[LOCATION_KEY, JSON.stringify(forecast.location)], [FORECAST_KEY, JSON.stringify(forecast)]]);
  return forecast;
}

export async function loadSavedWeather(options: { refresh?: boolean; signal?: AbortSignal } = {}) {
  const [[, locationJson], [, forecastJson]] = await AsyncStorage.multiGet([LOCATION_KEY, FORECAST_KEY]);
  const location = parseStored<WeatherLocation>(locationJson);
  const cached = parseStored<WeatherSnapshot>(forecastJson);
  if (!location) return { forecast: null, stale: false, error: null as string | null };
  const stale = !cached || Date.now() - Date.parse(cached.fetchedAt) >= CACHE_MS;
  if (!options.refresh || !stale) return { forecast: cached, stale, error: null as string | null };
  try {
    const forecast = await fetchWeather(location, options.signal);
    await AsyncStorage.setItem(FORECAST_KEY, JSON.stringify(forecast));
    return { forecast, stale: false, error: null as string | null };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return { forecast: cached, stale: true, error: error instanceof Error ? error.message : 'Weather could not be refreshed.' };
  }
}

async function requestJson(url: string, signal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.json().catch(() => ({})) as { reason?: string };
    if (!response.ok) throw new Error(body.reason || `Weather request failed (${response.status}).`);
    return body;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The weather request timed out or was cancelled.');
    throw new Error(error instanceof Error ? error.message : 'Weather is unavailable. Check your connection.');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

function normalizeLocation(value: unknown): WeatherLocation[] {
  if (!value || typeof value !== 'object') return [];
  const item = value as Record<string, unknown>;
  if (!finite(item.latitude) || !finite(item.longitude) || typeof item.name !== 'string' || typeof item.country !== 'string' || !finite(item.id)) return [];
  return [{ id: item.id as number, name: item.name, admin1: typeof item.admin1 === 'string' ? item.admin1 : undefined, country: item.country, latitude: item.latitude as number, longitude: item.longitude as number, timezone: typeof item.timezone === 'string' ? item.timezone : 'auto' }];
}

function parseStored<T>(value: string | null) { try { return value ? JSON.parse(value) as T : null; } catch { return null; } }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function numberAt(values: number[] | undefined, index: number) { const value = values?.[index]; return finite(value) ? value : Number.NaN; }
function stringAt(values: string[] | undefined, index: number) { return typeof values?.[index] === 'string' ? values[index] : ''; }

type WeatherResponse = {
  timezone?: string;
  current?: { temperature_2m: number; apparent_temperature: number; is_day: number; weather_code: number; wind_speed_10m: number };
  daily?: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[]; sunrise: string[]; sunset: string[] };
};
