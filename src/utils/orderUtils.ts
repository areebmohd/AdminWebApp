export const getItemTotals = (product: any, allStoreItems: any[], storeOffer: any) => {
  const originalTotal = product.product_price * product.quantity;
  if (!storeOffer) return { original: originalTotal, discounted: originalTotal };

  let discountedTotal = originalTotal;

  switch (storeOffer.type) {
    case 'discount':
      discountedTotal = originalTotal * (1 - storeOffer.amount / 100);
      break;
    case 'free_cash':
      const totalStoreAmount = allStoreItems.reduce((acc: any, curr: any) => acc + curr.product_price * curr.quantity, 0);
      const proportion = (product.product_price * product.quantity) / (totalStoreAmount || 1);
      discountedTotal = originalTotal - (storeOffer.amount * proportion);
      break;
    case 'cheap_product':
      if (storeOffer.conditions?.product_ids?.includes(product.product_id || product.id)) {
        discountedTotal = originalTotal * (1 - storeOffer.amount / 100);
      }
      break;
    case 'fixed_price':
      if (storeOffer.reward_data?.product_ids?.includes(product.product_id || product.id)) {
        discountedTotal = storeOffer.amount * product.quantity;
      }
      break;
    case 'combo':
      if (storeOffer.reward_data?.product_ids?.includes(product.product_id || product.id)) {
        const comboItems = allStoreItems.filter((i: any) => storeOffer.reward_data?.product_ids?.includes(i.product_id || i.id));
        const comboBaseValue = comboItems.reduce((acc: any, curr: any) => acc + curr.product_price, 0);
        const comboDiscount = Math.max(0, comboBaseValue - storeOffer.amount);
        const itemProportion = product.product_price / (comboBaseValue || 1);
        discountedTotal = originalTotal - (comboDiscount * itemProportion);
      }
      break;
    case 'free_product':
      if (product.selected_options?.gift === 'true') {
        discountedTotal = 0;
      }
      break;
  }

  return { 
    original: originalTotal, 
    discounted: Math.max(0, discountedTotal)
  };
};

export const getRiderDeliveryFee = (order: {
  rider_delivery_fee?: number | string | null;
  delivery_fee?: number | string | null;
}) => {
  const riderFee = Number(order.rider_delivery_fee ?? 0);
  if (Number.isFinite(riderFee) && riderFee > 0) return riderFee;

  const customerFee = Number(order.delivery_fee ?? 0);
  return Number.isFinite(customerFee) ? customerFee : 0;
};

export const getSponsoredDeliveryFee = (order: {
  store_delivery_fees?: Record<string, number> | null;
}) => {
  if (!order.store_delivery_fees) return 0;

  return Object.values(order.store_delivery_fees).reduce((sum, fee) => {
    const value = Number(fee ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
};

export const getDisplayPlatformFee = (order: {
  platform_fee?: number | string | null;
  rider_delivery_fee?: number | string | null;
  delivery_fee?: number | string | null;
  store_delivery_fees?: Record<string, number> | null;
}) => {
  const platformFee = Number(order.platform_fee ?? 0);
  const basePlatformFee = Number.isFinite(platformFee) ? platformFee : 0;
  const sponsoredDeliveryFee = getSponsoredDeliveryFee(order);
  const riderDeliveryFee = getRiderDeliveryFee(order);

  if (sponsoredDeliveryFee <= 0) return basePlatformFee;

  return basePlatformFee + Math.max(0, sponsoredDeliveryFee - riderDeliveryFee);
};
