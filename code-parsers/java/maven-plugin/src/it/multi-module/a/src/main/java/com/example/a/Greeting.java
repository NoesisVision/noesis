package com.example.a;

import com.google.common.base.Strings;

/** A type the other module uses; it uses a library itself. */
public class Greeting {

    private final String name;

    public Greeting(String name) {
        this.name = Strings.nullToEmpty(name);
    }

    public String text() {
        return "Hello, " + name;
    }
}
