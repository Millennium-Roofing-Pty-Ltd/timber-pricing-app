import XLSX from 'xlsx';
import * as fs from 'fs';
import { db } from './db';
import {
  stockRelations,
  stockBehaviours,
  stockTypes,
  stockUoms,
  stockPropertyDefinitions,
  stockColours,
  stockVariants,
  stockMarkupGroups,
  stockDiscountGroups,
  stock,
  stockProperties,
  stockColourLinks,
  stockVariantLinks,
  suppliers,
} from '@shared/schema';
import { eq } from 'drizzle-orm';

// Find the Excel file
const files = fs.readdirSync('attached_assets');
const excelFile = files.find(f => f.includes('Mitek') && f.endsWith('.xlsx'));

if (!excelFile) {
  console.error('❌ Excel file not found');
  process.exit(1);
}

const filePath = `attached_assets/${excelFile}`;
console.log(`📊 Reading file: ${filePath}\n`);

// Read the workbook
const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });

// Helper function to get or create a record
async function getOrCreateRelation(name: string, description?: string) {
  if (!name || name.trim() === '') return null;
  
  const existing = await db.select().from(stockRelations).where(eq(stockRelations.name, name.trim())).limit(1);
  if (existing.length > 0) return existing[0].id;
  
  const [created] = await db.insert(stockRelations).values({
    name: name.trim(),
    description: description?.trim() || null,
  }).returning();
  
  return created.id;
}

async function getOrCreateBehaviour(description: string, notes?: string) {
  if (!description || description.trim() === '') return null;
  
  const existing = await db.select().from(stockBehaviours).where(eq(stockBehaviours.description, description.trim())).limit(1);
  if (existing.length > 0) return existing[0].id;
  
  const [created] = await db.insert(stockBehaviours).values({
    description: description.trim(),
    notes: notes?.trim() || null,
  }).returning();
  
  return created.id;
}

async function getOrCreateType(description: string, notes?: string) {
  if (!description || description.trim() === '') return null;
  
  const existing = await db.select().from(stockTypes).where(eq(stockTypes.description, description.trim())).limit(1);
  if (existing.length > 0) return existing[0].id;
  
  const [created] = await db.insert(stockTypes).values({
    description: description.trim(),
    notes: notes?.trim() || null,
  }).returning();
  
  return created.id;
}

async function getOrCreateUom(description: string, factor?: any, notes?: string) {
  if (!description || description.trim() === '') return null;
  
  const existing = await db.select().from(stockUoms).where(eq(stockUoms.description, description.trim())).limit(1);
  if (existing.length > 0) return existing[0].id;
  
  // Parse factor - handle non-numeric values
  let factorValue = null;
  if (factor !== undefined && factor !== null && factor !== '') {
    const factorStr = factor.toString().trim();
    // Try to extract just the number part (remove superscripts, etc)
    const numMatch = factorStr.match(/^[\d.]+/);
    if (numMatch) {
      const parsed = parseFloat(numMatch[0]);
      if (!isNaN(parsed) && isFinite(parsed)) {
        factorValue = parsed.toString();
      }
    }
  }
  
  const [created] = await db.insert(stockUoms).values({
    description: description.trim(),
    factor: factorValue,
    notes: notes?.trim() || null,
  }).returning();
  
  return created.id;
}

async function getOrCreatePropertyDefinition(description: string, uom?: string) {
  if (!description || description.trim() === '') return null;
  
  const existing = await db.select().from(stockPropertyDefinitions).where(eq(stockPropertyDefinitions.description, description.trim())).limit(1);
  if (existing.length > 0) return existing[0].id;
  
  const [created] = await db.insert(stockPropertyDefinitions).values({
    description: description.trim(),
    uom: uom?.trim() || null,
  }).returning();
  
  return created.id;
}

async function getOrCreateColour(name: string) {
  if (!name || name.trim() === '') return null;
  
  const existing = await db.select().from(stockColours).where(eq(stockColours.name, name.trim())).limit(1);
  if (existing.length > 0) return existing[0].id;
  
  const [created] = await db.insert(stockColours).values({
    name: name.trim(),
  }).returning();
  
  return created.id;
}

