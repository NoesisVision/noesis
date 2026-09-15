package com.acme;

@vision.noesis.annotations.Adapter(Direction.SECONDARY)
@SuppressWarnings({"unchecked", "class interface enum"})
@Component(value = "orders", scope = @Scope("singleton"))
public final class JpaOrderRepository extends JpaBase implements OrderRepository {
    private static final Class<?> TYPE = Order.class;
    public @interface Marker {}
    public void save(Order order) {}
}
