import {
  timberSizes,
  suppliers,
  supplierRates,
  stock,
  stockProperties,
  stockColours,
  stockVariants,
  stockColourLinks,
  stockVariantLinks,
  stockCostHistory,
  type TimberSize,
  type InsertTimberSize,
  type Supplier,
  type InsertSupplier,
  type SupplierRate,
  type InsertSupplierRate,
  type Stock,
  type InsertStock,
  type StockProperty,
  type InsertStockProperty,
  type StockColour,
  type InsertStockColour,
  type StockVariant,
  type InsertStockVariant,
  type StockColourLink,
  type InsertStockColourLink,
  type StockVariantLink,
  type InsertStockVariantLink,
  type StockCostHistory,
  type InsertStockCostHistory,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, inArray, sql as sqlOp } from "drizzle-orm";

export interface IStorage {
  // Timber sizes
  getTimberSizes(): Promise<TimberSize[]>;
  getTimberSize(id: string): Promise<TimberSize | undefined>;
  createTimberSize(data: InsertTimberSize): Promise<TimberSize>;
  updateTimberSize(id: string, data: InsertTimberSize): Promise<TimberSize>;
  deleteTimberSize(id: string): Promise<void>;
  
  // Suppliers
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(data: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, data: InsertSupplier): Promise<Supplier>;
  
  // Supplier rates
  getSupplierRates(): Promise<SupplierRate[]>;
  createSupplierRate(data: InsertSupplierRate): Promise<SupplierRate>;
  getSupplierRatesByTimberSize(timberSizeId: string): Promise<SupplierRate[]>;
  getSupplierRatesBySupplier(supplierId: string): Promise<SupplierRate[]>;
  
  // Stock
  getStockItems(): Promise<Stock[]>;
  getStockItem(id: string): Promise<Stock | undefined>;
  createStockItem(data: InsertStock): Promise<Stock>;
  updateStockItem(id: string, data: Partial<InsertStock>): Promise<Stock>;
  deleteStockItem(id: string): Promise<void>;
  
  // Stock Properties
  getStockProperties(stockId: string): Promise<StockProperty[]>;
  createStockProperty(data: InsertStockProperty): Promise<StockProperty>;
  updateStockProperty(id: string, data: Partial<InsertStockProperty>): Promise<StockProperty>;
  deleteStockProperty(id: string): Promise<void>;
  
  // Stock Colours
  getStockColours(): Promise<StockColour[]>;
  getStockColourByName(name: string): Promise<StockColour | undefined>;
  bulkUpsertColours(colours: InsertStockColour[]): Promise<StockColour[]>;
  
  // Stock Colour Links
  getStockColourLinks(stockId: string): Promise<StockColourLink[]>;
  createStockColourLink(data: InsertStockColourLink): Promise<StockColourLink>;
  deleteStockColourLink(id: string): Promise<void>;
  replaceStockColourLinks(stockId: string, colourIds: string[]): Promise<void>;
  
  // Stock Variants
  getStockVariants(): Promise<StockVariant[]>;
  getStockVariantByName(name: string): Promise<StockVariant | undefined>;
  bulkUpsertVariants(variants: InsertStockVariant[]): Promise<StockVariant[]>;
  
  // Stock Variant Links
  getStockVariantLinks(stockId: string): Promise<StockVariantLink[]>;
  createStockVariantLink(data: InsertStockVariantLink): Promise<StockVariantLink>;
  deleteStockVariantLink(id: string): Promise<void>;
  
  // Stock Cost History
  getStockCostHistory(stockId: string): Promise<StockCostHistory[]>;
  createStockCostHistory(data: InsertStockCostHistory): Promise<StockCostHistory>;
  
  // Stock items by manufacturer
  getStockByPrimarySupplier(primarySupplierId: string): Promise<Stock[]>;
  
