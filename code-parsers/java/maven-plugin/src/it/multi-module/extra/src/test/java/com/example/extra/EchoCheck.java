package com.example.extra;

/** A test source of a module that sets noesis.includeTests to false: not in its model. */
public class EchoCheck {

    public boolean echoes() {
        return new Echo().echo().startsWith("Hello");
    }
}
