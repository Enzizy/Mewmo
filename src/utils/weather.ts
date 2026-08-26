export function weatherLabel(code: number) {
  if (code === 0) return 'Clear sky';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Conditions unavailable';
}

export function weatherIcon(code: number, isDay = true): 'sun' | 'moon' | 'cloud' | 'align-justify' | 'cloud-rain' | 'cloud-snow' | 'cloud-lightning' {
  if (code === 0) return isDay ? 'sun' : 'moon';
  if (code <= 3) return 'cloud';
  if (code === 45 || code === 48) return 'align-justify';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'cloud-rain';
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'cloud-snow';
  if (code >= 95) return 'cloud-lightning';
  return 'cloud';
}

export function roundedTemperature(value: number) {
  return `${Math.round(value)}°`;
}
