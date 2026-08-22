import { UnitDefinition, UnitConversionRule } from '../types';

/**
 * Standard BUSY UFO Simple Units (20 Default Units)
 */
export const STANDARD_SIMPLE_UNITS: UnitDefinition[] = [
  { code: 'Nos', name: 'Numbers', category: 'COUNT', isSystem: true },
  { code: 'Pcs', name: 'Pieces', category: 'COUNT', isSystem: true },
  { code: 'Kg', name: 'Kilograms', category: 'WEIGHT', isSystem: true },
  { code: 'Gm', name: 'Grams', category: 'WEIGHT', isSystem: true },
  { code: 'Ltr', name: 'Liters', category: 'VOLUME', isSystem: true },
  { code: 'Ml', name: 'Milliliters', category: 'VOLUME', isSystem: true },
  { code: 'Mtr', name: 'Meters', category: 'LENGTH', isSystem: true },
  { code: 'Cm', name: 'Centimeters', category: 'LENGTH', isSystem: true },
  { code: 'Mm', name: 'Millimeters', category: 'LENGTH', isSystem: true },
  { code: 'Ft', name: 'Feet', category: 'LENGTH', isSystem: true },
  { code: 'In', name: 'Inches', category: 'LENGTH', isSystem: true },
  { code: 'Dz', name: 'Dozen', category: 'COUNT', isSystem: true },
  { code: 'Pr', name: 'Pairs', category: 'COUNT', isSystem: true },
  { code: 'Box', name: 'Boxes', category: 'PACKAGING', isSystem: true },
  { code: 'Pack', name: 'Packs', category: 'PACKAGING', isSystem: true },
  { code: 'Set', name: 'Sets', category: 'COUNT', isSystem: true },
  { code: 'Btl', name: 'Bottles', category: 'PACKAGING', isSystem: true },
  { code: 'Bag', name: 'Bags', category: 'PACKAGING', isSystem: true },
  { code: 'Ctn', name: 'Cartons', category: 'PACKAGING', isSystem: true },
  { code: 'Roll', name: 'Rolls', category: 'PACKAGING', isSystem: true }
];

/**
 * Standard Compound / Conversion Unit Rules
 */
export const DEFAULT_CONVERSION_RULES: UnitConversionRule[] = [
  { id: 'rule-dz-nos', mainUnit: 'Dz', secondaryUnit: 'Nos', conversionFactor: 12, description: '1 Dozen = 12 Nos', isSystem: true },
  { id: 'rule-box-nos', mainUnit: 'Box', secondaryUnit: 'Nos', conversionFactor: 12, description: '1 Box = 12 Nos', isSystem: true },
  { id: 'rule-ctn-box', mainUnit: 'Ctn', secondaryUnit: 'Box', conversionFactor: 10, description: '1 Carton = 10 Boxes', isSystem: true },
  { id: 'rule-pack-pcs', mainUnit: 'Pack', secondaryUnit: 'Pcs', conversionFactor: 10, description: '1 Pack = 10 Pcs', isSystem: true },
  { id: 'rule-kg-gm', mainUnit: 'Kg', secondaryUnit: 'Gm', conversionFactor: 1000, description: '1 Kg = 1000 Gm', isSystem: true },
  { id: 'rule-ltr-ml', mainUnit: 'Ltr', secondaryUnit: 'Ml', conversionFactor: 1000, description: '1 Ltr = 1000 Ml', isSystem: true },
  { id: 'rule-mtr-cm', mainUnit: 'Mtr', secondaryUnit: 'Cm', conversionFactor: 100, description: '1 Mtr = 100 Cm', isSystem: true },
  { id: 'rule-cm-mm', mainUnit: 'Cm', secondaryUnit: 'Mm', conversionFactor: 10, description: '1 Cm = 10 Mm', isSystem: true },
  { id: 'rule-ft-in', mainUnit: 'Ft', secondaryUnit: 'In', conversionFactor: 12, description: '1 Ft = 12 Inches', isSystem: true }
];

export class UnitService {
  /**
   * Calculates conversion factor between mainUnit and secondaryUnit.
   */
  static getConversionFactor(mainUnit: string, secondaryUnit: string, productFactor?: number): number {
    if (!mainUnit || !secondaryUnit || mainUnit === secondaryUnit) return 1;

    // Use product-level factor if defined
    if (productFactor && productFactor > 0) return productFactor;

    // Check direct matching rules
    const directRule = DEFAULT_CONVERSION_RULES.find(
      (r) => r.mainUnit.toLowerCase() === mainUnit.toLowerCase() && r.secondaryUnit.toLowerCase() === secondaryUnit.toLowerCase()
    );
    if (directRule) return directRule.conversionFactor;

    // Check inverse matching rules
    const inverseRule = DEFAULT_CONVERSION_RULES.find(
      (r) => r.mainUnit.toLowerCase() === secondaryUnit.toLowerCase() && r.secondaryUnit.toLowerCase() === mainUnit.toLowerCase()
    );
    if (inverseRule) return 1 / inverseRule.conversionFactor;

    return 1;
  }

  /**
   * Formats quantity into compound display, e.g. 29 Nos (when 1 Box = 12 Nos) -> "2 Box 5 Nos"
   */
  static formatCompoundQuantity(
    totalQtyInSecondary: number,
    mainUnit: string,
    secondaryUnit: string,
    factor: number
  ): string {
    if (!secondaryUnit || !mainUnit || factor <= 1 || totalQtyInSecondary <= 0) {
      return `${totalQtyInSecondary} ${mainUnit || secondaryUnit || ''}`.trim();
    }

    const mainQty = Math.floor(totalQtyInSecondary / factor);
    const remainderQty = Number((totalQtyInSecondary % factor).toFixed(2));

    if (mainQty > 0 && remainderQty > 0) {
      return `${mainQty} ${mainUnit} ${remainderQty} ${secondaryUnit}`;
    } else if (mainQty > 0) {
      return `${mainQty} ${mainUnit}`;
    } else {
      return `${remainderQty} ${secondaryUnit}`;
    }
  }

  /**
   * Converts quantity from one unit to another
   */
  static convert(quantity: number, fromUnit: string, toUnit: string, factor: number = 1): number {
    if (!fromUnit || !toUnit || fromUnit.toLowerCase() === toUnit.toLowerCase()) {
      return quantity;
    }
    if (factor > 0) {
      // Assuming factor means 1 MainUnit = factor SecondaryUnit
      return quantity * factor;
    }
    return quantity;
  }
}
