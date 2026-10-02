const fs = require('fs');
const path = 'e:\\BitNBuild\\frontend\\src\\shared\\experiment\\import.ts';
let content = fs.readFileSync(path, 'utf8');

// Normalize everything to \n first
content = content.replace(/\r\n/g, '\n');

const target1 = `    if (!Array.isArray(optionsRaw)) {
      errors.push({ at, message: 'missing "options" array' });
      return;
    }`;

const replacement1 = `    const typeRaw = q.type ?? q.selection;
    const typeStr = String(typeRaw).toLowerCase();
    
    if (typeStr === 'number' || typeStr === 'slider') {
      const min = typeof q.min === 'number' ? q.min : null;
      const max = typeof q.max === 'number' ? q.max : null;
      const step = typeof q.step === 'number' ? q.step : null;
      const required = q.required === undefined ? true : Boolean(q.required);
      
      if (typeStr === 'slider' || typeof q.step === 'number' || (min !== null && max !== null)) {
        questions.push({
          element_type: 'SLIDER_RATING',
          prompt: prompt.trim(),
          required,
          min: min ?? 0,
          max: max ?? 100,
          step: step ?? 1,
          options: [],
          correct: [],
          selection: 'single',
          display: 'slider' as any,
          shuffle: false
        });
      } else {
        questions.push({
          element_type: 'TEXT_INPUT',
          prompt: prompt.trim(),
          required,
          min: min ?? undefined,
          max: max ?? undefined,
          options: [],
          correct: [],
          selection: 'single',
          display: 'buttons' as any,
          shuffle: false
        });
      }
      return;
    } else if (typeStr === 'text') {
      questions.push({
        element_type: 'TEXT_INPUT',
        prompt: prompt.trim(),
        required: q.required === undefined ? true : Boolean(q.required),
        options: [],
        correct: [],
        selection: 'single',
        display: 'buttons' as any,
        shuffle: false
      });
      return;
    }

    if (!Array.isArray(optionsRaw)) {
      errors.push({ at, message: 'missing "options" array' });
      return;
    }`;

content = content.replace(target1, replacement1);

// Convert back to \r\n for Windows
content = content.replace(/\n/g, '\r\n');

fs.writeFileSync(path, content);
console.log('done');