  // Centralized stock cost update with history tracking
  updateStockCost(stockId: string, newCost: string, changeSource: 'stock_form' | 'supplier_grid' | 'system_pricing', changedBy?: string): Promise<Stock>;
}

export class DatabaseStorage implements IStorage {
  // Timber sizes
  async getTimberSizes(): Promise<TimberSize[]> {
    return await db.select().from(timberSizes).orderBy(desc(timberSizes.createdAt));
  }

  async getTimberSize(id: string): Promise<TimberSize | undefined> {
    const [timber] = await db.select().from(timberSizes).where(eq(timberSizes.id, id));
    return timber || undefined;
  }

  async createTimberSize(data: InsertTimberSize): Promise<TimberSize> {
    const thickness = data.thickness;
    const width = data.width;
    const m3Factor = (thickness * width) / 1000000;
    
    const [timber] = await db
      .insert(timberSizes)
      .values({
        ...data,
        m3Factor: m3Factor.toString(),
      })
      .returning();
    return timber;
  }

  async updateTimberSize(id: string, data: InsertTimberSize): Promise<TimberSize> {
    const thickness = data.thickness;
    const width = data.width;
    const m3Factor = (thickness * width) / 1000000;

    const [timber] = await db
      .update(timberSizes)
      .set({
        ...data,
        m3Factor: m3Factor.toString(),
      })
      .where(eq(timberSizes.id, id))
      .returning();
    return timber;
  }

  async deleteTimberSize(id: string): Promise<void> {
    await db.delete(timberSizes).where(eq(timberSizes.id, id));
  }

  // Suppliers
  async getSuppliers(): Promise<Supplier[]> {
    return await db.select().from(suppliers).orderBy(suppliers.name);
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier || undefined;
  }

  async createSupplier(data: InsertSupplier): Promise<Supplier> {
    const [supplier] = await db.insert(suppliers).values(data).returning();
    return supplier;
  }

  async updateSupplier(id: string, data: InsertSupplier): Promise<Supplier> {
    const [supplier] = await db
      .update(suppliers)
      .set(data)
      .where(eq(suppliers.id, id))
      .returning();
    return supplier;
  }

  // Supplier rates
  async getSupplierRates(): Promise<SupplierRate[]> {
    return await db
      .select()
      .from(supplierRates)
      .orderBy(desc(supplierRates.year), desc(supplierRates.month));
  }

  async createSupplierRate(data: InsertSupplierRate): Promise<SupplierRate> {
    let values: any = { ...data };
    
    if (data.timberSizeId && data.ratePerM3) {
      const timber = await this.getTimberSize(data.timberSizeId);
      if (!timber) {
        throw new Error("Timber size not found");
      }

      const m3Factor = parseFloat(timber.m3Factor);
      const ratePerM3 = parseFloat(data.ratePerM3);
      const ratePerM = ratePerM3 * m3Factor;
      
      values.ratePerM = ratePerM.toString();
    }

    const [rate] = await db
      .insert(supplierRates)
      .values(values)
      .returning();
    return rate;
  }

  async getSupplierRatesByTimberSize(timberSizeId: string): Promise<SupplierRate[]> {
    return await db
      .select()
      .from(supplierRates)
      .where(eq(supplierRates.timberSizeId, timberSizeId))
      .orderBy(desc(supplierRates.year), desc(supplierRates.month));
  }

  async getSupplierRatesBySupplier(supplierId: string): Promise<SupplierRate[]> {
    return await db
      .select()
      .from(supplierRates)
      .where(eq(supplierRates.supplierId, supplierId))
      .orderBy(desc(supplierRates.year), desc(supplierRates.month));
  }

  // Stock
  async getStockItems(): Promise<Stock[]> {
    return await db.select().from(stock).orderBy(stock.productCode);
  }

  async getStockItem(id: string): Promise<Stock | undefined> {
    const [item] = await db.select().from(stock).where(eq(stock.id, id));
    return item || undefined;
  }

