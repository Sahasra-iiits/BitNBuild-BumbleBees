const fs = require('fs');
const path = 'e:\\BitNBuild\\frontend\\src\\shared\\experiment\\import.ts';
let content = fs.readFileSync(path, 'utf8');

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
          display: 'buttons' as any,
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

content = content.replace(target1.replace(/\r\n/g, '\n'), replacement1);
content = content.replace(target1, replacement1);

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

content = content.replace(target2.replace(/\r\n/g, '\n'), replacement2);
content = content.replace(target2, replacement2);

fs.writeFileSync(path, content);
console.log('done');
