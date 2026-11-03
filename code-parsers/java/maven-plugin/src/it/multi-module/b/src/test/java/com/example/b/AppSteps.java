package com.example.b;

import com.example.a.Greeting;
import io.cucumber.java.en.When;

/** A step definition in the test sources: parsed into b's model, against the test classpath. */
public class AppSteps {

    private String text;

    @When("the app greets {string}")
    public void theAppGreets(String name) {
        text = new Greeting(name).text();
    }
}