  async createStockItem(data: InsertStock): Promise<Stock> {
    const [item] = await db.insert(stock).values(data).returning();
    return item;
  }

  async updateStockItem(id: string, data: Partial<InsertStock>): Promise<Stock> {
    const [item] = await db
      .update(stock)
      .set(data)
      .where(eq(stock.id, id))
      .returning();
    return item;
  }

  async deleteStockItem(id: string): Promise<void> {
    await db.delete(stock).where(eq(stock.id, id));
  }

  // Stock Properties
  async getStockProperties(stockId: string): Promise<StockProperty[]> {
    return await db
      .select()
      .from(stockProperties)
      .where(eq(stockProperties.stockId, stockId));
  }

  async createStockProperty(data: InsertStockProperty): Promise<StockProperty> {
    const [property] = await db.insert(stockProperties).values(data).returning();
    return property;
  }

  async updateStockProperty(id: string, data: Partial<InsertStockProperty>): Promise<StockProperty> {
    const [property] = await db
      .update(stockProperties)
      .set(data)
      .where(eq(stockProperties.id, id))
      .returning();
    return property;
  }

  async deleteStockProperty(id: string): Promise<void> {
    await db.delete(stockProperties).where(eq(stockProperties.id, id));
  }

  // Stock Colours
  async getStockColours(): Promise<StockColour[]> {
    console.log('[Storage] Fetching stock colours...');
    const results = await db.select().from(stockColours).orderBy(stockColours.name);
    console.log(`[Storage] Found ${results.length} colours`);
    return results;
  }

  async getStockColourByName(name: string): Promise<StockColour | undefined> {
    const [colour] = await db
      .select()
      .from(stockColours)
      .where(eq(sqlOp`UPPER(${stockColours.name})`, name.trim().toUpperCase()));
    return colour || undefined;
  }

  async bulkUpsertColours(colours: InsertStockColour[]): Promise<StockColour[]> {
    const results: StockColour[] = [];
    
    for (const colourData of colours) {
      const existing = await this.getStockColourByName(colourData.name);
      
      if (existing) {
        const hasChanged = 
          existing.description !== (colourData.description || null) ||
          existing.origin !== (colourData.origin || null);
        
        if (hasChanged) {
          const [updated] = await db
            .update(stockColours)
            .set({
              description: colourData.description,
              origin: colourData.origin,
            })
            .where(eq(stockColours.id, existing.id))
            .returning();
          results.push(updated);
        } else {
          results.push(existing);
        }
      } else {
        const [created] = await db
          .insert(stockColours)
          .values(colourData)
          .returning();
        results.push(created);
      }
    }
    
    return results;
  }
  
  // Stock Colour Links
  async getStockColourLinks(stockId: string): Promise<StockColourLink[]> {
    return await db
      .select()
      .from(stockColourLinks)
      .where(eq(stockColourLinks.stockId, stockId));
  }

  async createStockColourLink(data: InsertStockColourLink): Promise<StockColourLink> {
    const [link] = await db.insert(stockColourLinks).values(data).returning();
    return link;
  }

  async deleteStockColourLink(id: string): Promise<void> {
    await db.delete(stockColourLinks).where(eq(stockColourLinks.id, id));
  }

  async replaceStockColourLinks(stockId: string, colourIds: string[]): Promise<void> {
    await db.delete(stockColourLinks).where(eq(stockColourLinks.stockId, stockId));
    
    if (colourIds.length > 0) {
      await db.insert(stockColourLinks).values(
        colourIds.map(colourId => ({
          stockId,
          colourId,
        }))
      );
    }
  }

  // Stock Variants
  async getStockVariants(): Promise<StockVariant[]> {
    return await db.select().from(stockVariants).orderBy(stockVariants.name);
  }

