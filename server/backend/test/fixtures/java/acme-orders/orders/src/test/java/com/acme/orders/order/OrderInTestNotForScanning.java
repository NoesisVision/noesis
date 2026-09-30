package com.acme.orders.order;

// Deliberately a fully annotated aggregate with a public method: were the
// scanner to enter src/test/, this is exactly what would show up in the model.
@AggregateRoot
public class OrderInTestNotForScanning { public void notScanned() {} }
