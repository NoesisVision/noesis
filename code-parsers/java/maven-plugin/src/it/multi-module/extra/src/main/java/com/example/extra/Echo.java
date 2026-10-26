package com.example.extra;

import com.example.a.Greeting;

/** Uses the other module named a. */
public class Echo {

    public String echo() {
        return new Greeting("echo").text();
    }
}
