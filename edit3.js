const fs = require('fs');
const path = 'e:\\BitNBuild\\frontend\\src\\shared\\experiment\\import.ts';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\r\n/g, '\n');

const target2 = `  return questions.map((q, i) => {
    const el = createElement('MULTIPLE_CHOICE') as MultipleChoiceElement;
    el.required = q.required;
    el.config = {
      ...el.config,
      prompt: q.prompt,
      selection: q.selection,
      display: q.selection === 'single' ? q.display : 'buttons',
      shuffleOptions: q.shuffle,
      options: q.options.map((label) => ({ id: createId(), label })),
    };
    el.scoring = { enabled: q.correct.length > 0, correctOptionIds: q.correct.map((ci) => el.config.options[ci].id) };
    const trial = createTrial(\`\${opts.namePrefix} \${(opts.startNumber ?? 1) + i}\`);
    return { ...trial, advanceMode: opts.advanceMode, condition: opts.condition, elements: [el] };
  });`;

const replacement2 = `  return questions.map((q, i) => {
    let el: any;
    
    if (q.element_type === 'SLIDER_RATING') {
      el = createElement('SLIDER_RATING');
      el.required = q.required;
      el.config = {
        ...el.config,
        prompt: q.prompt,
        min: q.min ?? 0,
        max: q.max ?? 100,
        step: q.step ?? 1,
        defaultValue: q.min ?? 0,
        display: 'slider'
      };
    } else if (q.element_type === 'TEXT_INPUT') {
      el = createElement('TEXT_INPUT');
      el.required = q.required;
      el.config = {
        ...el.config,
        prompt: q.prompt,
        validation: (q.min !== undefined || q.max !== undefined) 
          ? { kind: 'number', min: q.min ?? null, max: q.max ?? null, integer: false }
          : { kind: 'none' }
      };
    } else {
      el = createElement('MULTIPLE_CHOICE');
      el.required = q.required;
      el.config = {
        ...el.config,
        prompt: q.prompt,
        selection: q.selection ?? 'single',
        display: q.selection === 'single' ? (q.display ?? 'buttons') : 'buttons',
        shuffleOptions: q.shuffle ?? false,
        options: (q.options ?? []).map((label) => ({ id: createId(), label: String(label) })),
      };
      el.scoring = { enabled: (q.correct ?? []).length > 0, correctOptionIds: (q.correct ?? []).map((ci: number) => el.config.options[ci].id) };
    }
    
    const trial = createTrial(\`\${opts.namePrefix} \${(opts.startNumber ?? 1) + i}\`);
    return { ...trial, advanceMode: opts.advanceMode, condition: opts.condition, elements: [el] };
  });`;

content = content.replace(target2, replacement2);
content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(path, content);
console.log('done');
