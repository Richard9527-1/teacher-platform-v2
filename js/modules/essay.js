// js/modules/essay.js
// ============================================================
// 作文批改助手 - 智能批改 + 主观批改
// ============================================================

// ========== 预设优缺点数据 ==========
const PRESET_STRENGTHS = [
  { id: 's1', name: '立意深刻', score: 6 },
  { id: 's2', name: '结构清晰', score: 5 },
  { id: 's3', name: '语言优美', score: 5 },
  { id: 's4', name: '素材丰富', score: 4 },
  { id: 's5', name: '论证有力', score: 5 },
  { id: 's6', name: '情感真挚', score: 4 },
  { id: 's7', name: '逻辑严密', score: 5 },
  { id: 's8', name: '卷面整洁', score: 2 }
];

const PRESET_WEAKNESSES = [
  { id: 'w1', name: '中心模糊', score: 6 },
  { id: 'w2', name: '论证不足', score: 5 },
  { id: 'w3', name: '语言平淡', score: 4 },
  { id: 'w4', name: '结构松散', score: 5 },
  { id: 'w5', name: '素材匮乏', score: 4 },
  { id: 'w6', name: '逻辑混乱', score: 5 },
  { id: 'w7', name: '跑题偏题', score: 10 },
  { id: 'w8', name: '字数不足', score: 4 },
  { id: 'w9', name: '错别字多', score: 3 }
];

const BASE_SCORE = 42;

const STRENGTH_COMMENTS = {
  '立意深刻': '立意深刻，见解独到，体现了较强的思辨能力。',
  '结构清晰': '文章结构清晰，层次分明，逻辑性强。',
  '语言优美': '语言优美流畅，词汇丰富，表达精准。',
  '素材丰富': '素材积累丰富，引用恰当，增强了说服力。',
  '论证有力': '论证过程严谨有力，论据充分。',
  '情感真挚': '情感表达真挚动人，富有感染力。',
  '逻辑严密': '逻辑严密，推理过程环环相扣。',
  '卷面整洁': '卷面整洁，书写工整，给人良好印象。'
};

const WEAKNESS_COMMENTS = {
  '中心模糊': '中心论点不够明确，建议在开头直接亮明观点。',
  '论证不足': '论证不够充分，建议增加具体事例支撑。',
  '语言平淡': '语言表达较为平淡，建议增加修辞手法。',
  '结构松散': '文章结构略显松散，建议加强段落间衔接。',
  '素材匮乏': '素材积累不足，建议多阅读积累。',
  '逻辑混乱': '逻辑关系不够清晰，建议理清论证思路。',
  '跑题偏题': '内容偏离主题，建议紧扣中心论点展开。',
  '字数不足': '字数未达到要求，建议进一步充实内容。',
  '错别字多': '存在较多错别字，建议仔细检查。'
};

// 手写识别结果的暂存位（OCR → 批改 的数据通道）
const ESSAY_PENDING_LS = 'essayPendingText';

function getPendingEssayText() {
  return localStorage.getItem(ESSAY_PENDING_LS) || '';
}

