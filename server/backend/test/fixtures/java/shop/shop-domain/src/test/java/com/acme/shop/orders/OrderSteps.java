package com.acme.shop.orders;

import com.acme.shop.products.ProductId;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.UUID;

public class OrderSteps {

    private Order order;
    private Money total;

    @Given("an order with one line")
    public void anOrderWithOneLine() {
        order = Order.create(new OrderId(UUID.randomUUID()));
        order.addLine(new ProductId("book"));
    }

    @When("the customer places the order")
    public void theCustomerPlacesTheOrder() {
        order.placeOrder();
    }

    @When("the customer adds {int} more lines")
    public void theCustomerAddsMoreLines(int count) {
        for (int i = 0; i < count; i++) order.addLine(new ProductId("pen"), 1);
    }

    @When("^the total is (?:asked for|read)$")
    public void theTotalIsAskedFor() {
        total = order.total();
    }

    @Then("the order is placed")
    public void theOrderIsPlaced() {
    }

    @Then("the total is the price of the lines")
    public void theTotalIsThePriceOfTheLines() {
    }
}
