import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { PageHeader } from '@/components/page-header';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeading } from '@/components/section-heading';
import { colors, fonts, radius } from '@/constants/theme';
import { loadSavedWeather, saveWeatherLocation, searchWeatherLocations, WeatherLocation, WeatherSnapshot } from '@/services/weather';
import { roundedTemperature, weatherIcon, weatherLabel } from '@/utils/weather';

export default function WeatherScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [forecast, setForecast] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    loadSavedWeather({ refresh: true, signal: controller.signal }).then((saved) => { setForecast(saved.forecast); setStale(saved.stale); setError(saved.error ?? ''); }).catch(() => undefined).finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const search = async () => {
    setSearching(true); setError(''); setResults([]);
    try {
      const locations = await searchWeatherLocations(query);
      setResults(locations);
      if (!locations.length) setError('No matching location was found. Try adding a province or country.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Location search failed.'); }
    finally { setSearching(false); }
  };
  const choose = async (location: WeatherLocation) => {
    setLoading(true); setError('');
    try { setForecast(await saveWeatherLocation(location)); setResults([]); setQuery(''); setStale(false); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The forecast could not be saved.'); }
    finally { setLoading(false); }
  };
  const refresh = async () => {
    if (!forecast) return;
    setLoading(true); setError('');
    try { setForecast(await saveWeatherLocation(forecast.location)); setStale(false); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The forecast could not be refreshed.'); setStale(true); }
    finally { setLoading(false); }
  };

  return <AppScreen tabbed assistant>
    <ScreenHeader back />
    <PageHeader title="Weather forecast" supporting="Save a city for current conditions and a seven-day outlook." />

    <View style={styles.searchShell}><Feather name="search" size={18} color={colors.muted} /><TextInput accessibilityLabel="Search city or postal code" value={query} onChangeText={(value) => { setQuery(value); setError(''); }} onSubmitEditing={search} returnKeyType="search" placeholder="City or postal code" placeholderTextColor={colors.muted} style={styles.searchInput} /><Pressable accessibilityRole="button" disabled={searching || query.trim().length < 2} onPress={search} style={[styles.searchButton, (searching || query.trim().length < 2) && styles.disabled]}>{searching ? <ActivityIndicator size="small" color={colors.paper} /> : <Text style={styles.searchButtonText}>Search</Text>}</Pressable></View>
    {error ? <View style={styles.error}><Feather name="alert-circle" size={16} color={colors.danger} /><Text style={styles.errorText}>{error}{forecast ? ' Showing the last saved forecast.' : ''}</Text></View> : null}
    {results.length ? <View style={styles.results}>{results.map((location) => <Pressable accessibilityRole="button" key={location.id} onPress={() => choose(location)} style={({ pressed }) => [styles.locationRow, pressed && styles.pressed]}><View style={styles.locationIcon}><Feather name="map-pin" size={17} color={colors.ink} /></View><View style={styles.main}><Text style={styles.locationName}>{location.name}</Text><Text style={styles.locationMeta}>{[location.admin1, location.country].filter(Boolean).join(', ')}</Text></View><Feather name="chevron-right" size={18} color={colors.muted} /></Pressable>)}</View> : null}

    {loading && !forecast ? <View style={styles.loading}><ActivityIndicator color={colors.ink} /><Text style={styles.loadingText}>Loading weather…</Text></View> : null}
    {forecast ? <>
      <View style={styles.current}>
        <View style={styles.currentTop}><View><Text style={styles.location}>{forecast.location.name}</Text><Text style={styles.condition}>{weatherLabel(forecast.current.code)}{stale ? ' · Saved forecast' : ''}</Text></View><Feather name={weatherIcon(forecast.current.code, forecast.current.isDay)} size={38} color={colors.paper} /></View>
        <View style={styles.temperatureRow}><Text style={styles.temperature}>{roundedTemperature(forecast.current.temperature)}</Text><View><Text style={styles.feels}>Feels like {roundedTemperature(forecast.current.apparentTemperature)}</Text><Text style={styles.feels}>Wind {Math.round(forecast.current.windSpeed)} km/h</Text></View></View>
        <View style={styles.today}><Text style={styles.todayText}>Today: {roundedTemperature(forecast.days[0].high)} / {roundedTemperature(forecast.days[0].low)}</Text><Text style={styles.todayText}>{Math.round(forecast.days[0].precipitationChance)}% rain</Text></View>
      </View>
      <View style={styles.section}><SectionHeading title="Seven-day forecast" action={<Pressable accessibilityRole="button" disabled={loading} onPress={refresh} style={styles.refresh}><Feather name="refresh-cw" size={15} color={colors.accent} /><Text style={styles.refreshText}>{loading ? 'Refreshing…' : 'Refresh'}</Text></Pressable>} /><View style={styles.days}>{forecast.days.map((day, index) => <View key={day.date} style={styles.day}><Text style={styles.dayName}>{index === 0 ? 'Today' : new Intl.DateTimeFormat('en-PH', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day.date}T00:00:00Z`))}</Text><Feather name={weatherIcon(day.code)} size={18} color={colors.secondary} /><View style={styles.main}><Text style={styles.dayCondition}>{weatherLabel(day.code)}</Text><Text style={styles.dayRain}>{Math.round(day.precipitationChance)}% rain</Text></View><Text style={styles.dayTemp}>{roundedTemperature(day.high)} <Text style={styles.low}>{roundedTemperature(day.low)}</Text></Text></View>)}</View></View>
    </> : !loading && !results.length ? <View style={styles.empty}><View style={styles.emptyIcon}><Feather name="cloud" size={24} color={colors.muted} /></View><Text style={styles.emptyTitle}>Choose your weather location</Text><Text style={styles.emptyText}>Search for your city once. Mewmo will remember it and show a compact forecast on Home.</Text></View> : null}

    <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://open-meteo.com/')} style={styles.attribution}><Text style={styles.attributionText}>Weather data by Open-Meteo · Personal, non-commercial use</Text><Feather name="external-link" size={12} color={colors.muted} /></Pressable>
  </AppScreen>;
}

const styles = StyleSheet.create({
  searchShell: { minHeight: 54, marginTop: 22, paddingLeft: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.paper },
  searchInput: { flex: 1, minHeight: 52, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  searchButton: { minWidth: 78, minHeight: 46, marginRight: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.ink },
  searchButtonText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.paper },
  disabled: { opacity: 0.35 },
  error: { minHeight: 52, marginTop: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.sm, backgroundColor: colors.dangerSoft },
  errorText: { flex: 1, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.danger },
  results: { marginTop: 10, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  locationRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  locationIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  main: { flex: 1, minWidth: 0 },
  locationName: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  locationMeta: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, color: colors.secondary },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontFamily: fonts.body, fontSize: 12, color: colors.secondary },
  current: { minHeight: 220, marginTop: 18, padding: 22, borderRadius: radius.lg, backgroundColor: colors.ink },
  currentTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  location: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.paper },
  condition: { marginTop: 3, fontFamily: fonts.body, fontSize: 11, color: '#BDBDBD' },
  temperatureRow: { marginTop: 24, flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  temperature: { fontFamily: fonts.bodyBold, fontSize: 54, lineHeight: 58, letterSpacing: -2, color: colors.paper },
  feels: { marginBottom: 5, fontFamily: fonts.body, fontSize: 11, color: '#C8C8C8' },
  today: { marginTop: 20, paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#333333' },
  todayText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.paper },
  section: { marginTop: 32 },
  refresh: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  refreshText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.accent },
  days: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  day: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  dayName: { width: 38, fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink },
  dayCondition: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },
  dayRain: { marginTop: 2, fontFamily: fonts.body, fontSize: 10, color: colors.secondary },
  dayTemp: { fontFamily: fonts.bodySemiBold, fontSize: 13, fontVariant: ['tabular-nums'], color: colors.ink },
  low: { color: colors.muted },
  empty: { minHeight: 220, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { marginTop: 15, fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink },
  emptyText: { marginTop: 5, textAlign: 'center', fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.secondary },
  attribution: { minHeight: 48, marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  attributionText: { fontFamily: fonts.body, fontSize: 10, color: colors.muted },
  pressed: { opacity: 0.72 },
});
