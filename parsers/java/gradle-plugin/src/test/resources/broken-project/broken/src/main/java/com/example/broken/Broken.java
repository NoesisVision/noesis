package com.example.broken;

public class Broken {
    public String name() {
        return new Missing().name();
    }
}
