// ========================================================
// Mock midterm: timed practice papers in the format of Midterm 2 (the 2017 practice paper, verbatim, and
// fresh papers assembled from module-2 materials). Data: js/midterm-papers.js, js/selftest-data.js, js/data.js.
// Placeholder until the section is built; the app calls init(), show() and openPaper(id, { fromRoute }).
// ========================================================

class MockMidterm {
  get container() { return document.getElementById('mock-container'); }
  init() {}
  show() {
    if (this.container) this.container.innerHTML = '<p class="text-sm text-slate-400">Mock midterm: coming in the next build.</p>';
  }
  openPaper(id, { fromRoute = false } = {}) {
    window.app?.switchTab('mock', { fromRoute });
  }
}

if (typeof module === 'undefined') window.mockMidterm = new MockMidterm();
