import XLSX from 'xlsx';
import path from 'path';

const filePath = path.join(process.cwd(), 'attached_assets/pricing-report_1764003744194.xlsx');

try {
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;

  console.log('Sheet names:', sheetNames);
  console.log('\n');

  sheetNames.forEach(sheetName => {
    console.log(`\n=== Sheet: ${sheetName} ===`);
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    console.log('Number of rows:', jsonData.length);
    
    if (jsonData.length > 0) {
      console.log('\nColumns:', Object.keys(jsonData[0]));
      console.log('\nFirst 15 rows:');
      console.log(JSON.stringify(jsonData.slice(0, 15), null, 2));
    }
  });
} catch (error) {
  console.error('Error reading file:', error);
}
