package com.acme;
public class Order {
    @Event
    public record Placed(String id) {}
    public static class Builder { public Order build() { return null; } }
}
