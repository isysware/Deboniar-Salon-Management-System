import { ServiceItem, PackageItem, InventoryItem } from '../types/salon';

export type CatalogueItem = ServiceItem | PackageItem | InventoryItem;

export function isInventoryItem(item: CatalogueItem): item is InventoryItem {
  return 'sku' in item || 'sellingPrice' in item || 'purchaseUnit' in item;
}

export function isServiceItem(item: CatalogueItem): item is ServiceItem {
  return 'durationMinutes' in item;
}

export function isPackageItem(item: CatalogueItem): item is PackageItem {
  return 'components' in item;
}

export function getCatalogueSellingPrice(item: CatalogueItem): number {
  if (isInventoryItem(item)) {
    return item.sellingPrice;
  }
  return item.price;
}

export function getCatalogueCode(item: CatalogueItem): string {
  if (isInventoryItem(item)) {
    return item.sku || item.code || '';
  }
  return item.code;
}

export function getCatalogueTaxRuleId(item: CatalogueItem): string | undefined {
  return item.specificTaxRuleId;
}
