package com.acme.shop;

import vision.noesis.annotations.AggregateRoot;
import vision.noesis.annotations.Entity;
import jakarta.persistence.Entity;
import io.vavr.control.Option;

/**
 * A basket a customer fills before checking out. Lines are kept in the
 * order they were added.
 *
 * @author nobody
 */
@AggregateRoot
@Entity
public class Basket extends AbstractBasket implements Comparable<Basket>, Serializable {

    /** Who fills the basket. */
    private final CustomerId owner;
    private List<Line> lines = new ArrayList<>();
    private Option<Coupon> coupon = Option.none();
    private Map<String, Integer> counters;
    private String[] tags;
    private static final int MAX_LINES = 10;
    int packagePrivateCount;

    public Basket(CustomerId owner) {
        this.owner = owner;
    }

    /**
     * Adds a line; the same product twice merges into one line.
     * Never throws.
     */
    public void add(Product product, int quantity) {}

    public void add(Product product) {}

    @Override
    public Option<Line> findLine(ProductId id) { return Option.none(); }

    public boolean isEmpty() { return lines.isEmpty(); }

    public Money total() { return Money.zero(); }

    public <T extends Discount> T apply(T discount, String... reasons) throws DiscountRejected {
        return discount;
    }

    void audit() {}
    protected void recompute() {}
    private void hidden() {}

    public static Basket empty(CustomerId owner) { return new Basket(owner); }

    @Override
    public int compareTo(Basket other) { return 0; }
}

/** A line of the basket. */
@vision.noesis.annotations.ValueObject
record Line(ProductId product, int quantity) {}
