const fs = require('fs');
const content = fs.readFileSync('stock-detail.tsx', 'utf8');

// Find all Select components and add disabled if not present
let updated = content.replace(
  /(<Select\s+value=\{field\.value \?\? ''\}\s+onValueChange=\{field\.onChange\})(>)/g,
  (match, before, after) => {
    if (match.includes('disabled')) return match;
    return before + '\n                      disabled={!isEditMode}' + after;
  }
);

fs.writeFileSync('stock-detail.tsx', updated);
console.log('Updated Select components');
