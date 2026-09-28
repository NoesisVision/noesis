package com.itlibrium.discounts.users;

import vision.noesis.annotations.Adapter;
import vision.noesis.annotations.Direction;

@Adapter(Direction.SECONDARY)
public class UserStatusProvider {

    public UserStatus getFor(UserId userId) {
        return new UserStatus(false);
    }
}
