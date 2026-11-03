Feature: Behavior forms

  Background:
    Given a behavior form

  @validation
  Rule: Overloads take the widest
    The overload with the most parameters stands for the behavior.

    Scenario: One argument
      When the overloaded behavior runs with 1
      Then nothing is returned

  @post
  Rule: Named behaviors keep their name
    Scenario: The named behavior runs
      When the named behavior runs
      Then nothing is returned
