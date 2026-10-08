import { useCallback, useEffect, useState } from "react";
import "./Weather.css";

const CITY_STORAGE_KEY = "flowly-weather-city";
const DEFAULT_CITY = {
  name: "Vilnius",
  latitude: 54.6872,
  longitude: 25.2797,
};

function getSavedCity() {
  try {
    const savedCity = JSON.parse(window.localStorage.getItem(CITY_STORAGE_KEY));
    if (savedCity?.name && Number.isFinite(savedCity.latitude) && Number.isFinite(savedCity.longitude)) {
      return savedCity;
    }
  } catch {
    // Jei naršyklės saugykla neprieinama, naudojamas numatytasis miestas.
  }

  return DEFAULT_CITY;
}

function getWeatherDescription(code) {
  if (code === 0) return "Giedra";
  if ([1, 2].includes(code)) return "Mažai debesuota";
  if (code === 3) return "Debesuota";
  if ([45, 48].includes(code)) return "Rūkas";
  if ([51, 53, 55, 56, 57].includes(code)) return "Dulksna";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Lietus";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Sniegas";
  if ([95, 96, 99].includes(code)) return "Perkūnija";
  return "Orai nenustatyti";
}

function formatDay(date) {
  return new Intl.DateTimeFormat("lt-LT", { weekday: "short" }).format(
    new Date(`${date}T12:00:00`),
  );
}

function Weather() {
  const [city, setCity] = useState(getSavedCity);
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isCitySearchOpen, setIsCitySearchOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState([]);
  const [citySearchError, setCitySearchError] = useState("");
  const [isSearchingCity, setIsSearchingCity] = useState(false);

  const loadForecast = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        latitude: city.latitude,
        longitude: city.longitude,
        current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
        daily: "weather_code,temperature_2m_max,temperature_2m_min",
        timezone: "auto",
        forecast_days: "3",
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!response.ok) throw new Error("Nepavyko gauti orų prognozės.");
      const data = await response.json();
      if (!data.current || !data.daily) throw new Error("Gauti netinkami orų duomenys.");
      setForecast(data);
    } catch (loadError) {
      setError(loadError.message || "Orų prognozė šiuo metu nepasiekiama.");
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    const timer = window.setTimeout(loadForecast, 0);
    return () => window.clearTimeout(timer);
  }, [loadForecast]);

  async function searchCity(event) {
    event.preventDefault();
    const query = cityQuery.trim();
    if (query.length < 2) {
      setCitySearchError("Įveskite bent 2 miesto raides.");
      return;
    }

    setIsSearchingCity(true);
    setCitySearchError("");
    setCityResults([]);

    try {
      const params = new URLSearchParams({ name: query, count: "5", language: "lt", format: "json" });
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
      if (!response.ok) throw new Error("Miesto paieška nepavyko.");
      const data = await response.json();
      const results = Array.isArray(data.results) ? data.results : [];

      if (results.length === 0) {
        setCitySearchError("Miesto nerasta. Pabandykite kitą pavadinimą.");
      } else {
        setCityResults(results);
      }
    } catch (searchError) {
      setCitySearchError(searchError.message || "Miesto paieška šiuo metu nepasiekiama.");
    } finally {
      setIsSearchingCity(false);
    }
  }

  function selectCity(result) {
    const nextCity = {
      name: result.name,
      area: result.admin1 || result.country || "",
      latitude: result.latitude,
      longitude: result.longitude,
    };

    setCity(nextCity);
    setForecast(null);
    setLoading(true);
    setCityResults([]);
    setCityQuery("");
    setCitySearchError("");
    setIsCitySearchOpen(false);
    try {
      window.localStorage.setItem(CITY_STORAGE_KEY, JSON.stringify(nextCity));
    } catch {
      // Miestas bus naudojamas iki puslapio uždarymo, jei saugykla neprieinama.
    }
  }

  return (
    <aside className="weather-card" aria-label={`${city.name} orų prognozė`}>
      <div className="weather-card__heading">
        <div>
          <p className="weather-card__eyebrow">Orų prognozė</p>
          <h2>{city.name}</h2>
          {city.area && <span className="weather-card__area">{city.area}</span>}
        </div>
        <div className="weather-card__heading-actions">
          <button
            className="weather-card__change-city"
            type="button"
            onClick={() => setIsCitySearchOpen((open) => !open)}
          >
            Keisti miestą
          </button>
          <span className="weather-card__icon" aria-hidden="true">☀</span>
        </div>
      </div>

      {isCitySearchOpen && (
        <form className="weather-card__city-search" onSubmit={searchCity}>
          <label htmlFor="weather-city-query">Miesto pavadinimas</label>
          <div className="weather-card__search-row">
            <input
              id="weather-city-query"
              type="search"
              value={cityQuery}
              onChange={(event) => setCityQuery(event.target.value)}
              placeholder="Pvz. Kaunas"
              autoFocus
            />
            <button type="submit" disabled={isSearchingCity}>
              {isSearchingCity ? "Ieškoma..." : "Ieškoti"}
            </button>
          </div>
          {citySearchError && <p className="weather-card__search-error" role="status">{citySearchError}</p>}
          {cityResults.length > 0 && (
            <ul className="weather-card__city-results">
              {cityResults.map((result) => (
                <li key={`${result.id}-${result.latitude}`}>
                  <button type="button" onClick={() => selectCity(result)}>
                    <span>{result.name}</span>
                    <small>{[result.admin1, result.country].filter(Boolean).join(", ")}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
      )}

      {loading ? (
        <p className="weather-card__message">Kraunami orai...</p>
      ) : error ? (
        <div className="weather-card__message" role="status">
          <p>{error}</p>
          <button type="button" onClick={loadForecast}>Bandyti dar kartą</button>
        </div>
      ) : (
        <>
          <div className="weather-card__current">
            <strong>{Math.round(forecast.current.temperature_2m)}°</strong>
            <div>
              <p>{getWeatherDescription(forecast.current.weather_code)}</p>
              <span>Jaučiama kaip {Math.round(forecast.current.apparent_temperature)}°</span>
              <span>Vėjas {Math.round(forecast.current.wind_speed_10m)} km/val.</span>
            </div>
          </div>
          <div className="weather-card__days">
            {forecast.daily.time.slice(0, 3).map((date, index) => (
              <div className="weather-card__day" key={date}>
                <span>{index === 0 ? "Šiandien" : formatDay(date)}</span>
                <span>{getWeatherDescription(forecast.daily.weather_code[index])}</span>
                <strong>
                  {Math.round(forecast.daily.temperature_2m_max[index])}° / {Math.round(forecast.daily.temperature_2m_min[index])}°
                </strong>
              </div>
            ))}
          </div>
          <p className="weather-card__source">Duomenys: Open-Meteo</p>
        </>
      )}
    </aside>
  );
}

export default Weather;