  async getStockVariantByName(name: string): Promise<StockVariant | undefined> {
    const [variant] = await db
      .select()
      .from(stockVariants)
      .where(eq(sqlOp`UPPER(${stockVariants.name})`, name.trim().toUpperCase()));
    return variant || undefined;
  }

  async bulkUpsertVariants(variants: InsertStockVariant[]): Promise<StockVariant[]> {
    const results: StockVariant[] = [];
    
    for (const variantData of variants) {
      const existing = await this.getStockVariantByName(variantData.name);
      
      if (existing) {
        const hasChanged = 
          existing.description !== (variantData.description || null);
        
        if (hasChanged) {
          const [updated] = await db
            .update(stockVariants)
            .set({
              description: variantData.description,
            })
            .where(eq(stockVariants.id, existing.id))
            .returning();
          results.push(updated);
        } else {
          results.push(existing);
        }
      } else {
        const [created] = await db
          .insert(stockVariants)
          .values(variantData)
          .returning();
        results.push(created);
      }
    }
    
    return results;
  }

  // Stock Variant Links
  async getStockVariantLinks(stockId: string): Promise<StockVariantLink[]> {
    return await db
      .select()
      .from(stockVariantLinks)
      .where(eq(stockVariantLinks.stockId, stockId));
  }

  async createStockVariantLink(data: InsertStockVariantLink): Promise<StockVariantLink> {
    const [link] = await db.insert(stockVariantLinks).values(data).returning();
    return link;
  }

  async deleteStockVariantLink(id: string): Promise<void> {
    await db.delete(stockVariantLinks).where(eq(stockVariantLinks.id, id));
  }

  // Stock Supplier Links
  async getStockCostHistory(stockId: string): Promise<StockCostHistory[]> {
    return await db
      .select()
      .from(stockCostHistory)
      .where(eq(stockCostHistory.stockId, stockId))
      .orderBy(desc(stockCostHistory.changedAt));
  }

  async createStockCostHistory(data: InsertStockCostHistory): Promise<StockCostHistory> {
    const [history] = await db.insert(stockCostHistory).values(data).returning();
    return history;
  }

  async getStockByPrimarySupplier(primarySupplierId: string): Promise<Stock[]> {
    return await db
      .select()
      .from(stock)
      .where(eq(stock.primarySupplierId, primarySupplierId))
      .orderBy(stock.productCode);
  }

  async updateStockCost(
    stockId: string, 
    newCost: string, 
    changeSource: 'stock_form' | 'supplier_grid' | 'system_pricing', 
    changedBy?: string
  ): Promise<Stock> {
    // Validate and normalize new cost
    if (!newCost || newCost.trim() === '') {
      throw new Error("New cost cannot be empty");
    }

    const newCostParsed = parseFloat(newCost);
    if (isNaN(newCostParsed) || !isFinite(newCostParsed) || newCostParsed < 0) {
      throw new Error("Invalid cost value");
    }

    // Normalize to 2 decimal places
    const normalizedNewCost = newCostParsed.toFixed(2);

    // Get current stock item
    const currentStock = await this.getStockItem(stockId);
    if (!currentStock) {
      throw new Error("Stock item not found");
    }

    // Normalize current cost for comparison
    const currentCost = currentStock.supplierCost;
    const normalizedCurrentCost = currentCost ? parseFloat(currentCost).toFixed(2) : null;

    // Skip if cost hasn't changed (after normalization)
    if (normalizedCurrentCost === normalizedNewCost) {
      return currentStock;
    }

    // Create history record with previous cost
    await this.createStockCostHistory({
      stockId,
      previousCost: currentCost || undefined,
      newCost: normalizedNewCost,
      changeSource,
      changedBy,
    });

    // Update stock item with new cost
    const [updatedStock] = await db
      .update(stock)
      .set({ supplierCost: normalizedNewCost })
      .where(eq(stock.id, stockId))
      .returning();

    return updatedStock;
  }
}

export const storage = new DatabaseStorage();
