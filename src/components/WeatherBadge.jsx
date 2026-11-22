import { useStore } from '../store.js';
import { weatherInfo, FORECAST_DAYS_AHEAD } from '../lib/weather.js';
import { todayStr, daysBetween } from '../lib/dates.js';

export default function WeatherBadge({ date }) {
  const { data } = useStore();
  const w = data.weather[date];
  if (!w) {
    if (daysBetween(todayStr(), date) > FORECAST_DAYS_AHEAD) {
      return <span className="weather muted">날씨는 16일 전부터 나와요</span>;
    }
    return <span className="weather muted">날씨 불러오는 중…</span>;
  }
  const info = weatherInfo(w.code);
  return (
    <span className="weather" title={info.label}>
      <span className="weather-icon" aria-label={info.label}>
        {info.icon}
      </span>
      {w.max} / {w.min}°C
    </span>
  );
}
