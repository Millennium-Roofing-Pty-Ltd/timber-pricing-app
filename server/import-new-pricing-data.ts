import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { db } from './db';
import { timberSizes, suppliers, supplierRates } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import iconv from 'iconv-lite';

interface SupplierDateMapping {
  supplier: string;
  date: string;
  year: number;
  month: number;
  ratePerM3Column: number;
  ratePerMeterColumn: number;
}

async function importNewPricingData(filePath: string) {
  console.log('🔄 Starting import process for 37 timber items...');
  
  // Read file with correct encoding (handles Windows format)
  const buffer = readFileSync(filePath);
  const csvContent = iconv.decode(buffer, 'ISO-8859-1');
  
  // Parse CSV with semicolon delimiter
  const rows = parse(csvContent, {
    delimiter: ';',
    relax_column_count: true,
  });
  
  console.log(`📄 Loaded ${rows.length} rows`);
  
  // Parse header structure (rows 0-2)
  const supplierRow = rows[0];
  const dateRow = rows[1];
  const columnHeaderRow = rows[2];
  
  // Build supplier-date mapping
  const supplierDateMappings: SupplierDateMapping[] = [];
  
  // Structure: "Supplier", "York", "Supplier", "York", etc.
  // Dates: "Date", "01 01 2018", "Date", "01 01 2019", etc.
  for (let i = 6; i < supplierRow.length; i += 2) {
    const supplierLabel = supplierRow[i]?.trim();
    const supplierName = supplierRow[i + 1]?.trim();
    const dateLabel = dateRow[i]?.trim();
    const dateStr = dateRow[i + 1]?.trim();
    
    if (supplierLabel !== 'Supplier' || !supplierName || !dateStr) continue;
    if (supplierName === 'System Price') break; // Stop at system price columns
    
    // Parse date (format: "01 01 2018" = DD MM YYYY)
    const dateParts = dateStr.split(' ');
    if (dateParts.length === 3) {
      const day = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]);
      const year = parseInt(dateParts[2]);
      
      supplierDateMappings.push({
        supplier: supplierName,
        date: dateStr,
        year,
        month,
        ratePerM3Column: i,
        ratePerMeterColumn: i + 1,
      });
    }
  }
  
  console.log(`📊 Found ${supplierDateMappings.length} supplier-date combinations`);
  const uniqueSuppliersSet = new Set(supplierDateMappings.map(m => m.supplier));
  console.log(`🏢 Unique suppliers: ${Array.from(uniqueSuppliersSet).join(', ')}`);
  
  // Create/get suppliers
  const supplierMap = new Map<string, string>(); // name -> id
  const uniqueSuppliers = Array.from(uniqueSuppliersSet);
  
  for (const supplierName of uniqueSuppliers) {
    const existing = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.name, supplierName))
      .limit(1);
    
    if (existing.length > 0) {
      supplierMap.set(supplierName, existing[0].id);
      console.log(`✓ Found existing supplier: ${supplierName}`);
    } else {
      const [newSupplier] = await db
        .insert(suppliers)
        .values({ name: supplierName })
        .returning();
      supplierMap.set(supplierName, newSupplier.id);
      console.log(`✨ Created supplier: ${supplierName}`);
    }
  }
  
  // Process data rows (skip first 3 header rows)
  let importedTimberCount = 0;
  let importedRateCount = 0;
  let skippedCount = 0;
  
  for (let rowIndex = 3; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    
    // Column mapping based on CSV structure:
    // W, H, GRADE, CLASSIFICATION, MM-3, LENGTH
    // User wants: thickness × width format (38x114)
    // CSV has: W (column 0) = thickness, H (column 1) = width
    const thicknessStr = row[0]?.replace(',', '.');
    const widthStr = row[1]?.replace(',', '.');
    const grade = row[2]?.trim();
    const classification = row[3]?.trim(); // Shorts, Mediums, or Longs
    const m3FactorStr = row[4]?.replace(',', '.');
    const lengthRange = row[5]?.trim();
    
    if (!thicknessStr || !widthStr || !grade || !classification || !lengthRange) {
      console.log(`⚠️  Row ${rowIndex + 1}: Missing timber specification, skipping`);
      skippedCount++;
      continue;
    }
    
    const thickness = parseFloat(thicknessStr);
    const width = parseFloat(widthStr);
    const m3Factor = parseFloat(m3FactorStr || '0');
    
    // Parse length range (e.g., "3.0 - 5.7" or "6.0 - 6.6")
    const lengthMatch = lengthRange.match(/([\d.]+)\s*-\s*([\d.]+)/);
    if (!lengthMatch) {
      console.log(`⚠️  Row ${rowIndex + 1}: Invalid length range: ${lengthRange}, skipping`);
      skippedCount++;
      continue;
    }
    
    const lengthMin = parseFloat(lengthMatch[1]);
    const lengthMax = parseFloat(lengthMatch[2]);
    
    // Find or create timber size (match on thickness, width, grade, and classification)
    const existingTimber = await db
      .select()
      .from(timberSizes)
      .where(
        and(
          eq(timberSizes.thickness, Math.round(thickness)),
          eq(timberSizes.width, Math.round(width)),
          eq(timberSizes.grade, grade),
          eq(timberSizes.classification, classification)
        )
      )
      .limit(1);
    
    let timberSizeId: string;
    
    if (existingTimber.length > 0) {
      timberSizeId = existingTimber[0].id;
    } else {
      const [newTimber] = await db
        .insert(timberSizes)
        .values({
          thickness: Math.round(thickness),
          width: Math.round(width),
          lengthMin: lengthMin.toFixed(1),
          lengthMax: lengthMax.toFixed(1),
          classification,
          grade,
          m3Factor: m3Factor.toString(),
          bufferPercentage: '10',
        })
        .returning();
      timberSizeId = newTimber.id;
      importedTimberCount++;
      console.log(`✨ Created timber: ${thickness}×${width}mm ${grade} ${classification} (${lengthMin}-${lengthMax}m)`);
    }
    
    // Import rates for each supplier-date
    for (const mapping of supplierDateMappings) {
      const ratePerM3Str = row[mapping.ratePerM3Column]?.trim();
      
      if (!ratePerM3Str || ratePerM3Str === '' || ratePerM3Str === 'R0,00' || ratePerM3Str === 'R0.00') continue;
      
      // Parse rate per m³ (format: "R 3 865,00" or "R3865,00")
      const rateM3Match = ratePerM3Str.match(/R\s*([\d\s,]+)/);
      if (!rateM3Match) continue;
      
      const ratePerM3Value = parseFloat(rateM3Match[1].replace(/\s/g, '').replace(',', '.'));
      if (isNaN(ratePerM3Value) || ratePerM3Value === 0) continue;
      
      // Calculate rate per meter: ratePerM3 × thickness(m) × width(m)
      const thicknessInMeters = thickness / 1000;
      const widthInMeters = width / 1000;
      const ratePerMValue = ratePerM3Value * thicknessInMeters * widthInMeters;
      
      const supplierId = supplierMap.get(mapping.supplier);
      if (!supplierId) continue;
      
      // Check if rate already exists
      const existingRate = await db
        .select()
        .from(supplierRates)
        .where(
          and(
            eq(supplierRates.supplierId, supplierId),
            eq(supplierRates.timberSizeId, timberSizeId),
            eq(supplierRates.year, mapping.year),
            eq(supplierRates.month, mapping.month)
          )
        )
        .limit(1);
      
      if (existingRate.length === 0) {
        await db
          .insert(supplierRates)
          .values({
            supplierId,
            timberSizeId,
            year: mapping.year,
            month: mapping.month,
            ratePerM3: ratePerM3Value.toFixed(2),
            ratePerM: ratePerMValue.toFixed(2),
          });
        importedRateCount++;
      }
    }
  }
  
  console.log(`\n✅ Import complete!`);
  console.log(`   - Timber items created: ${importedTimberCount}`);
  console.log(`   - Rates imported: ${importedRateCount}`);
  console.log(`   - Rows skipped: ${skippedCount}`);
}

// Run import
const filePath = 'attached_assets/Timber Price Revised Oct25_1760616340771.csv';
importNewPricingData(filePath)
  .then(() => {
    console.log('✨ Import completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });
