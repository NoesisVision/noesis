package com.itlibrium.discounts.weather.openmeteo;

import vision.noesis.annotations.Adapter;
import vision.noesis.annotations.Direction;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itlibrium.discounts.weather.Weather;
import com.itlibrium.discounts.weather.WeatherProvider;
import io.vavr.control.Option;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Adapter(Direction.SECONDARY)
public class OpenMeteoWeatherProvider implements WeatherProvider {

    private static final String DEFAULT_BASE_URL = "https://api.open-meteo.com";

    // Warsaw; the location and the requested parameters are adapter configuration.
    private static final String LATITUDE = "52.2297";
    private static final String LONGITUDE = "21.0122";
    private static final String CURRENT_PARAMETERS = "precipitation";

    private static final Duration TIMEOUT = Duration.ofSeconds(2);

    private final URI forecastUri;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OpenMeteoWeatherProvider() {
        this(DEFAULT_BASE_URL);
    }

    public OpenMeteoWeatherProvider(String baseUrl) {
        this.forecastUri = forecastUri(baseUrl);
        this.httpClient = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
    }

    @Override
    public Option<Weather> getCurrent() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(forecastUri)
                .timeout(TIMEOUT)
                .GET()
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (!isSuccessful(response.statusCode())) {
                return Option.none();
            }
            return toWeather(response.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Option.none();
        } catch (Exception e) {
            return Option.none();
        }
    }

    private static URI forecastUri(String baseUrl) {
        String root = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        return URI.create(root + "/v1/forecast?latitude=" + LATITUDE + "&longitude=" + LONGITUDE
            + "&current=" + CURRENT_PARAMETERS);
    }

    private static boolean isSuccessful(int statusCode) {
        return statusCode >= 200 && statusCode < 300;
    }

    private Option<Weather> toWeather(String body) {
        try {
            JsonNode precipitation = objectMapper.readTree(body).path("current").path("precipitation");
            if (!precipitation.isNumber()) {
                return Option.none();
            }
            return Option.some(new Weather(precipitation.doubleValue()));
        } catch (Exception e) {
            return Option.none();
        }
    }
}
