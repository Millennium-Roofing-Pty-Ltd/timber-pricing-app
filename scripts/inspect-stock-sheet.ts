import XLSX from 'xlsx';
import * as fs from 'fs';

const files = fs.readdirSync('attached_assets');
const excelFile = files.find(f => f.includes('Mitek') && f.endsWith('.xlsx'));
const filePath = `attached_assets/${excelFile}`;

const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
const sheetName = workbook.SheetNames.find(name => name.includes('Stock'));

console.log(`Sheet: ${sheetName}\n`);

const worksheet = workbook.Sheets[sheetName!];

// Get the raw data without treating first row as header
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

console.log('First 10 rows:');
for (let i = 0; i < Math.min(10, rawData.length); i++) {
  const row = rawData[i] as any[];
  console.log(`Row ${i + 1}:`, row.slice(0, 8));
}

// Try to find which row has the headers
console.log('\n\nLooking for header row...');
for (let i = 0; i < Math.min(10, rawData.length); i++) {
  const row = rawData[i] as any[];
  if (row.some((cell: any) => cell && cell.toString().includes('Product'))) {
    console.log(`\nFound header row at index ${i} (Row ${i + 1}):`);
    console.log(row.filter((c: any) => c));
    break;
  }
}
