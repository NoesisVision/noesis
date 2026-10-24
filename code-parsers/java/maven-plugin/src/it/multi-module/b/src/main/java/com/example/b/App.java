package com.example.b;

import com.example.a.Greeting;

public final class App {

    private App() {
    }

    public static void main(String[] args) {
        System.out.println(new Greeting(args.length > 0 ? args[0] : null).text());
    }
}
