// ========================================================
// Get ready: the teacher's "I am ready for Midterm 2 if" checklist (R.H.), each item with verbatim lecture
// quotes, lecture examples and practice from the real module-2 materials. Data: js/midterm-prep-data.js.
// Placeholder until the section is built; the app calls init(), show() and openItem(id, { fromRoute }).
// ========================================================

class GetReady {
  get container() { return document.getElementById('getready-container'); }
  init() {}
  show() {
    if (this.container) this.container.innerHTML = '<p class="text-sm text-slate-400">Midterm 2 checklist: coming in the next build.</p>';
  }
  openItem(id, { fromRoute = false } = {}) {
    window.app?.switchTab('getready', { fromRoute });
  }
}

if (typeof module === 'undefined') window.getReady = new GetReady();
