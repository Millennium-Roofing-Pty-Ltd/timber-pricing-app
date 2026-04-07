import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Timber sizes catalog
export const timberSizes = pgTable("timber_sizes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stockCode: varchar("stock_code"),
  thickness: integer("thickness").notNull(),
  width: integer("width").notNull(),
  lengthMin: decimal("length_min", { precision: 10, scale: 2 }).notNull(),
  lengthMax: decimal("length_max", { precision: 10, scale: 2 }).notNull(),
  classification: text("classification").notNull(),
  grade: text("grade").notNull(),
  m3Factor: decimal("m3_factor", { precision: 10, scale: 6 }).notNull(),
  systemRate: decimal("system_rate", { precision: 10, scale: 2 }),
  bufferPercentage: decimal("buffer_percentage", { precision: 5, scale: 2 }).default("10"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Suppliers
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  physicalAddress: text("physical_address"),
  postalAddress: text("postal_address"),
  taxNumber: text("tax_number"),
  includeInMarket: boolean("include_in_market").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Supplier rates (historical tracking by year and month for timber only)
export const supplierRates = pgTable("supplier_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierId: varchar("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  timberSizeId: varchar("timber_size_id").notNull().references(() => timberSizes.id, { onDelete: "cascade" }),
  ratePerM3: decimal("rate_per_m3", { precision: 10, scale: 2 }),
  ratePerM: decimal("rate_per_m", { precision: 10, scale: 2 }),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// System pricing history (for timber only)
export const systemPricingHistory = pgTable("system_pricing_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timberSizeId: varchar("timber_size_id").notNull().references(() => timberSizes.id, { onDelete: "cascade" }),
  systemRate: decimal("system_rate", { precision: 10, scale: 2 }),
  marketLow: decimal("market_low", { precision: 10, scale: 2 }),
  marketAvg: decimal("market_avg", { precision: 10, scale: 2 }),
  marketHigh: decimal("market_high", { precision: 10, scale: 2 }),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const timberSizesRelations = relations(timberSizes, ({ many }) => ({
  supplierRates: many(supplierRates),
  systemPricingHistory: many(systemPricingHistory),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  supplierRates: many(supplierRates),
  stockItems: many(stock), // One-to-many: supplier has many stock items
}));

export const supplierRatesRelations = relations(supplierRates, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierRates.supplierId],
    references: [suppliers.id],
  }),
  timberSize: one(timberSizes, {
    fields: [supplierRates.timberSizeId],
    references: [timberSizes.id],
  }),
}));

export const systemPricingHistoryRelations = relations(systemPricingHistory, ({ one }) => ({
  timberSize: one(timberSizes, {
    fields: [systemPricingHistory.timberSizeId],
    references: [timberSizes.id],
  }),
}));

// Insert schemas
export const insertTimberSizeSchema = createInsertSchema(timberSizes).omit({
  id: true,
  createdAt: true,
  m3Factor: true,
  systemRate: true,
}).extend({
  thickness: z.coerce.number().min(1, "Thickness must be at least 1"),
  width: z.coerce.number().min(1, "Width must be at least 1"),
  lengthMin: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid length format"),
  lengthMax: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid length format"),
  classification: z.string().min(1, "Classification is required"),
  grade: z.string().min(1, "Grade is required"),
  bufferPercentage: z.string().optional(),
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
}).extend({
  name: z.string().min(1, "Supplier name is required"),
  contactPerson: z.string().optional(),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string().optional(),
  physicalAddress: z.string().optional(),
  postalAddress: z.string().optional(),
  taxNumber: z.string().optional(),
});

export const insertSupplierRateSchema = createInsertSchema(supplierRates).omit({
  id: true,
  createdAt: true,
  ratePerM: true,
}).extend({
  ratePerM3: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid rate format"),
  year: z.coerce.number().min(2000).max(2100),
  month: z.coerce.number().min(1).max(12),
  timberSizeId: z.string().min(1, "Timber size is required"),
});

