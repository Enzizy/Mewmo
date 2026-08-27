import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { getWalletSummary } from '@/features/wallet/wallet-summary';
import { syncLifeDeskWidget } from '@/services/lifedeskWidget';
import { loadSavedWeather } from '@/services/weather';
import { useItems } from '@/store/ItemsContext';
import { formatPeso } from '@/utils/money';
import { upcomingReminders } from '@/utils/reminders';
import { roundedTemperature, weatherLabel } from '@/utils/weather';

export function LifeDeskNativeSync() {
  const data = useItems();
  const { hydrated, homePreferences, items, investments, quotes, transactions, walletSetup } = data;
  const [foregroundRevision, setForegroundRevision] = useState(0);
  const money = useMemo(() => getWalletSummary({ investments, quotes, transactions, walletSetup }), [investments, quotes, transactions, walletSetup]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundRevision((revision) => revision + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      void (async () => {
        const next = upcomingReminders(items, 1)[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59, 59, 999);
        const urgentCount = items.filter((item) => !item.completed && item.category === 'task' && item.dueAt && new Date(item.dueAt) <= tomorrow).length;
        const savedWeather = await loadSavedWeather({ refresh: false, signal: controller.signal }).catch(() => ({ forecast: null }));
        const weather = savedWeather.forecast
          ? `${savedWeather.forecast.location.name} · ${roundedTemperature(savedWeather.forecast.current.temperature)} · ${weatherLabel(savedWeather.forecast.current.code)}`
          : 'Weather not set';
        await syncLifeDeskWidget({
          nextTitle: next?.item.title ?? 'Your schedule is clear',
          nextMeta: next ? formatWidgetDate(next.date) : 'Tap Remind to add something',
          urgentCount,
          weather,
          wallet: homePreferences.widgetBalancesVisible ? `Available ${formatPeso(money.balance)}` : '',
          showWallet: homePreferences.widgetBalancesVisible,
        });
      })().catch(() => undefined);
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [foregroundRevision, homePreferences.widgetBalancesVisible, hydrated, items, money.balance]);

  return null;
}

function formatWidgetDate(date: Date) {
  return new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}
