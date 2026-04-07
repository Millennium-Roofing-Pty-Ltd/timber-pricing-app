import XLSX from 'xlsx';
import * as fs from 'fs';

// Find the Excel file
const files = fs.readdirSync('attached_assets');
const excelFile = files.find(f => f.includes('Mitek') && f.endsWith('.xlsx'));

if (!excelFile) {
  console.error('Excel file not found');
  process.exit(1);
}

const filePath = `attached_assets/${excelFile}`;
console.log(`📊 Reading file: ${filePath}\n`);

// Read the workbook
const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });

console.log('📋 Sheet names:');
workbook.SheetNames.forEach((name, i) => {
  console.log(`  ${i + 1}. ${name}`);
});
console.log();

// Read each sheet and show structure
workbook.SheetNames.forEach((sheetName) => {
  console.log(`\n=== ${sheetName} ===`);
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  if (data.length > 0) {
    console.log(`Rows: ${data.length}`);
    console.log(`Headers:`, data[0]);
    if (data.length > 1) {
      console.log(`Sample data:`, data[1]);
    }
  } else {
    console.log('(Empty sheet)');
  }
});
