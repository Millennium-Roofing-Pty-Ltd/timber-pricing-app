/**
 * Sort timber sizes following the exact Excel spreadsheet row sequence (rows 4-40)
 * from "Timber Price Revised Oct25_1760634214231.csv"
 */

export type TimberSize = {
  thickness: number;
  width: number;
  grade: string;
  classification: string;
  [key: string]: any;
};

/**
 * Exact sequence mapping from Excel spreadsheet rows 4-40
 * Key format: "thickness-width-grade-classification"
 * Value: sequence index (0-based, where row 4 = index 0)
 */
const EXCEL_SEQUENCE_MAP: Record<string, number> = {
  // Row 4-7: 38mm BBB
  '38-38-BBB-Mediums': 0,
  '38-38-BBB-Longs': 1,
  '38-50-BBB-Mediums': 2,
  '38-50-BBB-Longs': 3,
  
  // Row 8-10: 38×76 S5
  '38-76-S5-Shorts': 4,
  '38-76-S5-Mediums': 5,
  '38-76-S5-Longs': 6,
  
  // Row 11-13: 38×102 S5
  '38-102-S5-Shorts': 7,
  '38-102-S5-Mediums': 8,
  '38-102-S5-Longs': 9,
  
  // Row 14-16: 38×114 S5
  '38-114-S5-Shorts': 10,
  '38-114-S5-Mediums': 11,
  '38-114-S5-Longs': 12,
  
  // Row 17-18: 38×114 S7
  '38-114-S7-Mediums': 13,
  '38-114-S7-Longs': 14,
  
  // Row 19-20: 38×152 S5
  '38-152-S5-Mediums': 15,
  '38-152-S5-Longs': 16,
  
  // Row 21-22: 38×152 S7
  '38-152-S7-Mediums': 17,
  '38-152-S7-Longs': 18,
  
  // Row 23-24: 38×228 S5
  '38-228-S5-Mediums': 19,
  '38-228-S5-Longs': 20,
  
  // Row 25-26: 38×228 S7
  '38-228-S7-Mediums': 21,
  '38-228-S7-Longs': 22,
  
  // Row 27-28: 50×76 S5
  '50-76-S5-Mediums': 23,
  '50-76-S5-Longs': 24,
  
  // Row 29-30: 50×152 S5
  '50-152-S5-Mediums': 25,
  '50-152-S5-Longs': 26,
  
  // Row 31-32: 50×228 S5
  '50-228-S5-Mediums': 27,
  '50-228-S5-Longs': 28,
  
  // Row 33-34: 76×228 S5
  '76-228-S5-Mediums': 29,
  '76-228-S5-Longs': 30,
  
  // Row 35-36: 38×38 BG
  '38-38-BG-Mediums': 31,
  '38-38-BG-Longs': 32,
  
  // Row 37-38: 38×50 BG
  '38-50-BG-Mediums': 33,
  '38-50-BG-Longs': 34,
  
  // Row 39-40: 50×50 BG
  '50-50-BG-Mediums': 35,
  '50-50-BG-Longs': 36,
};

/**
 * Get the Excel sequence index for a timber size
 */
function getExcelSequenceIndex(timberSize: TimberSize): number {
  const key = `${timberSize.thickness}-${timberSize.width}-${timberSize.grade}-${timberSize.classification}`;
  const index = EXCEL_SEQUENCE_MAP[key];
  
  // Log warning if unmapped (should not happen with complete data)
  if (index === undefined) {
    console.warn(`[Excel Sequence] Unmapped timber size: ${key} - will sort to end`);
  }
  
  // Return the mapped index, or a very high number for unmapped items (they'll sort to the end)
  return index !== undefined ? index : 9999;
}

/**
 * Sort timber sizes by exact Excel spreadsheet row sequence (rows 4-40)
 */
export function sortTimberSizesByExcelSequence<T extends TimberSize>(timberSizes: T[]): T[] {
  return [...timberSizes].sort((a, b) => {
    const indexA = getExcelSequenceIndex(a);
    const indexB = getExcelSequenceIndex(b);
    return indexA - indexB;
  });
}
