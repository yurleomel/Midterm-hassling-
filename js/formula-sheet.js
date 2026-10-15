// ========================================================
// Exam formula sheet (js/formula-sheet-data.js): the labelled sheet to study, the unlabelled sheet exactly as
// handed out at the exam, and a drill for recognising every row without its label.
// Placeholder until the component is built. Public API: window.formulaSheet.open({ mode: 'study' | 'exam' | 'drill' }).
// ========================================================

class FormulaSheet {
  open() {}
  close() {}
}

if (typeof module === 'undefined') window.formulaSheet = new FormulaSheet();
