import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const excelPath = path.join(process.cwd(), 'attached_assets/Mitek Codes (Final001).1_1763740242191.xlsx');

console.log('Reading Excel file:', excelPath);

const fileBuffer = fs.readFileSync(excelPath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

console.log('\n=== WORKBOOK ANALYSIS ===');
console.log('Sheet Names:', workbook.SheetNames);

workbook.SheetNames.forEach((sheetName) => {
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  console.log(`\n\n=== SHEET: ${sheetName} ===`);
  console.log(`Total Rows: ${data.length}`);
  
  if (data.length > 0) {
    console.log('\nColumn Headers (Row 1):');
    console.log(data[0]);
    
    console.log('\nFirst 5 data rows:');
    for (let i = 1; i < Math.min(6, data.length); i++) {
      console.log(`Row ${i}:`, data[i]);
    }
    
    console.log('\nFull data as JSON:');
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    console.log(JSON.stringify(jsonData, null, 2));
  }
});

console.log('\n=== ANALYSIS COMPLETE ===');