async function getOrCreateVariant(name: string, description?: string) {
  if (!name || name.trim() === '') return null;
  
  const existing = await db.select().from(stockVariants).where(eq(stockVariants.name, name.trim())).limit(1);
  if (existing.length > 0) return existing[0].id;
  
  const [created] = await db.insert(stockVariants).values({
    name: name.trim(),
    description: description?.trim() || null,
  }).returning();
  
  return created.id;
}

async function getOrCreateMarkupGroup(name: string, description?: string) {
  if (!name || name.trim() === '') return null;
  
  const existing = await db.select().from(stockMarkupGroups).where(eq(stockMarkupGroups.name, name.trim())).limit(1);
  if (existing.length > 0) return existing[0].id;
  
  const [created] = await db.insert(stockMarkupGroups).values({
    name: name.trim(),
    description: description?.trim() || null,
  }).returning();
  
  return created.id;
}

async function getOrCreateDiscountGroup(name: string, description?: string) {
  if (!name || name.trim() === '') return null;
  
  const existing = await db.select().from(stockDiscountGroups).where(eq(stockDiscountGroups.name, name.trim())).limit(1);
  if (existing.length > 0) return existing[0].id;
  
  const [created] = await db.insert(stockDiscountGroups).values({
    name: name.trim(),
    description: description?.trim() || null,
  }).returning();
  
  return created.id;
}

async function getOrCreateSupplier(name: string) {
  if (!name || name.trim() === '') return null;
  
  const existing = await db.select().from(suppliers).where(eq(suppliers.name, name.trim())).limit(1);
  if (existing.length > 0) return existing[0].id;
  
  const [created] = await db.insert(suppliers).values({
    name: name.trim(),
  }).returning();
  
  return created.id;
}

async function importLookupTables() {
  console.log('📋 Step 1: Importing lookup tables (Tables 2-9)...\n');
  
  // Import Relations
  const relationSheet = workbook.Sheets['Relation'];
  if (relationSheet) {
    const relationData = XLSX.utils.sheet_to_json(relationSheet);
    console.log(`  Importing ${relationData.length} Relations...`);
    for (const row of relationData as any[]) {
      if (row['Name']) {
        await getOrCreateRelation(row['Name'], row['Description']);
      }
    }
    console.log(`  ✓ Relations imported\n`);
  }
  
  // Import Behaviours
  const behaviourSheet = workbook.Sheets['Behaviour'];
  if (behaviourSheet) {
    const behaviourData = XLSX.utils.sheet_to_json(behaviourSheet);
    console.log(`  Importing ${behaviourData.length} Behaviours...`);
    for (const row of behaviourData as any[]) {
      if (row['Description']) {
        await getOrCreateBehaviour(row['Description'], row['Notes']);
      }
    }
    console.log(`  ✓ Behaviours imported\n`);
  }
  
  // Import Types
  const typeSheet = workbook.Sheets['Type'];
  if (typeSheet) {
    const typeData = XLSX.utils.sheet_to_json(typeSheet);
    console.log(`  Importing ${typeData.length} Types...`);
    for (const row of typeData as any[]) {
      if (row['Description ']) { // Note the space in the Excel column
        await getOrCreateType(row['Description '], row['Notes']);
      }
    }
    console.log(`  ✓ Types imported\n`);
  }
  
  // Import UOMs
  const uomSheet = workbook.Sheets["UOM's"];
  if (uomSheet) {
    const uomData = XLSX.utils.sheet_to_json(uomSheet);
    console.log(`  Importing ${uomData.length} UOMs...`);
    for (const row of uomData as any[]) {
      if (row['Description']) {
        await getOrCreateUom(row['Description'], row['Factor'], row['Notes']);
      }
    }
    console.log(`  ✓ UOMs imported\n`);
  }
  
  // Import Property Definitions
  const propSheet = workbook.Sheets['Properties'];
  if (propSheet) {
    const propData = XLSX.utils.sheet_to_json(propSheet);
    console.log(`  Importing ${propData.length} Property Definitions...`);
    for (const row of propData as any[]) {
      if (row['Description']) {
        await getOrCreatePropertyDefinition(row['Description'], row['UOM']);
      }
    }
    console.log(`  ✓ Property Definitions imported\n`);
  }
  
  // Import Colours
  const colourSheet = workbook.Sheets['Colour'];
  if (colourSheet) {
    const colourData = XLSX.utils.sheet_to_json(colourSheet);
    console.log(`  Importing ${colourData.length} Colours...`);
    for (const row of colourData as any[]) {
      if (row['Name']) {
        await getOrCreateColour(row['Name']);
      }
    }
    console.log(`  ✓ Colours imported\n`);
  }
  
  // Import Variants
  const variantSheet = workbook.Sheets['Variant'];
  if (variantSheet) {
    const variantData = XLSX.utils.sheet_to_json(variantSheet);
    console.log(`  Importing ${variantData.length} Variants...`);
    for (const row of variantData as any[]) {
      if (row['Name']) {
        await getOrCreateVariant(row['Name'], row['Description']);
      }
    }
    console.log(`  ✓ Variants imported\n`);
  }
  
  // Import Markup Groups
  const markupSheet = workbook.Sheets['Markup Group'];
  if (markupSheet) {
    const markupData = XLSX.utils.sheet_to_json(markupSheet);
    console.log(`  Importing ${markupData.length} Markup Groups...`);
    for (const row of markupData as any[]) {
      if (row['Name']) {
        await getOrCreateMarkupGroup(row['Name'], row['Description']);
      }
    }
    console.log(`  ✓ Markup Groups imported\n`);
  }
  
  // Import Discount Groups
  const discountSheet = workbook.Sheets['Discount Group'];
  if (discountSheet) {
    const discountData = XLSX.utils.sheet_to_json(discountSheet);
    console.log(`  Importing ${discountData.length} Discount Groups...`);
    for (const row of discountData as any[]) {
      if (row['Name']) {
        await getOrCreateDiscountGroup(row['Name'], row['Description']);
      }
    }
    console.log(`  ✓ Discount Groups imported\n`);
  }
}

