// js/modules/chart-helper.js
// ============================================================
// 图表封装层（基于本地内置 Chart.js v4，离线可用）
// 统一折线/柱状/雷达渲染，内置中文 tooltip、暗色主题适配、
// 满分自适应 Y 轴、缺考断点（spanGaps:false）、同 canvas 重绘销毁。
// 供 data-analysis 与 scoreboard 复用，消灭原生 Canvas 手绘。
// ============================================================
(function () {
  'use strict';

  // 主题色板（与方案色阶一致）
  var PALETTE = ['#185FA5', '#BA7517', '#639922', '#A32D2D', '#534AB7',
    '#0F6E56', '#993556', '#854F0B', '#3B6D11', '#042C53',
    '#7F77DD', '#D85A30', '#1D9E75', '#993C1D', '#378ADD'];

  function themeColors() {
    var dark = document.body && document.body.classList.contains('dark');
    return {
      dark: dark,
      text: dark ? '#c9d1d9' : '#333333',
      grid: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
      tick: dark ? '#9aa4b2' : '#666666',
      legend: dark ? '#c9d1d9' : '#444444'
    };
  }

  // 同 canvas 重绘前销毁旧实例，避免叠加
  var registry = {};
  function ensureDestroy(canvas) {
    var id = canvas && canvas.id;
    if (id && registry[id]) {
      try { registry[id].destroy(); } catch (e) { /* noop */ }
      delete registry[id];
    }
  }

  function baseScales(opts, withY) {
    var t = themeColors();
    opts.scales = opts.scales || {};
    opts.scales.x = {
      ticks: { color: t.tick, font: { size: 11 } },
      grid: { color: t.grid }
    };
    if (withY) {
      opts.scales.y = {
        beginAtZero: true,
        ticks: { color: t.tick, font: { size: 11 } },
        grid: { color: t.grid }
      };
    }
    return opts;
  }

  function baseOptions(title, withY) {
    var t = themeColors();
    var opts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: title
          ? { display: true, text: title, color: t.text, font: { size: 14 } }
          : { display: false },
        legend: { labels: { color: t.legend, font: { size: 11 }, boxWidth: 12 } },
        tooltip: { enabled: true, mode: 'index', intersect: false }
      }
    };
    return baseScales(opts, withY);
  }

  // ---------- 折线图 ----------
  // cfg: { title, labels(考试日期/名称数组), series:[{label,data,color}], maxScore }
  function daLineChart(canvas, cfg) {
    ensureDestroy(canvas);
    var t = themeColors();
    var datasets = (cfg.series || []).map(function (s, i) {
      var c = s.color || PALETTE[i % PALETTE.length];
      return {
        label: s.label,
        data: s.data,
        borderColor: c,
        backgroundColor: c,
        tension: 0.25,
        spanGaps: false, // 缺考自动断点（不在该考试处置点）
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2
      };
    });
    var opt = baseOptions(cfg.title, true);
    if (cfg.maxScore) {
      opt.scales.y.suggestedMax = cfg.maxScore;
    }
    var chart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels: cfg.labels, datasets: datasets },
      options: opt
    });
    registry[canvas.id] = chart;
    return chart;
  }

  // ---------- 柱状图 ----------
  // cfg: { title, labels, datasets:[{label,data,color}], horizontal, maxScore }
  function daBarChart(canvas, cfg) {
    ensureDestroy(canvas);
    var datasets = (cfg.datasets || []).map(function (d, i) {
      var c = d.color || PALETTE[i % PALETTE.length];
      return {
        label: d.label,
        data: d.data,
        backgroundColor: c,
        borderRadius: 4,
        maxBarThickness: 48
      };
    });
    var opt = baseOptions(cfg.title, !cfg.horizontal);
    if (cfg.horizontal) {
      opt.indexAxis = 'y';
      opt.scales.x = { beginAtZero: true, ticks: { color: themeColors().tick }, grid: { color: themeColors().grid } };
      delete opt.scales.y;
    }
    if (cfg.maxScore) opt.scales.y.suggestedMax = cfg.maxScore;
    var chart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels: cfg.labels, datasets: datasets },
      options: opt
    });
    registry[canvas.id] = chart;
    return chart;
  }

  // ---------- 雷达图 ----------
  // cfg: { title, labels(维度), datasets:[{label,data,color}] }
  function daRadarChart(canvas, cfg) {
    ensureDestroy(canvas);
    var t = themeColors();
    var datasets = (cfg.datasets || []).map(function (d, i) {
      var c = d.color || PALETTE[i % PALETTE.length];
      return {
        label: d.label,
        data: d.data,
        borderColor: c,
        backgroundColor: c.replace('#', 'rgba(') , // 占位，下行覆盖
        pointBackgroundColor: c,
        borderWidth: 2
      };
    });
    // 正确的半透明填充
    datasets.forEach(function (d) {
      d.backgroundColor = hexToRgba(d.borderColor, 0.15);
    });
    var opt = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: cfg.title ? { display: true, text: cfg.title, color: t.text, font: { size: 14 } } : { display: false },
        legend: { labels: { color: t.legend, font: { size: 11 } } },
        tooltip: { enabled: true }
      },
      scales: {
        r: {
          beginAtZero: true,
          ticks: { color: t.tick, backdropColor: 'transparent', font: { size: 10 } },
          grid: { color: t.grid },
          angleLines: { color: t.grid },
          pointLabels: { color: t.text, font: { size: 12 } }
        }
      }
    };
    var chart = new Chart(canvas.getContext('2d'), {
      type: 'radar',
      data: { labels: cfg.labels, datasets: datasets },
      options: opt
    });
    registry[canvas.id] = chart;
    return chart;
  }

  function hexToRgba(hex, alpha) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.substr(0, 2), 16),
      g = parseInt(h.substr(2, 2), 16),
      b = parseInt(h.substr(4, 2), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // 暴露到全局
  window.DA_PALETTE = PALETTE;
  window.daLineChart = daLineChart;
  window.daBarChart = daBarChart;
  window.daRadarChart = daRadarChart;
  window.daThemeColors = themeColors;
  window.daHexToRgba = hexToRgba;
  window.daGetChart = function (id) { return registry[id] || null; };
})();
