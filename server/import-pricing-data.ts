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
  ratePerMColumn: number;
  ratePerMeterColumn: number;
}

interface TimberSpec {
  width: number;
  thickness: number;
  grade: string;
  lengthMin: number;
  lengthMax: number;
  m3Factor: number;
  classification: string;
}

async function importPricingData(filePath: string) {
  console.log('🔄 Starting import process...');
  
  // Read file with correct encoding
  const buffer = readFileSync(filePath);
  const csvContent = iconv.decode(buffer, 'ISO-8859-1');
  
  // Parse CSV
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
  
  // The structure is: "Supplier", "York", "Supplier", "York", etc.
  // And dates are: "Date", "01 01 2018", "Date", "01 01 2019", etc.
  for (let i = 5; i < supplierRow.length - 1; i += 2) {
    const supplierLabel = supplierRow[i]?.trim();
    const supplierName = supplierRow[i + 1]?.trim();
    const dateLabel = dateRow[i]?.trim();
    const dateStr = dateRow[i + 1]?.trim();
    
    if (supplierLabel !== 'Supplier' || !supplierName || !dateStr) continue;
    if (supplierName === 'System Price') continue;
    
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
        ratePerMColumn: i,
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
  let importedCount = 0;
  let skippedCount = 0;
  
  for (let rowIndex = 3; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    
    // Parse timber specification
    const widthStr = row[0]?.replace(',', '.');
    const thicknessStr = row[1]?.replace(',', '.');
    const grade = row[2]?.trim();
    const m3FactorStr = row[3]?.replace(',', '.');
    const lengthRange = row[4]?.trim();
    
    if (!widthStr || !thicknessStr || !grade || !lengthRange) {
      console.log(`⚠️  Row ${rowIndex + 1}: Missing timber specification, skipping`);
      skippedCount++;
      continue;
    }
    
    const width = parseFloat(widthStr);
    const thickness = parseFloat(thicknessStr);
    const m3Factor = parseFloat(m3FactorStr || '0');
    
    // Parse length range
    const lengthMatch = lengthRange.match(/([\d.]+)\s*-\s*([\d.]+)/);
    if (!lengthMatch) {
      console.log(`⚠️  Row ${rowIndex + 1}: Invalid length range: ${lengthRange}, skipping`);
      skippedCount++;
      continue;
    }
    
    const lengthMin = parseFloat(lengthMatch[1]);
    const lengthMax = parseFloat(lengthMatch[2]);
    
    // Determine classification based on grade
    const classification = grade.includes('BBB') ? 'Premium' : 
                          grade.includes('S') ? 'Standard' : 
                          'Industrial';
    
    // Find or create timber size
    const existingTimber = await db
      .select()
      .from(timberSizes)
      .where(
        and(
          eq(timberSizes.thickness, Math.round(thickness)),
          eq(timberSizes.width, Math.round(width)),
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
          lengthMin: lengthMin.toString(),
          lengthMax: lengthMax.toString(),
          classification,
          grade,
          m3Factor: m3Factor.toString(),
          bufferPercentage: '10',
        })
        .returning();
      timberSizeId = newTimber.id;
      console.log(`✨ Created timber: ${width}×${thickness}mm ${grade} (${lengthMin}-${lengthMax}m)`);
    }
    
    // Import rates for each supplier-date
    for (const mapping of supplierDateMappings) {
      const ratePerM3Str = row[mapping.ratePerMColumn]?.trim();
      const ratePerMStr = row[mapping.ratePerMeterColumn]?.trim();
      
      if (!ratePerM3Str || ratePerM3Str === '') continue;
      
      // Parse rate per m³ (format: "R 3 865,00" or "R3865,00")
      const rateM3Match = ratePerM3Str.match(/R\s*([\d\s,]+)/);
      if (!rateM3Match) continue;
      
      const ratePerM3Value = parseFloat(rateM3Match[1].replace(/\s/g, '').replace(',', '.'));
      if (isNaN(ratePerM3Value) || ratePerM3Value === 0) continue;
      
      // Calculate rate per meter: ratePerM3 × thickness(m) × width(m)
      // Convert mm to meters by dividing by 1000
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
            ratePerM3: ratePerM3Value.toString(),
            ratePerM: ratePerMValue.toString(),
          });
        importedCount++;
      }
    }
  }
  
  console.log(`\n✅ Import complete!`);
  console.log(`   📈 Imported: ${importedCount} supplier rates`);
  console.log(`   ⏭️  Skipped: ${skippedCount} rows`);
  
  // Calculate system rates for all timber sizes
  console.log(`\n🔄 Calculating system rates...`);
  const allTimber = await db.select().from(timberSizes);
  
  for (const timber of allTimber) {
    const rates = await db
      .select()
      .from(supplierRates)
      .where(eq(supplierRates.timberSizeId, timber.id));
    
    if (rates.length > 0) {
      const rateValues = rates.map(r => parseFloat(r.ratePerM));
      const average = rateValues.reduce((a, b) => a + b, 0) / rateValues.length;
      const bufferPercentage = parseFloat(timber.bufferPercentage || '10');
      const systemRate = average * (1 + bufferPercentage / 100);
      
      await db
        .update(timberSizes)
        .set({ systemRate: systemRate.toString() })
        .where(eq(timberSizes.id, timber.id));
    }
  }
  
  console.log(`✅ System rates calculated!`);
}

// Run import
const filePath = process.argv[2] || 'attached_assets/Timber Price Revised Oct25_1760612899826.csv';
importPricingData(filePath)
  .then(() => {
    console.log('\n🎉 Import successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });
