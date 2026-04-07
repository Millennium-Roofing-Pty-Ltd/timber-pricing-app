import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
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
} from '@shared/schema';
import { sql } from 'drizzle-orm';

const excelPath = path.join(process.cwd(), 'attached_assets/Mitek Codes (Final001).1_1763740242191.xlsx');

console.log('Reading Excel file:', excelPath);

const fileBuffer = fs.readFileSync(excelPath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

async function importSettings() {
  console.log('\n=== IMPORTING SETTINGS FROM EXCEL ===\n');
  console.log('Note: Upserting data (update existing, insert new)\n');

  // Import Relations
  console.log('Importing Relations...');
  const relationsSheet = workbook.Sheets['Relation'];
  const relationsData = XLSX.utils.sheet_to_json<any>(relationsSheet, { defval: '' });
  for (const row of relationsData) {
    if (row.Name) {
      await db.insert(stockRelations).values({
        name: row.Name.trim(),
        description: row.Description ? row.Description.trim() : null,
      }).onConflictDoUpdate({
        target: stockRelations.name,
        set: {
          description: row.Description ? row.Description.trim() : null,
        },
      });
      console.log(`  - Upserted: ${row.Name}`);
    }
  }
  console.log(`✓ Imported ${relationsData.length} relations\n`);

  // Import Behaviours
  console.log('Importing Behaviours...');
  const behavioursSheet = workbook.Sheets['Behaviour'];
  const behavioursData = XLSX.utils.sheet_to_json<any>(behavioursSheet, { defval: '' });
  for (const row of behavioursData) {
    if (row.Name) {
      await db.insert(stockBehaviours).values({
        name: row.Name.trim(),
        description: row.Description ? row.Description.trim() : null,
        notes: row.Notes ? row.Notes.trim() : null,
      }).onConflictDoUpdate({
        target: stockBehaviours.name,
        set: {
          description: row.Description ? row.Description.trim() : null,
          notes: row.Notes ? row.Notes.trim() : null,
        },
      });
      console.log(`  - Upserted: ${row.Name}`);
    }
  }
  console.log(`✓ Imported ${behavioursData.length} behaviours\n`);

  // Import Types
  console.log('Importing Types...');
  const typesSheet = workbook.Sheets['Type'];
  const typesData = XLSX.utils.sheet_to_json<any>(typesSheet, { defval: '' });
  for (const row of typesData) {
    if (row.Name) {
      await db.insert(stockTypes).values({
        name: row.Name.trim(),
        description: row['Description '] ? row['Description '].trim() : null,
        notes: row.Notes ? row.Notes.trim() : null,
      }).onConflictDoUpdate({
        target: stockTypes.name,
        set: {
          description: row['Description '] ? row['Description '].trim() : null,
          notes: row.Notes ? row.Notes.trim() : null,
        },
      });
      console.log(`  - Upserted: ${row.Name}`);
    }
  }
  console.log(`✓ Imported ${typesData.length} types\n`);

  // Import UOMs
  console.log('Importing UOMs...');
  const uomsSheet = workbook.Sheets["UOM's"];
  const uomsData = XLSX.utils.sheet_to_json<any>(uomsSheet, { defval: '' });
  for (const row of uomsData) {
    if (row.Name) {
      await db.insert(stockUoms).values({
        name: row.Name.trim(),
        description: row.Description ? row.Description.trim() : null,
        factor: row.Factor ? String(row.Factor) : null,
        notes: row.Notes ? row.Notes.trim() : null,
      }).onConflictDoUpdate({
        target: stockUoms.name,
        set: {
          description: row.Description ? row.Description.trim() : null,
          factor: row.Factor ? String(row.Factor) : null,
          notes: row.Notes ? row.Notes.trim() : null,
        },
      });
      console.log(`  - Upserted: ${row.Name} (factor: ${row.Factor})`);
    }
  }
  console.log(`✓ Imported ${uomsData.length} UOMs\n`);

  // Import Properties
  console.log('Importing Properties...');
  const propertiesSheet = workbook.Sheets['Properties'];
  const propertiesData = XLSX.utils.sheet_to_json<any>(propertiesSheet, { defval: '' });
  for (const row of propertiesData) {
    if (row.Name) {
      await db.insert(stockPropertyDefinitions).values({
        name: row.Name.trim(),
        description: row.Description ? row.Description.trim() : null,
        uom: row.UOM ? row.UOM.trim() : null,
      }).onConflictDoUpdate({
        target: stockPropertyDefinitions.name,
        set: {
          description: row.Description ? row.Description.trim() : null,
          uom: row.UOM ? row.UOM.trim() : null,
        },
      });
      console.log(`  - Upserted: ${row.Name}${row.UOM ? ` (${row.UOM})` : ''}`);
    }
  }
  console.log(`✓ Imported ${propertiesData.length} properties\n`);

  // Import Colours
  console.log('Importing Colours...');
  const coloursSheet = workbook.Sheets['Colour'];
  const coloursData = XLSX.utils.sheet_to_json<any>(coloursSheet, { defval: '' });
  for (const row of coloursData) {
    if (row.Name) {
      await db.insert(stockColours).values({
        name: row.Name.trim(),
        description: row.Description ? row.Description.trim() : null,
        origin: row.Origin ? row.Origin.trim() : null,
      }).onConflictDoUpdate({
        target: stockColours.name,
        set: {
          description: row.Description ? row.Description.trim() : null,
          origin: row.Origin ? row.Origin.trim() : null,
        },
      });
      console.log(`  - Upserted: ${row.Name}`);
    }
  }
  console.log(`✓ Imported ${coloursData.length} colours\n`);

  // Import Variants
  console.log('Importing Variants...');
  const variantsSheet = workbook.Sheets['Variant'];
  const variantsData = XLSX.utils.sheet_to_json<any>(variantsSheet, { defval: '' });
  for (const row of variantsData) {
    if (row.Name) {
      await db.insert(stockVariants).values({
        name: row.Name.trim(),
        description: row.Description ? row.Description.trim() : null,
      }).onConflictDoUpdate({
        target: stockVariants.name,
        set: {
          description: row.Description ? row.Description.trim() : null,
        },
      });
      console.log(`  - Upserted: ${row.Name}`);
    }
  }
  console.log(`✓ Imported ${variantsData.length} variants\n`);

  // Import Markup Groups
  console.log('Importing Markup Groups...');
  const markupSheet = workbook.Sheets['Markup Group'];
  const markupData = XLSX.utils.sheet_to_json<any>(markupSheet, { defval: '' });
  for (const row of markupData) {
    if (row.Name) {
      await db.insert(stockMarkupGroups).values({
        name: row.Name.trim(),
        description: row.Description ? row.Description.trim() : null,
      }).onConflictDoUpdate({
        target: stockMarkupGroups.name,
        set: {
          description: row.Description ? row.Description.trim() : null,
        },
      });
      console.log(`  - Upserted: ${row.Name}`);
    }
  }
  console.log(`✓ Imported ${markupData.length} markup groups\n`);

  // Import Discount Groups
  console.log('Importing Discount Groups...');
  const discountSheet = workbook.Sheets['Discount Group'];
  const discountData = XLSX.utils.sheet_to_json<any>(discountSheet, { defval: '' });
  for (const row of discountData) {
    if (row.Name) {
      await db.insert(stockDiscountGroups).values({
        name: row.Name.trim(),
        description: row.Description ? row.Description.trim() : null,
      }).onConflictDoUpdate({
        target: stockDiscountGroups.name,
        set: {
          description: row.Description ? row.Description.trim() : null,
        },
      });
      console.log(`  - Upserted: ${row.Name}`);
    }
  }
  console.log(`✓ Imported ${discountData.length} discount groups\n`);

  console.log('\n=== IMPORT COMPLETE ===');
  console.log('All settings data has been imported from the Excel file.');
}

importSettings()
  .then(() => {
    console.log('\n✓ SUCCESS');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ ERROR:', error);
    process.exit(1);
  });
