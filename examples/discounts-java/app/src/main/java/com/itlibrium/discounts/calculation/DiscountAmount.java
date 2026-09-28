package com.itlibrium.discounts.calculation;

import vision.noesis.annotations.ValueObject;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@ValueObject
@NoArgsConstructor
@AllArgsConstructor
class DiscountAmount {

    //bo interesuje nas jaka zniżka została naliczona żeby móc wykluczać zniżki wzajemnie
    @Getter
    Discount appliedDiscount;


}
