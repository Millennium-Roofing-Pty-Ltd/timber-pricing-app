import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { db } from './db';
import { timberSizes, suppliers, supplierRates, systemPricingHistory } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import iconv from 'iconv-lite';

interface SupplierDateMapping {
  supplier: string;
  date: string;
  year: number;
  month: number;
  ratePerM3Column: number;
  ratePerMColumn: number;
}

interface SystemPriceDateMapping {
  date: string;
  year: number;
  month: number;
  ratePerMColumn: number;
}

async function importComprehensivePricing(filePath: string) {
  console.log('🔄 Starting comprehensive import process...');
  
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
  const systemPriceMappings: SystemPriceDateMapping[] = [];
  
  // Process columns starting from column 6 (after: Thickness, Width, GRADE, CLASSIFICATION, M³, LENGTH)
  for (let i = 6; i < supplierRow.length; i++) {
    const cellValue = supplierRow[i]?.trim();
    const dateValue = dateRow[i]?.trim();
    const columnHeader = columnHeaderRow[i]?.trim();
    
    // Skip empty cells
    if (!cellValue || !columnHeader) continue;
    
    // Check for Supplier columns
    if (cellValue === 'Supplier') {
      const supplierName = supplierRow[i + 1]?.trim();
      const dateStr = dateRow[i + 1]?.trim();
      
      if (supplierName && dateStr && dateStr !== 'Date') {
        // Parse date (format: "01 01 2018" = DD MM YYYY)
        const dateParts = dateStr.split(' ');
        if (dateParts.length === 3) {
          const month = parseInt(dateParts[1]);
          const year = parseInt(dateParts[2]);
          
          supplierDateMappings.push({
            supplier: supplierName,
            date: dateStr,
            year,
            month,
            ratePerM3Column: i,
            ratePerMColumn: i + 1,
          });
        }
      }
      i++; // Skip next column as we've already processed it
    }
    // Check for System Price columns
    else if (cellValue === 'System Price') {
      const dateStr = dateRow[i]?.trim();
      
      if (dateStr && columnHeader === 'R/M') {
        // Parse date (format: "01 01 2019" = DD MM YYYY)
        const dateParts = dateStr.split(' ');
        if (dateParts.length === 3) {
          const month = parseInt(dateParts[1]);
          const year = parseInt(dateParts[2]);
          
          systemPriceMappings.push({
            date: dateStr,
            year,
            month,
            ratePerMColumn: i,
          });
        }
      }
    }
  }
  
  console.log(`📊 Found ${supplierDateMappings.length} supplier-date combinations`);
  console.log(`📈 Found ${systemPriceMappings.length} system price periods`);
  
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
  let supplierRatesImported = 0;
  let systemRatesImported = 0;
  let skippedCount = 0;
  
  for (let rowIndex = 3; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    
    // Parse timber specification with CORRECT column indices
    const thicknessStr = row[0]?.replace(',', '.'); // Column 0 = Thickness
    const widthStr = row[1]?.replace(',', '.'); // Column 1 = Width
    const grade = row[2]?.trim(); // Column 2 = GRADE
    const classification = row[3]?.trim(); // Column 3 = CLASSIFICATION
    const m3FactorStr = row[4]?.replace(',', '.'); // Column 4 = M³
    const lengthRange = row[5]?.trim(); // Column 5 = LENGTH
    
    if (!thicknessStr || !widthStr || !grade || !classification || !lengthRange) {
      console.log(`⚠️  Row ${rowIndex + 1}: Missing timber specification, skipping`);
      skippedCount++;
      continue;
    }
    
    const thickness = parseFloat(thicknessStr);
    const width = parseFloat(widthStr);
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
    
    // Find or create timber size (check thickness, width, classification AND grade)
    const existingTimber = await db
      .select()
      .from(timberSizes)
      .where(
        and(
          eq(timberSizes.thickness, Math.round(thickness)),
          eq(timberSizes.width, Math.round(width)),
          eq(timberSizes.classification, classification),
          eq(timberSizes.grade, grade)
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
      console.log(`✨ Created timber: ${thickness}×${width}mm ${grade} ${classification} (${lengthMin}-${lengthMax}m)`);
    }
    
    // Import supplier rates for each supplier-date
    for (const mapping of supplierDateMappings) {
      const ratePerM3Str = row[mapping.ratePerM3Column]?.trim();
      
      if (!ratePerM3Str || ratePerM3Str === '' || ratePerM3Str === 'R0,00' || ratePerM3Str === 'R -') continue;
      
      // Parse rate per m³ (format: "R3 865,00" or "R3865,00")
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
            ratePerM3: ratePerM3Value.toString(),
            ratePerM: ratePerMValue.toString(),
          });
        supplierRatesImported++;
      }
    }
    
    // Import system rates for each period
    for (const mapping of systemPriceMappings) {
      const systemRateStr = row[mapping.ratePerMColumn]?.trim();
      
      if (!systemRateStr || systemRateStr === '' || systemRateStr === 'R0,00') continue;
      
      // Parse system rate (format: "6,22" or "6.22")
      const rateValue = parseFloat(systemRateStr.replace(',', '.'));
      if (isNaN(rateValue) || rateValue === 0) continue;
      
      // Check if system rate already exists for this period
      const existingSystemRate = await db
        .select()
        .from(systemPricingHistory)
        .where(
          and(
            eq(systemPricingHistory.timberSizeId, timberSizeId),
            eq(systemPricingHistory.year, mapping.year),
            eq(systemPricingHistory.month, mapping.month)
          )
        )
        .limit(1);
      
      if (existingSystemRate.length === 0) {
        await db
          .insert(systemPricingHistory)
          .values({
            timberSizeId,
            year: mapping.year,
            month: mapping.month,
            systemRate: rateValue.toString(),
          });
        systemRatesImported++;
      }
    }
  }
  
  console.log(`\n✅ Import complete!`);
  console.log(`   📈 Imported: ${supplierRatesImported} supplier rates`);
  console.log(`   💰 Imported: ${systemRatesImported} system rates`);
  console.log(`   ⏭️  Skipped: ${skippedCount} rows`);
  
  // Set October 2025 rates as current system rates
  console.log(`\n🔄 Setting October 2025 as current system rates...`);
  const october2025Rates = await db
    .select()
    .from(systemPricingHistory)
    .where(
      and(
        eq(systemPricingHistory.year, 2025),
        eq(systemPricingHistory.month, 10)
      )
    );
  
  let updatedCount = 0;
  for (const historyRate of october2025Rates) {
    await db
      .update(timberSizes)
      .set({ 
        systemRate: historyRate.systemRate
      })
      .where(eq(timberSizes.id, historyRate.timberSizeId));
    updatedCount++;
  }
  
  console.log(`   ✅ Updated ${updatedCount} timber sizes with October 2025 system rates`);
  
  console.log(`\n✅ Comprehensive import successful!`);
}

// Run import
const filePath = process.argv[2] || 'attached_assets/timber-pricing-data.csv';
importComprehensivePricing(filePath)
  .then(() => {
    console.log('\n🎉 Import successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  });
