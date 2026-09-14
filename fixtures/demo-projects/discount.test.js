'use strict';

const { calculateDiscount, shippingCost, paymentLabel } = require('./discount.js');

test('non-members pay the listed price', () => {
  expect(calculateDiscount(100, false)).toBe(100);
});

test('large orders receive free shipping', () => {
  expect(shippingCost(100)).toBe(0);
});

test('approved payments show a paid label', () => {
  expect(paymentLabel(true)).toBe('paid');
});