export const insertSystemPricingHistorySchema = createInsertSchema(systemPricingHistory).omit({
  id: true,
  createdAt: true,
}).extend({
  systemRate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid rate format"),
  year: z.coerce.number().min(2000).max(2100),
  month: z.coerce.number().min(1).max(12),
  timberSizeId: z.string().min(1, "Timber size is required"),
});

// Types
export type TimberSize = typeof timberSizes.$inferSelect;
export type InsertTimberSize = z.infer<typeof insertTimberSizeSchema>;

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;

export type SupplierRate = typeof supplierRates.$inferSelect;
export type InsertSupplierRate = z.infer<typeof insertSupplierRateSchema>;

export type SystemPricingHistory = typeof systemPricingHistory.$inferSelect;
export type InsertSystemPricingHistory = z.infer<typeof insertSystemPricingHistorySchema>;

// Extended types for UI
export type TimberSizeWithRates = TimberSize & {
  supplierRates: (SupplierRate & { supplier: Supplier })[];
};

export type SupplierWithLatestRate = Supplier & {
  latestRate?: SupplierRate;
  previousRate?: SupplierRate;
  percentageIncrease?: number;
};

// ===== STOCK MODULE TABLES =====

// Lookup Tables (Tables 2-9)
export const stockRelations = pgTable("stock_relations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockBehaviours = pgTable("stock_behaviours", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockTypes = pgTable("stock_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockUoms = pgTable("stock_uoms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  factor: text("factor"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockPropertyDefinitions = pgTable("stock_property_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  uom: text("uom"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockColours = pgTable("stock_colours", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  origin: text("origin"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockVariants = pgTable("stock_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockMarkupGroups = pgTable("stock_markup_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockDiscountGroups = pgTable("stock_discount_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockMarginGroups = pgTable("stock_margin_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockTallies = pgTable("stock_tallies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Main Stock Table (Table 1)
export const stock = pgTable("stock", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productCode: text("product_code").notNull().unique(),
  partcode: text("partcode"),
  itemHierarchy: text("item_hierarchy"),
  description: text("description").notNull(),
  notes: text("notes"),
  
  // Costing Information
  supplierCost: decimal("supplier_cost", { precision: 10, scale: 2 }),
  averageCost: decimal("average_cost", { precision: 10, scale: 2 }),
  lastCost: decimal("last_cost", { precision: 10, scale: 2 }),
  highestCost: decimal("highest_cost", { precision: 10, scale: 2 }),
  
  // Stocking Information
  maxQuantity: integer("max_quantity"),
  qtyOnHand: integer("qty_on_hand"),
  
  // Lookups (Foreign Keys)
  relationId: varchar("relation_id").references(() => stockRelations.id),
  behaviourId: varchar("behaviour_id").references(() => stockBehaviours.id),
  typeId: varchar("type_id").references(() => stockTypes.id),
  stockUnitId: varchar("stock_unit_id").references(() => stockUoms.id),
  purchaseUnitId: varchar("purchase_unit_id").references(() => stockUoms.id),
  salesUnitId: varchar("sales_unit_id").references(() => stockUoms.id),
  primarySupplierId: varchar("primary_supplier_id").references(() => suppliers.id),
  markupGroupId: varchar("markup_group_id").references(() => stockMarkupGroups.id),
  discountGroupId: varchar("discount_group_id").references(() => stockDiscountGroups.id),
  marginGroupId: varchar("margin_group_id").references(() => stockMarginGroups.id),
  
  status: boolean("status").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Junction Tables for Many-to-Many Relationships
export const stockProperties = pgTable("stock_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stockId: varchar("stock_id").notNull().references(() => stock.id, { onDelete: "cascade" }),
  propertyDefinitionId: varchar("property_definition_id").notNull().references(() => stockPropertyDefinitions.id),
  value: text("value"),
  unit: text("unit"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockColourLinks = pgTable("stock_colour_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stockId: varchar("stock_id").notNull().references(() => stock.id, { onDelete: "cascade" }),
  colourId: varchar("colour_id").notNull().references(() => stockColours.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockVariantLinks = pgTable("stock_variant_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stockId: varchar("stock_id").notNull().references(() => stock.id, { onDelete: "cascade" }),
  variantId: varchar("variant_id").notNull().references(() => stockVariants.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockSupplierLinks = pgTable("stock_supplier_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stockId: varchar("stock_id").notNull().references(() => stock.id, { onDelete: "cascade" }),
  supplierId: varchar("supplier_id").notNull().references(() => suppliers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Stock Cost History - tracks changes to stock.supplierCost
export const stockCostHistory = pgTable("stock_cost_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stockId: varchar("stock_id").notNull().references(() => stock.id, { onDelete: "cascade" }),
  previousCost: decimal("previous_cost", { precision: 10, scale: 2 }),
  newCost: decimal("new_cost", { precision: 10, scale: 2 }).notNull(),
  changeSource: text("change_source").notNull(), // 'stock_form', 'supplier_grid', 'system_pricing'
  changedBy: text("changed_by"), // Optional: username or system identifier
  changedAt: timestamp("changed_at").defaultNow().notNull(),
});

// Composite Stock Items (for Type = Composite)
export const stockCompositeItems = pgTable("stock_composite_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parentStockId: varchar("parent_stock_id").notNull().references(() => stock.id, { onDelete: "cascade" }),
  componentStockId: varchar("component_stock_id").notNull().references(() => stock.id, { onDelete: "cascade" }),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitId: varchar("unit_id").references(() => stockUoms.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tally Items (for Behaviour = Tally)
export const stockTallyItems = pgTable("stock_tally_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stockId: varchar("stock_id").notNull().references(() => stock.id, { onDelete: "cascade" }),
  tallyId: varchar("tally_id").notNull().references(() => stockTallies.id),
  quantity: integer("quantity").notNull(),
  length: decimal("length", { precision: 10, scale: 2 }).notNull(),
  unitId: varchar("unit_id").references(() => stockUoms.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Stock Relations Definitions
export const stockRelationsDef = relations(stock, ({ one, many }) => ({
  relation: one(stockRelations, {
    fields: [stock.relationId],
    references: [stockRelations.id],
  }),
  behaviour: one(stockBehaviours, {
    fields: [stock.behaviourId],
    references: [stockBehaviours.id],
  }),
  type: one(stockTypes, {
    fields: [stock.typeId],
    references: [stockTypes.id],
  }),
  stockUnit: one(stockUoms, {
    fields: [stock.stockUnitId],
    references: [stockUoms.id],
  }),
  purchaseUnit: one(stockUoms, {
    fields: [stock.purchaseUnitId],
    references: [stockUoms.id],
  }),
  salesUnit: one(stockUoms, {
    fields: [stock.salesUnitId],
    references: [stockUoms.id],
  }),
  primarySupplier: one(suppliers, {
    fields: [stock.primarySupplierId],
    references: [suppliers.id],
  }),
  markupGroup: one(stockMarkupGroups, {
    fields: [stock.markupGroupId],
    references: [stockMarkupGroups.id],
  }),
  discountGroup: one(stockDiscountGroups, {
    fields: [stock.discountGroupId],
    references: [stockDiscountGroups.id],
  }),
  marginGroup: one(stockMarginGroups, {
    fields: [stock.marginGroupId],
    references: [stockMarginGroups.id],
  }),
  properties: many(stockProperties),
  colours: many(stockColourLinks),
  variants: many(stockVariantLinks),
  costHistory: many(stockCostHistory),
  compositeItems: many(stockCompositeItems, { relationName: "parentStock" }),
  tallyItems: many(stockTallyItems),
}));

export const stockPropertiesRelations = relations(stockProperties, ({ one }) => ({
  stock: one(stock, {
    fields: [stockProperties.stockId],
    references: [stock.id],
  }),
  propertyDefinition: one(stockPropertyDefinitions, {
    fields: [stockProperties.propertyDefinitionId],
    references: [stockPropertyDefinitions.id],
  }),
}));

export const stockColourLinksRelations = relations(stockColourLinks, ({ one }) => ({
  stock: one(stock, {
    fields: [stockColourLinks.stockId],
    references: [stock.id],
  }),
  colour: one(stockColours, {
    fields: [stockColourLinks.colourId],
    references: [stockColours.id],
  }),
}));

export const stockVariantLinksRelations = relations(stockVariantLinks, ({ one }) => ({
  stock: one(stock, {
    fields: [stockVariantLinks.stockId],
    references: [stock.id],
  }),
  variant: one(stockVariants, {
    fields: [stockVariantLinks.variantId],
    references: [stockVariants.id],
  }),
}));

export const stockCostHistoryRelations = relations(stockCostHistory, ({ one }) => ({
  stock: one(stock, {
    fields: [stockCostHistory.stockId],
    references: [stock.id],
  }),
}));

export const stockCompositeItemsRelations = relations(stockCompositeItems, ({ one }) => ({
  parentStock: one(stock, {
    fields: [stockCompositeItems.parentStockId],
    references: [stock.id],
    relationName: "parentStock",
  }),
  componentStock: one(stock, {
    fields: [stockCompositeItems.componentStockId],
    references: [stock.id],
    relationName: "componentStock",
  }),
  unit: one(stockUoms, {
    fields: [stockCompositeItems.unitId],
    references: [stockUoms.id],
  }),
}));

export const stockTallyItemsRelations = relations(stockTallyItems, ({ one }) => ({
  stock: one(stock, {
    fields: [stockTallyItems.stockId],
    references: [stock.id],
  }),
  tally: one(stockTallies, {
    fields: [stockTallyItems.tallyId],
    references: [stockTallies.id],
  }),
  unit: one(stockUoms, {
    fields: [stockTallyItems.unitId],
    references: [stockUoms.id],
  }),
}));

// Insert Schemas for Stock Module
export const insertStockRelationSchema = createInsertSchema(stockRelations).omit({
  id: true,
  createdAt: true,
});

export const insertStockBehaviourSchema = createInsertSchema(stockBehaviours).omit({
  id: true,
  createdAt: true,
});

export const insertStockTypeSchema = createInsertSchema(stockTypes).omit({
  id: true,
  createdAt: true,
});

export const insertStockUomSchema = createInsertSchema(stockUoms).omit({
  id: true,
  createdAt: true,
});

export const insertStockPropertyDefinitionSchema = createInsertSchema(stockPropertyDefinitions).omit({
  id: true,
  createdAt: true,
});

export const insertStockColourSchema = createInsertSchema(stockColours).omit({
  id: true,
  createdAt: true,
});

export const insertStockVariantSchema = createInsertSchema(stockVariants).omit({
  id: true,
  createdAt: true,
});

export const insertStockMarkupGroupSchema = createInsertSchema(stockMarkupGroups).omit({
  id: true,
  createdAt: true,
});

export const insertStockDiscountGroupSchema = createInsertSchema(stockDiscountGroups).omit({
  id: true,
  createdAt: true,
});

export const insertStockMarginGroupSchema = createInsertSchema(stockMarginGroups).omit({
  id: true,
  createdAt: true,
});

export const insertStockTallySchema = createInsertSchema(stockTallies).omit({
  id: true,
  createdAt: true,
});

export const insertStockPropertySchema = createInsertSchema(stockProperties).omit({
  id: true,
  createdAt: true,
});

export const insertStockCompositeItemSchema = createInsertSchema(stockCompositeItems).omit({
  id: true,
  createdAt: true,
});

export const insertStockTallyItemSchema = createInsertSchema(stockTallyItems).omit({
  id: true,
  createdAt: true,
});

export const insertStockSchema = createInsertSchema(stock).omit({
  id: true,
  createdAt: true,
}).extend({
  productCode: z.string().min(1, "Product code is required"),
  description: z.string().min(1, "Description is required"),
  supplierCost: z.string().optional(),
  averageCost: z.string().optional(),
  lastCost: z.string().optional(),
  highestCost: z.string().optional(),
});

export const insertStockColourLinkSchema = createInsertSchema(stockColourLinks).omit({
  id: true,
  createdAt: true,
});

export const insertStockVariantLinkSchema = createInsertSchema(stockVariantLinks).omit({
  id: true,
  createdAt: true,
});

export const insertStockSupplierLinkSchema = createInsertSchema(stockSupplierLinks).omit({
  id: true,
  createdAt: true,
});

export const insertStockCostHistorySchema = createInsertSchema(stockCostHistory).omit({
  id: true,
  changedAt: true,
}).extend({
  newCost: z.string().min(1, "New cost is required"),
  previousCost: z.string().optional(),
  changeSource: z.enum(["stock_form", "supplier_grid", "system_pricing"]),
  changedBy: z.string().optional(),
});

// Types for Stock Module
export type StockRelation = typeof stockRelations.$inferSelect;
export type InsertStockRelation = z.infer<typeof insertStockRelationSchema>;

export type StockBehaviour = typeof stockBehaviours.$inferSelect;
export type InsertStockBehaviour = z.infer<typeof insertStockBehaviourSchema>;

export type StockType = typeof stockTypes.$inferSelect;
export type InsertStockType = z.infer<typeof insertStockTypeSchema>;

export type StockUom = typeof stockUoms.$inferSelect;
export type InsertStockUom = z.infer<typeof insertStockUomSchema>;

export type StockPropertyDefinition = typeof stockPropertyDefinitions.$inferSelect;
export type InsertStockPropertyDefinition = z.infer<typeof insertStockPropertyDefinitionSchema>;

export type StockColour = typeof stockColours.$inferSelect;
export type InsertStockColour = z.infer<typeof insertStockColourSchema>;

export type StockVariant = typeof stockVariants.$inferSelect;
export type InsertStockVariant = z.infer<typeof insertStockVariantSchema>;

export type StockMarkupGroup = typeof stockMarkupGroups.$inferSelect;
export type InsertStockMarkupGroup = z.infer<typeof insertStockMarkupGroupSchema>;

export type StockDiscountGroup = typeof stockDiscountGroups.$inferSelect;
export type InsertStockDiscountGroup = z.infer<typeof insertStockDiscountGroupSchema>;

export type StockMarginGroup = typeof stockMarginGroups.$inferSelect;
export type InsertStockMarginGroup = z.infer<typeof insertStockMarginGroupSchema>;

export type StockTally = typeof stockTallies.$inferSelect;
export type InsertStockTally = z.infer<typeof insertStockTallySchema>;

export type Stock = typeof stock.$inferSelect;
export type InsertStock = z.infer<typeof insertStockSchema>;

export type StockProperty = typeof stockProperties.$inferSelect;
export type InsertStockProperty = z.infer<typeof insertStockPropertySchema>;

export type StockColourLink = typeof stockColourLinks.$inferSelect;
export type InsertStockColourLink = z.infer<typeof insertStockColourLinkSchema>;

export type StockVariantLink = typeof stockVariantLinks.$inferSelect;
export type InsertStockVariantLink = z.infer<typeof insertStockVariantLinkSchema>;

export type StockCostHistory = typeof stockCostHistory.$inferSelect;
export type InsertStockCostHistory = z.infer<typeof insertStockCostHistorySchema>;

export type StockCompositeItem = typeof stockCompositeItems.$inferSelect;
export type InsertStockCompositeItem = z.infer<typeof insertStockCompositeItemSchema>;

export type StockTallyItem = typeof stockTallyItems.$inferSelect;
export type InsertStockTallyItem = z.infer<typeof insertStockTallyItemSchema>;

// Extended types for UI
export type StockWithDetails = Stock & {
  relation?: StockRelation | null;
  behaviour?: StockBehaviour | null;
  type?: StockType | null;
  stockUnit?: StockUom | null;
  purchaseUnit?: StockUom | null;
  salesUnit?: StockUom | null;
  manufacturer?: Supplier | null;
  markupGroup?: StockMarkupGroup | null;
  discountGroup?: StockDiscountGroup | null;
  marginGroup?: StockMarginGroup | null;
  properties: (StockProperty & { propertyDefinition: StockPropertyDefinition })[];
  colours: (StockColourLink & { colour: StockColour })[];
  variants: (StockVariantLink & { variant: StockVariant })[];
  costHistory?: StockCostHistory[];
  compositeItems?: (StockCompositeItem & { componentStock: Stock; unit?: StockUom | null })[];
  tallyItems?: (StockTallyItem & { tally: StockTally; unit?: StockUom | null })[];
};
