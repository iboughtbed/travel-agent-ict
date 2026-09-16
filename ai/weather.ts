type GeocodingResult = {
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

type GeocodingResponse = { results?: GeocodingResult[] };

type ForecastResponse = {
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
};

function weatherLabel(code: number) {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorms";
}

export async function getDestinationWeather({
  destination,
  startDate,
  endDate,
}: {
  destination: string;
  startDate: string;
  endDate: string;
}) {
  const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geocodingUrl.searchParams.set("name", destination);
  geocodingUrl.searchParams.set("count", "1");
  geocodingUrl.searchParams.set("language", "en");
  geocodingUrl.searchParams.set("format", "json");

  const geocodingResponse = await fetch(geocodingUrl, {
    signal: AbortSignal.timeout(8_000),
  });

  if (!geocodingResponse.ok) {
    throw new Error("The destination could not be located.");
  }

  const geocoding = (await geocodingResponse.json()) as GeocodingResponse;
  const place = geocoding.results?.[0];

  if (!place) {
    throw new Error("The destination could not be located.");
  }

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", String(place.latitude));
  forecastUrl.searchParams.set("longitude", String(place.longitude));
  forecastUrl.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  );
  forecastUrl.searchParams.set("timezone", "auto");
  forecastUrl.searchParams.set("start_date", startDate);
  forecastUrl.searchParams.set("end_date", endDate);

  const forecastResponse = await fetch(forecastUrl, {
    signal: AbortSignal.timeout(8_000),
  });

  if (!forecastResponse.ok) {
    throw new Error("The forecast could not be loaded for those dates.");
  }

  const forecast = (await forecastResponse.json()) as ForecastResponse;
  const daily = forecast.daily;

  if (!daily) {
    throw new Error("The forecast did not contain daily data.");
  }

  return {
    place: {
      name: place.name,
      country: place.country ?? "",
      timezone: place.timezone ?? "",
    },
    days: daily.time.map((date, index) => ({
      date,
      condition: weatherLabel(daily.weather_code[index] ?? 0),
      highC: Math.round(daily.temperature_2m_max[index] ?? 0),
      lowC: Math.round(daily.temperature_2m_min[index] ?? 0),
      precipitationChance: Math.round(
        daily.precipitation_probability_max[index] ?? 0,
      ),
    })),
    source: "Open-Meteo",
    retrievedAt: new Date().toISOString(),
  };
}
