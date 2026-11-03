Feature: Placing orders

  Background:
    Given an order with one line

  @state_change
  Rule: Placing an order
    A new order becomes placed when the customer places it.

    Scenario: A new order is placed
      When the customer places the order
      Then the order is placed

  @computation
  Rule: Order total
    The total is the sum of the lines, less the discount.

    Scenario: The total of one line
      When the total is asked for
      Then the total is the price of the lines

    Scenario Outline: The total after more lines
      When the customer adds <count> more lines
      Then the total is the price of the lines

      Examples:
        | count |
        | 2     |