function escapeForTextarea(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ========== 辅助函数 ==========
function renderAITab() {
  const pending = getPendingEssayText();
  return `
    <div id="aiPanel">
      ${pending ? `<div style="margin-bottom:10px;padding:8px 12px;background:rgba(40,167,69,0.1);border-left:3px solid var(--c-success);border-radius:6px;font-size:0.85rem;color:var(--text);">📷 已载入手写识别结果，可直接批改（可先在下方修改校对）</div>` : ''}
      <textarea id="essayInput" rows="8" placeholder="粘贴学生作文内容，或到「📷 手写录入」拍照识别后一键送来..." style="width:100%;padding:10px;border-radius:8px;border:1px solid #ddd;background:var(--bg);color:var(--text);font-size:0.95rem;line-height:1.8;">${escapeForTextarea(pending)}</textarea>
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;">
        <button class="btn" id="gradeBtn">🤖 生成批改</button>
        <button class="btn btn-secondary" id="toManualFromAiBtn">✏️ 转主观批改</button>
        <span id="essayCharCount" style="color:var(--text-light);font-size:0.85rem;"></span>
      </div>
      <div id="essayResult" style="margin-top:16px;background:var(--bg);padding:16px;border-radius:8px;min-height:60px;color:var(--text-light);">等待批改...</div>
    </div>
  `;
}

// ========== 手写录入 Tab（内嵌 OCR 模块） ==========
function renderOcrTab() {
  if (typeof window.renderOcrBody !== 'function') {
    return `<div style="padding:20px;color:var(--c-danger);">⚠️ 手写识别模块未加载，请检查 js/modules/ocr.js 是否引入。</div>`;
  }
  return `
    <div id="ocrPanel">
      <div style="margin-bottom:12px;padding:10px 14px;background:rgba(74,111,165,0.08);border-radius:8px;font-size:0.85rem;color:var(--text);line-height:1.8;">
        <b>批改工作流</b>：① 上传手写作文照片 → ② 识别并校对文字 → ③ 点 <b style="color:var(--c-success);">✍️ 送去批改</b>，文字会自动带入批改页。
      </div>
      ${window.renderOcrBody({ embedded: true })}
    </div>
  `;
}

function initOcrTab() {
  if (typeof window.initOcr === 'function') window.initOcr();
}

function renderManualTab() {
  const saved = JSON.parse(localStorage.getItem('manualEssayState') || '{}');
  const selectedStrengths = saved.strengths || [];
  const selectedWeaknesses = saved.weaknesses || [];

  let html = `
    <div id="manualPanel">
      <textarea id="manualEssayInput" rows="6" placeholder="粘贴学生作文内容（可选），或到「📷 手写录入」识别后一键送来..." style="width:100%;padding:10px;border-radius:8px;border:1px solid #ddd;background:var(--bg);color:var(--text);font-size:0.95rem;line-height:1.8;margin-bottom:12px;">${escapeForTextarea(saved.essayText || getPendingEssayText())}</textarea>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <!-- 优点选择 -->
        <div style="background:var(--bg);padding:12px;border-radius:8px;">
          <h4 style="margin-bottom:8px;color:var(--c-success);">✅ 优点（加分）</h4>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${PRESET_STRENGTHS.map(s => `
              <span class="strength-tag" data-id="${s.id}" style="padding:4px 12px;border-radius:20px;font-size:0.85rem;cursor:pointer;background:${selectedStrengths.includes(s.id) ? 'var(--c-success)' : 'var(--card-bg)'};color:${selectedStrengths.includes(s.id) ? '#fff' : 'var(--text)'};border:1px solid ${selectedStrengths.includes(s.id) ? 'var(--c-success)' : '#ddd'};transition:all 0.2s;">
                ${s.name} (+${s.score})
              </span>
            `).join('')}
          </div>
        </div>
        
        <!-- 缺点选择 -->
        <div style="background:var(--bg);padding:12px;border-radius:8px;">
          <h4 style="margin-bottom:8px;color:var(--c-danger);">❌ 缺点（减分）</h4>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${PRESET_WEAKNESSES.map(w => `
              <span class="weakness-tag" data-id="${w.id}" style="padding:4px 12px;border-radius:20px;font-size:0.85rem;cursor:pointer;background:${selectedWeaknesses.includes(w.id) ? 'var(--c-danger)' : 'var(--card-bg)'};color:${selectedWeaknesses.includes(w.id) ? '#fff' : 'var(--text)'};border:1px solid ${selectedWeaknesses.includes(w.id) ? 'var(--c-danger)' : '#ddd'};transition:all 0.2s;">
                ${w.name} (-${w.score})
              </span>
            `).join('')}
          </div>
        </div>
      </div>
      
      <!-- 自定义评语 -->
      <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label style="font-size:0.9rem;font-weight:500;">➕ 自定义优点</label>
          <div style="display:flex;gap:6px;">
            <input type="text" id="customStrengthInput" placeholder="如：有创意" style="flex:1;padding:6px 12px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);" />
            <button class="btn" id="addCustomStrengthBtn" style="padding:6px 12px;font-size:0.85rem;">添加</button>
          </div>
          <div id="customStrengths" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
            ${(saved.customStrengths || []).map(c => `<span style="background:var(--c-success);color:#fff;padding:2px 10px;border-radius:30px;font-size:0.8rem;display:inline-flex;align-items:center;gap:4px;">${c} <span class="remove-custom" data-type="strength" data-value="${c}" style="cursor:pointer;">✕</span></span>`).join('')}
          </div>
        </div>
        <div>
          <label style="font-size:0.9rem;font-weight:500;">➖ 自定义缺点</label>
          <div style="display:flex;gap:6px;">
            <input type="text" id="customWeaknessInput" placeholder="如：标点不规范" style="flex:1;padding:6px 12px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);" />
            <button class="btn" id="addCustomWeaknessBtn" style="padding:6px 12px;font-size:0.85rem;">添加</button>
          </div>
          <div id="customWeaknesses" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
            ${(saved.customWeaknesses || []).map(c => `<span style="background:var(--c-danger);color:#fff;padding:2px 10px;border-radius:30px;font-size:0.8rem;display:inline-flex;align-items:center;gap:4px;">${c} <span class="remove-custom" data-type="weakness" data-value="${c}" style="cursor:pointer;">✕</span></span>`).join('')}
          </div>
        </div>
      </div>
      
      <!-- 预览和操作 -->
      <div style="margin-top:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <button class="btn" id="previewManualBtn">📊 预览评分</button>
        <button class="btn btn-success" id="generateManualReportBtn">📝 生成批改报告</button>
        <span style="color:var(--text-light);font-size:0.9rem;">基础分：${BASE_SCORE}分（满分60）</span>
      </div>
      
      <div id="manualPreview" style="margin-top:12px;background:var(--bg);padding:16px;border-radius:8px;min-height:60px;color:var(--text-light);">
        选择优缺点后点击「预览评分」
      </div>
    </div>
  `;
  return html;
}

// ========== 计算主观批改分数 ==========
function calculateManualScore(selectedStrengths, selectedWeaknesses, customStrengths, customWeaknesses) {
  let strengthScore = 0;
  let strengthNames = [];
  selectedStrengths.forEach(id => {
    const s = PRESET_STRENGTHS.find(item => item.id === id);
    if (s) {
      strengthScore += s.score;
      strengthNames.push(s.name);
    }
  });
  (customStrengths || []).forEach(name => {
    strengthScore += 3;
    strengthNames.push(name + '（自定义）');
  });

  let weaknessScore = 0;
  let weaknessNames = [];
  selectedWeaknesses.forEach(id => {
    const w = PRESET_WEAKNESSES.find(item => item.id === id);
    if (w) {
      weaknessScore += w.score;
      weaknessNames.push(w.name);
    }
  });
  (customWeaknesses || []).forEach(name => {
    weaknessScore += 3;
    weaknessNames.push(name + '（自定义）');
  });

  const total = Math.min(Math.max(BASE_SCORE + strengthScore - weaknessScore, 0), 60);
  return {
    total: Math.round(total),
    strengthScore,
    weaknessScore,
    strengthNames,
    weaknessNames
  };
}

// ========== 生成主观评语 ==========
function generateManualComment(strengthNames, weaknessNames, score) {
  let parts = [];
  if (strengthNames.length > 0) {
    let comment = '优点：';
    const comments = strengthNames.map(name => {
      const cleanName = name.replace('（自定义）', '');
      return STRENGTH_COMMENTS[cleanName] || `${cleanName}，表现良好。`;
    });
    comment += comments.join('；');
    parts.push(comment);
  }
  if (weaknessNames.length > 0) {
    let comment = '建议：';
    const comments = weaknessNames.map(name => {
      const cleanName = name.replace('（自定义）', '');
      return WEAKNESS_COMMENTS[cleanName] || `建议加强${cleanName}方面的训练。`;
    });
    comment += comments.join('；');
    parts.push(comment);
  }
  if (strengthNames.length === 0 && weaknessNames.length === 0) {
    return '请选择优缺点，以便生成评语。';
  }
  let overall = '';
  if (score >= 50) overall = '优秀作文，继续保持！';
  else if (score >= 40) overall = '良好，有进一步提升空间。';
  else if (score >= 30) overall = '中等，建议针对薄弱环节加强训练。';
  else overall = '需要认真分析问题，重点突破。';
  parts.push(`综合评价：${overall}`);
  return parts.join('\n');
}

function saveManualState(state) {
  localStorage.setItem('manualEssayState', JSON.stringify(state));
}

// ========== 智能批改初始化 ==========
function initAITab() {
  const input = document.getElementById('essayInput');
  const counter = document.getElementById('essayCharCount');

  function refreshCount() {
    if (!counter || !input) return;
    const n = (input.value || '').replace(/\s/g, '').length;
    counter.textContent = n ? `字数：${n}` : '';
  }
  if (input) {
    refreshCount();
    input.addEventListener('input', () => {
      refreshCount();
      localStorage.setItem(ESSAY_PENDING_LS, input.value);
    });
  }

  const toManual = document.getElementById('toManualFromAiBtn');
  if (toManual) {
    toManual.addEventListener('click', function () {
      if (input) {
        const saved = JSON.parse(localStorage.getItem('manualEssayState') || '{}');
        saved.essayText = input.value;
        saveManualState(saved);
        localStorage.setItem(ESSAY_PENDING_LS, input.value);
      }
      switchEssayTab('manual');
    });
  }

  const btn = document.getElementById('gradeBtn');
  if (btn) {
    btn.addEventListener('click', function() {
      const text = document.getElementById('essayInput').value.trim();
      const resultDiv = document.getElementById('essayResult');
      if (!text) {
        resultDiv.innerHTML = '⚠️ 请先输入作文内容。';
        return;
      }
      const cleanLen = text.replace(/\s/g, '').length;
      // 依据字数给出基准分并做小幅扰动——仅作快速初评参考，非 AI 精批
      const base = cleanLen >= 800 ? 50 : cleanLen >= 600 ? 46 : cleanLen >= 400 ? 42 : cleanLen >= 200 ? 38 : 34;
      const score = Math.max(0, Math.min(60, base + Math.floor(Math.random() * 7) - 3));
      const comments = ['语言优美，情感真挚', '论证有力，结构清晰', '思维深刻，富有思辨', '素材丰富，联系现实'];
      const tags = ['立意', '结构', '语言', '素材'];
      const randomTag = tags[Math.floor(Math.random() * tags.length)];
      resultDiv.innerHTML = `
        <div style="background:#fff7e6;border:1px solid #ffd591;color:#ad6800;padding:8px 12px;border-radius:8px;font-size:0.82rem;line-height:1.5;margin-bottom:10px;">
          ⚠️ 本结果为<strong>系统自动初评</strong>（依据字数等简单规则生成），<strong>非 AI 精批</strong>，仅供教师快速参考；正式评分请使用「主观批改」或人工评阅。
        </div>
        <h3>📊 自动初评报告</h3>
        <p><strong>建议分数：</strong>${score}/60（字数约 ${cleanLen}）</p>
        <p><strong>亮点：</strong>${randomTag}较为突出，语言流畅。</p>
        <p><strong>不足：</strong>中心论点稍显模糊，部分事例论证不够充分。</p>
        <p><strong>修改建议：</strong>建议在第二段增加一个具体事例，并加强段落间的逻辑衔接。</p>
        <p><strong>评语：</strong>${comments[Math.floor(Math.random() * comments.length)]}</p>
      `;
    });
  }
}

// ========== 主观批改初始化 ==========
function initManualTab() {
  const saved = JSON.parse(localStorage.getItem('manualEssayState') || '{}');
  let selectedStrengths = saved.strengths || [];
  let selectedWeaknesses = saved.weaknesses || [];
  let customStrengths = saved.customStrengths || [];
  let customWeaknesses = saved.customWeaknesses || [];

  function saveState() {
    const essayText = document.getElementById('manualEssayInput')?.value || '';
    saveManualState({
      strengths: selectedStrengths,
      weaknesses: selectedWeaknesses,
      customStrengths: customStrengths,
      customWeaknesses: customWeaknesses,
      essayText: essayText
    });
  }

  function updatePreview() {
    const result = calculateManualScore(selectedStrengths, selectedWeaknesses, customStrengths, customWeaknesses);
    const comment = generateManualComment(result.strengthNames, result.weaknessNames, result.total);
    const previewDiv = document.getElementById('manualPreview');
    if (previewDiv) {
      previewDiv.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <p><strong>📊 预估分数：</strong><span style="font-size:1.4rem;font-weight:700;color:var(--c-primary);">${result.total}</span>/60</p>
            <p><strong>✅ 优点加分：</strong>+${result.strengthScore}分（${result.strengthNames.join('、') || '无'}）</p>
            <p><strong>❌ 缺点减分：</strong>-${result.weaknessScore}分（${result.weaknessNames.join('、') || '无'}）</p>
          </div>
          <div>
            <p><strong>📝 评语预览：</strong></p>
            <p style="white-space:pre-wrap;font-size:0.9rem;background:var(--card-bg);padding:8px;border-radius:6px;">${comment}</p>
          </div>
        </div>
      `;
    }
    saveState();
  }

  // 正文编辑同步（切 Tab 不丢）
  const manualInput = document.getElementById('manualEssayInput');
  if (manualInput) {
    manualInput.addEventListener('input', () => {
      localStorage.setItem(ESSAY_PENDING_LS, manualInput.value);
      saveState();
    });
  }

  // 优点点击
  document.querySelectorAll('.strength-tag').forEach(el => {
    el.addEventListener('click', function() {
      const id = this.dataset.id;
      const idx = selectedStrengths.indexOf(id);
      if (idx > -1) {
        selectedStrengths.splice(idx, 1);
        this.style.background = 'var(--card-bg)';
        this.style.color = 'var(--text)';
        this.style.borderColor = '#ddd';
      } else {
        selectedStrengths.push(id);
        this.style.background = 'var(--c-success)';
        this.style.color = '#fff';
        this.style.borderColor = 'var(--c-success)';
      }
      updatePreview();
    });
  });

  // 缺点点击
  document.querySelectorAll('.weakness-tag').forEach(el => {
    el.addEventListener('click', function() {
      const id = this.dataset.id;
      const idx = selectedWeaknesses.indexOf(id);
      if (idx > -1) {
        selectedWeaknesses.splice(idx, 1);
        this.style.background = 'var(--card-bg)';
        this.style.color = 'var(--text)';
        this.style.borderColor = '#ddd';
      } else {
        selectedWeaknesses.push(id);
        this.style.background = 'var(--c-danger)';
        this.style.color = '#fff';
        this.style.borderColor = 'var(--c-danger)';
      }
      updatePreview();
    });
  });

  // 自定义优点添加
  const addStrengthBtn = document.getElementById('addCustomStrengthBtn');
  if (addStrengthBtn) addStrengthBtn.addEventListener('click', function() {
    const input = document.getElementById('customStrengthInput');
    const val = input.value.trim();
    if (!val) return;
    customStrengths.push(val);
    input.value = '';
    renderCustomTags();
    updatePreview();
  });

  // 自定义缺点添加
  const addWeaknessBtn = document.getElementById('addCustomWeaknessBtn');
  if (addWeaknessBtn) addWeaknessBtn.addEventListener('click', function() {
    const input = document.getElementById('customWeaknessInput');
    const val = input.value.trim();
    if (!val) return;
    customWeaknesses.push(val);
    input.value = '';
    renderCustomTags();
    updatePreview();
  });

  function renderCustomTags() {
    const strengthContainer = document.getElementById('customStrengths');
    const weaknessContainer = document.getElementById('customWeaknesses');
    if (strengthContainer) {
      strengthContainer.innerHTML = customStrengths.map(c => 
        `<span style="background:var(--c-success);color:#fff;padding:2px 10px;border-radius:30px;font-size:0.8rem;display:inline-flex;align-items:center;gap:4px;">${c} <span class="remove-custom" data-type="strength" data-value="${c}" style="cursor:pointer;">✕</span></span>`
      ).join('');
    }
    if (weaknessContainer) {
      weaknessContainer.innerHTML = customWeaknesses.map(c => 
        `<span style="background:var(--c-danger);color:#fff;padding:2px 10px;border-radius:30px;font-size:0.8rem;display:inline-flex;align-items:center;gap:4px;">${c} <span class="remove-custom" data-type="weakness" data-value="${c}" style="cursor:pointer;">✕</span></span>`
      ).join('');
    }
    document.querySelectorAll('.remove-custom').forEach(el => {
      el.addEventListener('click', function() {
        const type = this.dataset.type;
        const value = this.dataset.value;
        if (type === 'strength') {
          customStrengths = customStrengths.filter(v => v !== value);
        } else {
          customWeaknesses = customWeaknesses.filter(v => v !== value);
        }
        renderCustomTags();
        updatePreview();
      });
    });
  }

  const previewBtn = document.getElementById('previewManualBtn');
  if (previewBtn) previewBtn.addEventListener('click', updatePreview);

  const genBtn = document.getElementById('generateManualReportBtn');
  if (genBtn) genBtn.addEventListener('click', function() {
    const result = calculateManualScore(selectedStrengths, selectedWeaknesses, customStrengths, customWeaknesses);
    const comment = generateManualComment(result.strengthNames, result.weaknessNames, result.total);
    const essayText = document.getElementById('manualEssayInput')?.value || '';
    const reportDiv = document.getElementById('manualPreview');
    reportDiv.innerHTML = `
      <h3>📊 主观批改报告</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px;">
        <div>
          <p><strong>📊 最终分数：</strong><span style="font-size:1.8rem;font-weight:700;color:var(--c-primary);">${result.total}</span>/60</p>
          <p><strong>✅ 优点：</strong>${result.strengthNames.join('、') || '无'}</p>
          <p><strong>❌ 缺点：</strong>${result.weaknessNames.join('、') || '无'}</p>
          <p style="font-size:0.85rem;color:var(--text-light);margin-top:8px;">
            <span style="color:var(--c-success);">+${result.strengthScore}</span> / 
            <span style="color:var(--c-danger);">-${result.weaknessScore}</span> / 
            基础分 ${BASE_SCORE}
          </p>
        </div>
        <div>
          <p><strong>📝 评语：</strong></p>
          <p style="white-space:pre-wrap;font-size:0.9rem;background:var(--card-bg);padding:10px;border-radius:6px;border-left:3px solid var(--c-primary);">${comment}</p>
        </div>
      </div>
      ${essayText ? `<div style="margin-top:12px;padding:10px;background:var(--card-bg);border-radius:6px;font-size:0.85rem;color:var(--text-light);"><strong>📄 作文原文：</strong><br>${essayText.substring(0, 200)}${essayText.length > 200 ? '...' : ''}</div>` : ''}
      <div style="margin-top:12px;display:flex;gap:8px;">
        <button class="btn btn-secondary" onclick="this.closest('#manualPreview').innerHTML = '选择优缺点后点击「预览评分」'">返回预览</button>
        <button class="btn btn-success" onclick="copyEssayReport(this)">📋 复制报告</button>
      </div>
    `;
  });

  // 恢复选中样式
  document.querySelectorAll('.strength-tag').forEach(el => {
    if (selectedStrengths.includes(el.dataset.id)) {
      el.style.background = 'var(--c-success)';
      el.style.color = '#fff';
      el.style.borderColor = 'var(--c-success)';
    }
  });
  document.querySelectorAll('.weakness-tag').forEach(el => {
    if (selectedWeaknesses.includes(el.dataset.id)) {
      el.style.background = 'var(--c-danger)';
      el.style.color = '#fff';
      el.style.borderColor = 'var(--c-danger)';
    }
  });
  renderCustomTags();
  setTimeout(updatePreview, 100);
}

// ========== Tab 配置 ==========
const ESSAY_TABS = {
  ocr:    { label: '📷 手写录入', render: renderOcrTab,    init: initOcrTab },
  ai:     { label: '🤖 自动初评', render: renderAITab,     init: initAITab },
  manual: { label: '✏️ 主观批改', render: renderManualTab, init: initManualTab }
};
const ESSAY_TAB_ORDER = ['ocr', 'ai', 'manual'];

let currentEssayTab = 'ocr';

function switchEssayTab(key) {
  const cfg = ESSAY_TABS[key];
  const content = document.getElementById('essayContent');
  if (!cfg || !content) return;

  // 离开批改页前，先把已编辑的正文回存，切回来不丢
  stashEssayText();

  content.innerHTML = cfg.render();
  try {
    cfg.init();
  } catch (e) {
    content.innerHTML = `<div style="padding:20px;color:var(--c-danger);">⚠️ 该功能初始化失败：${e.message}</div>`;
  }
  currentEssayTab = key;

  ESSAY_TAB_ORDER.forEach(k => {
    const btn = document.getElementById('essayTab_' + k);
    if (btn) btn.classList.toggle('active', k === key);
  });
}

// 把当前 Tab 里编辑过的正文暂存，供其它 Tab 复用
function stashEssayText() {
  const ai = document.getElementById('essayInput');
  const manual = document.getElementById('manualEssayInput');
  const el = ai || manual;
  if (el && typeof el.value === 'string') {
    localStorage.setItem(ESSAY_PENDING_LS, el.value);
  }
}

// ========== 复制批改报告（真实复制，带降级） ==========
function copyEssayReport(btn) {
  var el = document.getElementById('manualPreview');
  if (!el) return;
  var text = (el.innerText || el.textContent || '').trim();
  if (!text) { essayToast('没有可复制的内容'); return; }
  function ok() {
    var old = btn.textContent;
    btn.textContent = '✅ 已复制';
    setTimeout(function () { btn.textContent = old; }, 1500);
  }
  function fallback() {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      ok();
    } catch (e) {
      if (window.__showToast) window.__showToast('复制失败，请手动长按选择文本复制');
      else alert('复制失败，请手动长按选择文本复制');
    }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(ok, fallback);
  } else {
    fallback();
  }
}
window.copyEssayReport = copyEssayReport;

// ========== OCR → 批改 的入口（供 ocr.js 调用） ==========
window.essayReceiveText = function (text, sourceName) {
  const t = text || '';
  localStorage.setItem(ESSAY_PENDING_LS, t);

  // 同步进主观批改的持久化状态，两个 Tab 都能看到同一篇作文
  const saved = JSON.parse(localStorage.getItem('manualEssayState') || '{}');
  saved.essayText = t;
  saveManualState(saved);

  if (document.getElementById('essayContent')) {
    switchEssayTab('ai');
    const ta = document.getElementById('essayInput');
    if (ta) { ta.value = t; ta.focus(); }
    essayToast('已导入' + (sourceName ? '「' + sourceName + '」' : '') + '识别结果，可直接批改');
  } else {
    // 不在作文批改页（独立 OCR 页）→ 跳转过去并直接落在智能批改
    window.__essayInitialTab = 'ai';
    if (typeof window.showModule === 'function') {
      window.showModule('essay');
      document.querySelectorAll('.sidebar li').forEach(li => {
        li.classList.toggle('active', li.dataset.module === 'essay');
      });
    }
  }
};

function essayToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(40,167,69,0.92);color:#fff;padding:10px 20px;border-radius:8px;z-index:10000;font-size:0.9rem;';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

// ========== 主渲染函数 ==========
function renderEssay() {
  try {
    const tabBtns = ESSAY_TAB_ORDER.map(k =>
      `<button class="btn btn-secondary" id="essayTab_${k}">${ESSAY_TABS[k].label}</button>`
    ).join('');
    return `
      <div class="card">
        <div class="panel-head"><h2 class="panel-title">✍️ 作文批改助手</h2></div>
        <p class="panel-sub">手写作文拍照识别 → 校对 → 批改出分，一站完成</p>
        <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
          ${tabBtns}
        </div>
        <div id="essayContent" style="color:var(--text-light);">加载中…</div>
      </div>
    `;
  } catch (e) {
    return `<div class="card"><div class="panel-head"><h2 class="panel-title">⚠️ 加载失败</h2></div><p>${e.message}</p></div>`;
  }
}

// ========== 初始化 ==========
function initEssay() {
  ESSAY_TAB_ORDER.forEach(k => {
    const btn = document.getElementById('essayTab_' + k);
    if (btn) btn.addEventListener('click', () => switchEssayTab(k));
  });

  const initial = ESSAY_TABS[window.__essayInitialTab] ? window.__essayInitialTab : 'ocr';
  window.__essayInitialTab = null;
  switchEssayTab(initial);
}

// ========== 暴露到全局 ==========
window.renderEssay = renderEssay;
window.initEssay = initEssay;
window.switchEssayTab = switchEssayTab;