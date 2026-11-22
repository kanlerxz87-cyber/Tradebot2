/* Renders the requirement register from data/requirements.json so the page and
 * the machine-readable record can never drift apart. */
(function () {
  const TB = window.TB;
  const $ = (s) => document.querySelector(s);
  let reqs = [], filter = 'all';

  const LABEL = { done: 'Implemented', partial: 'Partial', review: 'Needs review', open: 'Not implemented' };
  const CLS = { done: 'crypto', partial: 'gas', review: 'culture', open: 'elections' };

  function render() {
    const rows = reqs.filter((r) => filter === 'all' || r.status === filter);
    $('#rows').innerHTML = rows.map((r) => `<tr id="${TB.esc(r.id)}">
      <td class="small"><code>${TB.esc(r.id)}</code></td>
      <td>${TB.esc(r.requirement)}</td>
      <td class="small">${r.implementation || '<span class="unverified">— not built</span>'}</td>
      <td class="small">${r.verification || '<span class="unverified">unverified</span>'}</td>
      <td><span class="tag ${CLS[r.status] || ''}">${LABEL[r.status] || r.status}</span></td>
      <td class="small">${TB.sourceLink(r.source, 'source ↗')}</td></tr>`).join('');
  }

  TB.bootRequirements = async () => {
    const doc = await TB.getJSON('data/requirements.json').catch(() => null);
    if (!doc) { $('#rows').innerHTML = '<tr><td colspan="6" class="unverified">data/requirements.json is missing</td></tr>'; return; }
    reqs = doc.requirements || [];
    const count = (s) => reqs.filter((r) => r.status === s).length;
    $('#kpis').innerHTML = [
      ['Requirements', reqs.length, 'in the register'],
      ['Implemented', count('done'), 'built and verified'],
      ['Partial', count('partial'), 'built with a stated gap'],
      ['Needs review', count('review'), 'published for review'],
      ['Not implemented', count('open'), 'explicitly out of scope so far'],
    ].map(([k, v, s]) => `<div class="card"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    render();
    document.querySelectorAll('#statusFilter button').forEach((b) => b.addEventListener('click', () => {
      filter = b.dataset.status;
      document.querySelectorAll('#statusFilter button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      render();
    }));
  };
  document.addEventListener('DOMContentLoaded', TB.bootRequirements);
})();
