import XLSX from 'xlsx';
import path from 'path';
import { db } from '../server/db';
import { timberSizes } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

interface ExcelRow {
  'Stock Code': string;
  'Timber Size': string;
  'Classification': string;
  'Grade': string;
  'Market Low (R/m)': string | number;
  'Market Avg (R/m)': string | number;
  'Market High (R/m)': string | number;
  'System Rate (R/m³)': string | number;
  '% Diff vs Market High': string;
}

async function linkTimberToStock() {
  const filePath = path.join(process.cwd(), 'attached_assets/pricing-report_1764003744194.xlsx');

  try {
    console.log('Reading Excel file...');
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets['Pricing Report'];
    const data: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Found ${data.length} rows in Excel file`);
    
    let updated = 0;
    let notFound = 0;
    let errors = 0;

    for (const row of data) {
      try {
        const stockCode = row['Stock Code'];
        const timberSizeStr = row['Timber Size'];
        const classification = row['Classification'];
        const grade = row['Grade'];

        // Parse timber size (e.g., "38×50mm" -> thickness: 38, width: 50)
        // Excel format is thickness×width, but database stores width, thickness
        const match = timberSizeStr.match(/^(\d+)×(\d+)mm$/);
        if (!match) {
          console.warn(`Could not parse timber size: ${timberSizeStr}`);
          errors++;
          continue;
        }

        const thickness = parseInt(match[1]);
        const width = parseInt(match[2]);

        // Find matching timber size in database
        const existingTimberSizes = await db
          .select()
          .from(timberSizes)
          .where(
            and(
              eq(timberSizes.width, width),
              eq(timberSizes.thickness, thickness),
              eq(timberSizes.classification, classification),
              eq(timberSizes.grade, grade)
            )
          );

        if (existingTimberSizes.length === 0) {
          console.warn(
            `No timber size found for: ${width}×${thickness}mm, ${classification}, ${grade}`
          );
          notFound++;
          continue;
        }

        if (existingTimberSizes.length > 1) {
          console.warn(
            `Multiple timber sizes found for: ${width}×${thickness}mm, ${classification}, ${grade} (found ${existingTimberSizes.length})`
          );
        }

        // Update the first matching timber size
        const timberSize = existingTimberSizes[0];
        await db
          .update(timberSizes)
          .set({ stockCode })
          .where(eq(timberSizes.id, timberSize.id));

        console.log(
          `✓ Updated ${width}×${thickness}mm (${classification}, ${grade}) with stock code: ${stockCode}`
        );
        updated++;
      } catch (error) {
        console.error(`Error processing row:`, row, error);
        errors++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total rows: ${data.length}`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Not found in database: ${notFound}`);
    console.log(`Errors: ${errors}`);
  } catch (error) {
    console.error('Error reading or processing file:', error);
    process.exit(1);
  }

  process.exit(0);
}

linkTimberToStock();
