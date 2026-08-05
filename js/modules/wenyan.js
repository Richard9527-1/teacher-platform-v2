function renderWenyan() {
  return `
    <div class="card">
      <h2>📜 文言文神器</h2>
      <input type="text" id="wenyan-input" placeholder="输入篇目，如：鸿门宴" list="wenyan-suggestions">
      <datalist id="wenyan-suggestions">
        ${Object.keys(window.WENYAN_KNOWLEDGE).map(name => `<option value="${name}">`).join('')}
      </datalist>
      <button class="btn-primary" id="wenyan-btn">提取知识点</button>
      <div id="wenyan-result" style="margin-top:20px;background:var(--bg);padding:15px;border-radius:6px;"></div>
    </div>
  `;
}
function initWenyan() {
  document.getElementById('wenyan-btn').addEventListener('click', function() {
    const name = document.getElementById('wenyan-input').value.trim();
    const data = window.WENYAN_KNOWLEDGE[name];
    const div = document.getElementById('wenyan-result');
    if (!data) { div.textContent = '未收录，请补充数据。'; return; }
    let html = `<h3>《${name}》文言知识</h3>`;
    html += `<p><strong>通假字：</strong>${data.tongjia.join('、')}</p>`;
    html += `<p><strong>古今异义：</strong>${data.gjyi.join('、')}</p>`;
    html += `<p><strong>词类活用：</strong>${data.cihuolei.join('、')}</p>`;
    html += `<p><strong>特殊句式：</strong>${data.specialSentence.join('、')}</p>`;
    html += `<p><strong>重点实词/虚词：</strong>${data.keyWords.join('、')}</p>`;
    div.innerHTML = html;
  });
}
renderWenyan.init = initWenyan;