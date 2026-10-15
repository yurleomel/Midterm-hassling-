// ========================================================
// The formula sheet handed out at Midterm 2, transcribed verbatim from a photo of the printed sheet.
// At the exam it comes WITHOUT the distribution labels, so the app can hide them and drill
// recognising every row (js/formula-sheet.js). Text is HTML with TeX in \( \).
// ========================================================

const FORMULA_SHEET = {
  note: 'At the exam this sheet is handed out without the labels: you have to recognise every row yourself.',
  tables: [
    {
      id: 'discrete',
      title: 'Discrete probability distributions',
      columns: ['Distribution', 'P.m.f. \\(p_X(x)\\)', 'M.g.f. \\(M(t)\\)', 'Mean', 'Variance'],
      rows: [
        {
          id: 'binomial', name: 'Binomial',
          label: 'Binomial \\(\\mathscr B(n,p)\\)', params: '\\(n\\in\\mathbb N,\\ 0<p<1\\)',
          cells: [
            { main: '\\(C_n^x p^x(1-p)^{n-x}\\)', sub: '\\(x=0,1,\\dots,n\\)' },
            { main: '\\((pe^t+1-p)^n\\)', sub: '\\(t\\in\\mathbb R\\)' },
            { main: '\\(np\\)' },
            { main: '\\(np(1-p)\\)' }
          ]
        },
        {
          id: 'poisson', name: 'Poisson',
          label: 'Poisson \\(\\mathscr P(\\lambda)\\)', params: '\\(\\lambda>0\\)',
          cells: [
            { main: '\\(e^{-\\lambda}\\lambda^x/x!\\)', sub: '\\(x\\in\\mathbb Z_+\\)' },
            { main: '\\(\\exp\\{\\lambda(e^t-1)\\}\\)', sub: '\\(t\\in\\mathbb R\\)' },
            { main: '\\(\\lambda\\)' },
            { main: '\\(\\lambda\\)' }
          ]
        },
        {
          id: 'geometric', name: 'Geometric',
          label: 'Geometric \\(\\mathscr G(p)\\)', params: '\\(0<p<1\\)',
          cells: [
            { main: '\\(p(1-p)^{x-1}\\)', sub: '\\(x\\in\\mathbb N\\)' },
            { main: '\\(\\dfrac{pe^t}{1-(1-p)e^t}\\)', sub: '\\(t<-\\log(1-p)\\)' },
            { main: '\\(\\dfrac{1}{p}\\)' },
            { main: '\\(\\dfrac{1-p}{p^2}\\)' }
          ]
        }
      ]
    },
    {
      id: 'continuous',
      title: 'Continuous probability distributions',
      columns: ['Distribution', 'P.d.f. \\(f_X(x)\\)', 'M.g.f. \\(M(t)\\)', 'Mean', 'Variance'],
      rows: [
        {
          id: 'uniform', name: 'Uniform',
          label: 'Uniform \\(\\mathscr U(a,b)\\)', params: '',
          cells: [
            { main: '\\(f_X(x)=\\begin{cases}\\frac{1}{b-a} & a<x<b\\\\ 0 & \\text{otherwise}\\end{cases}\\)' },
            { main: '\\(\\dfrac{e^{tb}-e^{ta}}{t(b-a)}\\)' },
            { main: '\\(\\dfrac{a+b}{2}\\)' },
            { main: '\\(\\dfrac{(b-a)^2}{12}\\)' }
          ]
        },
        {
          id: 'exponential', name: 'Exponential',
          label: 'Exponential \\(\\mathscr E(\\lambda)\\)', params: '\\(\\lambda>0\\)',
          cells: [
            { main: '\\(f_X(x)=\\begin{cases}\\lambda e^{-\\lambda x} & x\\ge 0\\\\ 0 & \\text{otherwise}\\end{cases}\\)' },
            { main: '\\(\\dfrac{\\lambda}{\\lambda-t}\\)' },
            { main: '\\(\\dfrac{1}{\\lambda}\\)' },
            { main: '\\(\\dfrac{1}{\\lambda^2}\\)' }
          ]
        },
        {
          id: 'normal', name: 'Normal',
          label: 'Normal \\(\\mathscr N(\\mu,\\sigma^2)\\)', params: '\\(\\mu\\in\\mathbb R,\\sigma^2>0\\)',
          cells: [
            { main: '\\(f_X(x)=\\dfrac{1}{\\sqrt{2\\pi}\\sigma}e^{-(x-\\mu)^2/2\\sigma^2}\\)', sub: '\\(-\\infty<x<+\\infty\\)' },
            { main: '\\(\\exp\\left\\{\\mu t+\\frac{\\sigma^2t^2}{2}\\right\\}\\)' },
            { main: '\\(\\mu\\)' },
            { main: '\\(\\sigma^2\\)' }
          ]
        },
        {
          id: 'gamma', name: 'Gamma',
          label: 'Gamma \\(\\Gamma(s,\\lambda)\\)', params: '\\((s,\\lambda),\\ \\lambda>0\\)',
          cells: [
            { main: '\\(f_X(x)=\\begin{cases}\\frac{\\lambda e^{-\\lambda x}(\\lambda x)^{s-1}}{\\Gamma(s)} & x\\ge 0\\\\ 0 & \\text{otherwise}\\end{cases}\\)' },
            { main: '\\(\\left(\\dfrac{\\lambda}{\\lambda-t}\\right)^s\\)' },
            { main: '\\(\\dfrac{s}{\\lambda}\\)' },
            { main: '\\(\\dfrac{s}{\\lambda^2}\\)' }
          ]
        }
      ]
    }
  ],
  footer: ['\\(\\Gamma(s):=\\displaystyle\\int_0^\\infty t^{s-1}e^{-t}\\,dt;\\)', 'observe that \\(\\Gamma(n+1)=n!\\)']
};

if (typeof module !== 'undefined' && module.exports) module.exports = { FORMULA_SHEET };
else window.FORMULA_SHEET = FORMULA_SHEET;
