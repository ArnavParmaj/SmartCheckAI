// Builds gradebook exports (CSV, JSON, printable PDF report) from an exam's submissions.

const finalScore = (ans) =>
  ans.teacherScore !== null && ans.teacherScore !== undefined ? ans.teacherScore : ans.aiScore;

function questionLabels(subs) {
  const labels = [];
  for (const sub of subs) {
    for (const ans of sub.answers || []) {
      const label = ans.questionLabel || ans.questionId;
      if (!labels.includes(label)) labels.push(label);
    }
  }
  return labels;
}

// One row per student; columns depend on the chosen include options
export function buildGradebook(subs, options) {
  const labels = questionLabels(subs);
  const header = ['Student', 'Roll No.'];
  for (const label of labels) {
    if (options.scores) header.push(label);
    if (options.overrides) header.push(`${label} AI score`);
    if (options.confidence) header.push(`${label} AI confidence %`);
    if (options.feedback) header.push(`${label} feedback`);
  }
  if (options.scores) header.push('Total', 'Max', 'Percentage');
  if (options.confidence) header.push('Overall AI confidence %');
  header.push('Status');

  const rows = subs.map(sub => {
    const byLabel = Object.fromEntries((sub.answers || []).map(a => [a.questionLabel || a.questionId, a]));
    const row = [sub.studentName, sub.rollNumber];
    for (const label of labels) {
      const ans = byLabel[label];
      if (options.scores) row.push(ans ? finalScore(ans) ?? '' : '');
      if (options.overrides) row.push(ans?.aiScore ?? '');
      if (options.confidence) row.push(ans?.aiConfidence ?? '');
      if (options.feedback) row.push(ans?.aiFeedback || '');
    }
    if (options.scores) row.push(sub.totalScore ?? '', sub.maxScore ?? '', sub.percentage ?? '');
    if (options.confidence) row.push(sub.aiConfidence ?? '');
    row.push(sub.status || '');
    return row;
  });

  return { header, rows };
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCSV({ header, rows }) {
  return [header, ...rows].map(r => r.map(csvCell).join(',')).join('\n');
}

export function toJSON(exam, subs) {
  return JSON.stringify({
    exam: { id: exam.id, title: exam.title, subject: exam.subject, date: exam.dateCreated },
    exportedAt: new Date().toISOString(),
    students: subs.map(sub => ({
      name: sub.studentName,
      rollNumber: sub.rollNumber,
      status: sub.status,
      total: sub.totalScore,
      max: sub.maxScore,
      percentage: sub.percentage,
      answers: (sub.answers || []).map(a => ({
        question: a.questionLabel,
        score: finalScore(a),
        maxMarks: a.maxMarks,
        aiScore: a.aiScore,
        aiConfidence: a.aiConfidence,
        teacherOverride: a.isOverridden ? a.teacherScore : null,
        feedback: a.aiFeedback || '',
      })),
    })),
  }, null, 2);
}

export function downloadFile(content, fileName, mimeType) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const escapeHtml = (text) =>
  String(text ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Opens a print-ready report; the browser's print dialog saves it as PDF.
// Returns false if the popup was blocked.
export function openPrintReport(exam, gradebook) {
  const win = window.open('', '_blank');
  if (!win) return false;
  const head = gradebook.header.map(h => `<th>${escapeHtml(h)}</th>`).join('');
  const body = gradebook.rows
    .map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>${escapeHtml(exam.title)} - Results</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 0 0 16px; color: #555; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f2f2f2; }
</style></head><body>
<h1>${escapeHtml(exam.title)}</h1>
<p>${escapeHtml([exam.subject, exam.semester].filter(Boolean).join(' · '))} · ${gradebook.rows.length} student(s) · exported ${new Date().toLocaleString()}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body></html>`);
  win.document.close();
  win.focus();
  win.print();
  return true;
}

const STATUS_TEXT = { met: 'Met', partial: 'Partly met', missed: 'Missed' };

function studentReportHtml(exam, sub) {
  const rows = (sub.answers || []).map(a => {
    const score = finalScore(a);
    const criteria = (a.aiCriteria || []).map(c => `
      <tr><td>${escapeHtml(c.criterion)}</td><td class="num">${escapeHtml(c.marks_awarded)}/${escapeHtml(c.marks)}</td>
      <td>${escapeHtml(STATUS_TEXT[c.status] || c.status)}</td><td>${escapeHtml(c.reason)}</td></tr>`).join('');
    return `
      <section class="q">
        <h3>${escapeHtml(a.questionLabel)} <span class="score">${escapeHtml(score ?? '-')}/${escapeHtml(a.maxMarks)}</span></h3>
        <p class="qtext">${escapeHtml(a.questionText)}</p>
        <p class="label">Answer</p><p class="answer">${escapeHtml(a.ocrText || 'No answer written')}</p>
        ${criteria ? `<table><thead><tr><th>Criterion</th><th>Marks</th><th>Result</th><th>Why</th></tr></thead><tbody>${criteria}</tbody></table>` : ''}
        ${a.isOverridden ? `<p class="note">Mark set by faculty${a.teacherNote ? `: ${escapeHtml(a.teacherNote)}` : ''} (AI suggested ${escapeHtml(a.aiScore)})</p>` : ''}
        ${a.aiFeedback ? `<p class="feedback"><strong>Feedback:</strong> ${escapeHtml(a.aiFeedback)}</p>` : ''}
      </section>`;
  }).join('');
  return `
    <article class="report">
      <h1>${escapeHtml(exam.title)}</h1>
      <p class="meta">${escapeHtml(sub.studentName)} · Roll ${escapeHtml(sub.rollNumber)} · ${escapeHtml([exam.subject, exam.semester].filter(Boolean).join(' · '))}</p>
      <p class="total">Total: <strong>${escapeHtml(sub.totalScore)}/${escapeHtml(sub.maxScore)}</strong> (${escapeHtml(sub.percentage)}%) · ${escapeHtml(sub.status)}</p>
      ${rows}
    </article>`;
}

// Printable report card(s), one page per student; "Save as PDF" in the print dialog.
// Returns false if the popup was blocked.
export function openStudentReports(exam, subs) {
  const win = window.open('', '_blank');
  if (!win) return false;
  const title = subs.length === 1 ? `${exam.title} - ${subs[0].studentName}` : `${exam.title} - student reports`;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #111; font-size: 13px; }
  .report { page-break-after: always; }
  .report:last-child { page-break-after: auto; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #555; margin: 0 0 4px; }
  .total { margin: 0 0 16px; }
  .q { border-top: 1px solid #ddd; padding: 10px 0; page-break-inside: avoid; }
  h3 { font-size: 15px; margin: 0 0 4px; display: flex; justify-content: space-between; }
  .qtext { color: #444; margin: 0 0 6px; }
  .label { font-size: 11px; text-transform: uppercase; color: #777; margin: 6px 0 2px; }
  .answer { white-space: pre-wrap; background: #f6f6f6; padding: 6px 8px; margin: 0 0 8px; }
  table { border-collapse: collapse; width: 100%; margin: 4px 0; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f2f2f2; }
  .num { white-space: nowrap; }
  .note, .feedback { margin: 6px 0 0; }
</style></head><body>${subs.map(s => studentReportHtml(exam, s)).join('')}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
  return true;
}
