package com.itlibrium.discounts.weather.openmeteo;

import com.itlibrium.discounts.weather.Weather;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import io.vavr.control.Option;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OpenMeteoWeatherProviderTest {

    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void mapsCurrentPrecipitationToWeather() {
        OpenMeteoWeatherProvider provider = providerFor(respondWith(200, "{\"current\":{\"precipitation\":0.5}}"));

        assertEquals(Option.some(new Weather(0.5)), provider.getCurrent());
    }

    @Test
    void requestsWarsawCurrentPrecipitation() {
        StringBuilder requestedUri = new StringBuilder();
        OpenMeteoWeatherProvider provider = providerFor(exchange -> {
            requestedUri.append(exchange.getRequestURI().toString());
            respond(exchange, 200, "{\"current\":{\"precipitation\":0.5}}");
        });

        provider.getCurrent();

        assertEquals("/v1/forecast?latitude=52.2297&longitude=21.0122&current=precipitation", requestedUri.toString());
    }

    @Test
    void returnsNoneOnServerError() {
        OpenMeteoWeatherProvider provider = providerFor(respondWith(500, "boom"));

        assertTrue(providerResultIsEmpty(provider));
    }

    @Test
    void returnsNoneOnMalformedJson() {
        OpenMeteoWeatherProvider provider = providerFor(respondWith(200, "{ this is not json"));

        assertTrue(providerResultIsEmpty(provider));
    }

    @Test
    void returnsNoneWhenPrecipitationIsMissing() {
        OpenMeteoWeatherProvider provider = providerFor(respondWith(200, "{\"current\":{\"temperature\":12.0}}"));

        assertTrue(providerResultIsEmpty(provider));
    }

    @Test
    void returnsNoneWhenTheApiIsTooSlow() {
        OpenMeteoWeatherProvider provider = providerFor(exchange -> {
            try {
                Thread.sleep(6000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            respond(exchange, 200, "{\"current\":{\"precipitation\":0.5}}");
        });

        assertTrue(providerResultIsEmpty(provider));
    }

    @Test
    void returnsNoneWhenTheApiIsUnreachable() {
        assertTrue(providerResultIsEmpty(new OpenMeteoWeatherProvider("http://localhost:1")));
    }

    private static boolean providerResultIsEmpty(OpenMeteoWeatherProvider provider) {
        return provider.getCurrent().isEmpty();
    }

    private OpenMeteoWeatherProvider providerFor(HttpHandler handler) {
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/v1/forecast", handler);
            server.setExecutor(Executors.newCachedThreadPool(runnable -> {
                Thread thread = new Thread(runnable);
                thread.setDaemon(true);
                return thread;
            }));
            server.start();
            return new OpenMeteoWeatherProvider("http://127.0.0.1:" + server.getAddress().getPort());
        } catch (IOException e) {
            throw new IllegalStateException("cannot start the weather API stub", e);
        }
    }

    private static HttpHandler respondWith(int statusCode, String body) {
        return exchange -> respond(exchange, statusCode, body);
    }

    private static void respond(HttpExchange exchange, int statusCode, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
        }
    }
}
