const SPREADSHEET_ID = '1KiD113MEk8rHFXY8XG1AoRKodWVYDPK5tSrDyHJ4WdY';
const SHEET_NAME = 'Página1';
const GEMINI_MODEL_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=';

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (!payload.studentName || !Array.isArray(payload.questions)) {
      return json_({ ok: false, error: 'Dados incompletos.' });
    }

    const corrections = [];
    let objectiveScore = 0;
    let objectiveTotal = 0;
    let essayScore = 0;
    let essayTotal = 0;

    payload.questions.forEach(function (q) {
      if (q.type === 'discursive') {
        const result = correctEssay_(q);
        corrections.push({ number: q.number, score: result.score, maxScore: q.maxScore || 10, feedback: result.feedback, status: result.status });
        essayScore += Number(result.score) || 0;
        essayTotal += Number(q.maxScore) || 10;
      } else {
        objectiveTotal += 1;
        const answer = String(q.answer || '').toUpperCase();
        if (q.correct !== null && q.correct !== undefined && answer === String.fromCharCode(65 + Number(q.correct))) objectiveScore += 1;
      }
    });

    const row = [
      new Date(),
      payload.studentName || '',
      payload.studentNumber || '',
      payload.studentGrade || '',
      payload.date || '',
      objectiveScore,
      objectiveTotal,
      essayScore,
      essayTotal,
      objectiveTotal + essayTotal,
      objectiveScore + essayScore
    ];
    payload.questions.forEach(function (q) { row.push(q.answer || ''); });
    row.push(JSON.stringify(corrections));
    row.push(corrections.some(function (c) { return c.status !== 'corrigida'; }) ? 'PENDENTE_CONFIGURACAO' : 'CORRIGIDA');

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    ensureHeader_(sheet, payload.questions.length);
    sheet.appendRow(row);

    return json_({ ok: true, objectiveScore: objectiveScore, objectiveTotal: objectiveTotal, essayScore: essayScore, essayTotal: essayTotal, corrections: corrections });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function correctEssay_(q) {
  const answer = String(q.answer || '').trim();
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) return { score: 0, feedback: 'A chave GEMINI_API_KEY ainda não foi configurada nas propriedades do Apps Script.', status: 'pendente' };
  if (!answer) return { score: 0, feedback: 'Resposta não preenchida.', status: 'corrigida' };

  const prompt = [
    'Você é um professor de Biologia do Ensino Médio corrigindo uma questão discursiva.',
    'Avalie apenas a resposta do aluno em relação ao enunciado e à rubrica. Não invente informações.',
    'Atribua uma nota inteira de 0 a ' + (q.maxScore || 10) + '.',
    'Devolva SOMENTE um JSON válido neste formato: {"score":0,"feedback":"...","criteria":"..."}.',
    'Enunciado: ' + q.prompt,
    'Rubrica: ' + (q.rubric || 'Avalie precisão conceitual, argumentação e uso de evidências.'),
    'Resposta do aluno: ' + answer
  ].join('\n\n');

  const response = UrlFetchApp.fetch(GEMINI_MODEL_ENDPOINT + encodeURIComponent(apiKey), {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } })
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) return { score: 0, feedback: 'Falha na API do Gemini (' + code + ').', status: 'pendente' };

  const body = JSON.parse(response.getContentText());
  const text = body.candidates && body.candidates[0] && body.candidates[0].content && body.candidates[0].content.parts[0].text;
  if (!text) return { score: 0, feedback: 'A API não devolveu uma correção legível.', status: 'pendente' };
  const clean = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const result = JSON.parse(clean);
  const max = Number(q.maxScore) || 10;
  return { score: Math.max(0, Math.min(max, Number(result.score) || 0)), feedback: String(result.feedback || ''), criteria: String(result.criteria || ''), status: 'corrigida' };
}

function ensureHeader_(sheet, questionCount) {
  if (sheet.getLastRow() > 0) return;
  const headers = ['timestamp', 'studentName', 'studentNumber', 'studentGrade', 'date', 'objectiveScore', 'objectiveTotal', 'essayScore', 'essayTotal', 'totalPossible', 'totalScore'];
  for (let i = 1; i <= questionCount; i++) headers.push('q' + i);
  headers.push('aiCorrectionsJson', 'status');
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