async function importStockData() {
  console.log('📦 Step 2: Importing Stock data (Table 1)...\n');
  
  // Find the stock sheet - it might have a space after [L4]
  const sheetName = workbook.SheetNames.find(name => name.includes('Stock'));
  if (!sheetName) {
    console.error('❌ Stock sheet not found. Available sheets:', workbook.SheetNames);
    return;
  }
  
  console.log(`  Using sheet: "${sheetName}"\n`);
  const stockSheet = workbook.Sheets[sheetName];
  if (!stockSheet) {
    console.error('❌ Could not access stock sheet');
    return;
  }
  
  // Headers are on row 2, data starts on row 4 (skip row 3 which is blank)
  const stockData = XLSX.utils.sheet_to_json(stockSheet, { 
    range: 1,  // Start from row 2 (index 1) for headers
  });
  console.log(`  Total stock items to import: ${stockData.length}\n`);
  
  let imported = 0;
  let skipped = 0;
  
  for (const row of stockData as any[]) {
    try {
      const productCode = row['Product Code'];
      if (!productCode) {
        if (imported === 0 && skipped < 5) {
          console.log(`  Skipping row - no product code. Available keys:`, Object.keys(row).slice(0, 5));
        }
        skipped++;
        continue;
      }
      
      // Check if already exists
      const existing = await db.select().from(stock).where(eq(stock.productCode, productCode)).limit(1);
      if (existing.length > 0) {
        skipped++;
        continue;
      }
      
      // Get or create lookups
      const relationId = await getOrCreateRelation(row['Relation (Lookup)']);
      const behaviourId = await getOrCreateBehaviour(row['Behaviour (Lookup)']);
      const typeId = await getOrCreateType(row['Item Type (Lookup)']);
      const stockUnitId = await getOrCreateUom(row['UOM_Stock Unit (Lookup)']);
      const purchaseUnitId = await getOrCreateUom(row['UOM_Purchase Unit (Lookup)']);
      const salesUnitId = await getOrCreateUom(row['UOM_Sales Unit (Lookup)']);
      const primarySupplierId = await getOrCreateSupplier(row['Manufacturer (Lookup)']);
      const markupGroupId = await getOrCreateMarkupGroup(row['Markup Category']);
      const discountGroupId = await getOrCreateDiscountGroup(row['Discount Category']);
      
      // Insert stock item
      const [stockItem] = await db.insert(stock).values({
        productCode: productCode,
        partcode: row['Partcode'] || null,
        itemHierarchy: row['Item Hiearchy'] || null,  // Note: typo in Excel
        description: row['Description'] || '',
        notes: row['Notes'] || null,
        cost: row['Cost']?.toString() || null,
        maxQuantity: row['Max Quantity'] ? parseInt(row['Max Quantity']) : null,
        relationId,
        behaviourId,
        typeId,
        stockUnitId,
        purchaseUnitId,
        salesUnitId,
        primarySupplierId,
        markupGroupId,
        discountGroupId,
        status: row['Status'] === 'Yes' || row['Status'] === true,
      }).returning();
      
      // Handle Properties (Columns N-AM)
      const propertyColumns = [
        'Properties_Box Qty', 'Properties_Bundle Size', 'Properties_Pallet Size',
        'Properties_ACT_Thickness', 'Properties_ACT_Width', 'Properties_ACT_Length',
        'Properties_NOM_Thickness', 'Properties_NOM_Width', 'Properties_NOM_Length',
        'Properties_Diameter', 'Properties_Depth', 'Properties_Height',
        'Properties_Cover Width', 'Properties_Coil Width', 'Properties_Weight',
        'Properties_Weight (Treated)', 'Properties_m /Ton', 'Properties_Surface Area m2',
        'Properties_Area m2', 'Properties_Area m2 Nominal', 'Properties_Volume m3',
        'Properties_Volume m3 Nominal', 'Properties_Material Type', 'Properties_Visual Grade',
        'Properties_Strength Grade', 'Properties_Class',
      ];
      
      for (const propCol of propertyColumns) {
        const value = row[propCol];
        if (value !== undefined && value !== null && value !== '') {
          const propName = propCol.replace('Properties_', '');
          const propDefId = await getOrCreatePropertyDefinition(propName);
          if (propDefId) {
            await db.insert(stockProperties).values({
              stockId: stockItem.id,
              propertyDefinitionId: propDefId,
              value: value.toString(),
            });
          }
        }
      }
      
      // Handle Colours (Column AO) - Allow Multiple Variants
      const colourStr = row['Colour (Lookup (Allow Multiple Variants)'];
      if (colourStr) {
        const colours = colourStr.toString().split(/[,;\/]/).map((c: string) => c.trim());
        for (const colour of colours) {
          if (colour) {
            const colourId = await getOrCreateColour(colour);
            if (colourId) {
              await db.insert(stockColourLinks).values({
                stockId: stockItem.id,
                colourId,
              });
            }
          }
        }
      }
      
      // Handle Variants (Column AP) - Allow Multiple Variants
      const variantStr = row['Variant (Lookup Allow Multiple Variants)'];
      if (variantStr) {
        const variants = variantStr.toString().split(/[,;\/]/).map((v: string) => v.trim());
        for (const variant of variants) {
          if (variant) {
            const variantId = await getOrCreateVariant(variant);
            if (variantId) {
              await db.insert(stockVariantLinks).values({
                stockId: stockItem.id,
                variantId,
              });
            }
          }
        }
      }
      
      imported++;
      if (imported % 50 === 0) {
        process.stdout.write(`\r  Imported ${imported}/${stockData.length} stock items...`);
      }
      
    } catch (error: any) {
      console.error(`\n  ⚠️  Error importing ${row['Product Code']}:`, error.message);
      skipped++;
    }
  }
  
  console.log(`\n\n  ✓ Stock import complete!`);
  console.log(`    - Imported: ${imported}`);
  console.log(`    - Skipped: ${skipped}`);
}

async function main() {
  console.log('🚀 Starting Stock Data Import\n');
  console.log('=' .repeat(50) + '\n');
  
  try {
    await importLookupTables();
    await importStockData();
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Import completed successfully!\n');
    
  } catch (error: any) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
