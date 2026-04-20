export const PRODUCT_CATEGORIES = [
  'Grocery',
  'Clothing',
  'Electronics',
  'Food',
  'Health',
  'Home',
  'Kids',
  'Sports',
  'Vehicles',
  'Hardware',
  'Animals',
  'Art',
  'Stationery',
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];
