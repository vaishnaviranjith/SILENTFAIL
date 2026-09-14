'use strict';

/**
 * A deliberately small business-rule module.
 * The implementation is correct; the demo's tests are intentionally incomplete.
 */
function calculateDiscount(price, isMember) {
  if (isMember === true) {
    return price * 0.9;
  }
  return price;
}

function shippingCost(amount) {
  if (amount >= 50) {
    return 0;
  }
  return 10;
}

function paymentLabel(approved) {
  return approved ? 'paid' : 'declined';
}

module.exports = { calculateDiscount, shippingCost, paymentLabel };
