/* ==========================================================
 * 教材篇目详情懒加载器
 * ----------------------------------------------------------
 * 背景：全部 137 篇的详情数据（全文/拼音/注释/译文/讲解/赏析/考点）
 *       体量较大，若与索引一并同步加载会拖慢首屏。
 * 方案：data/texts-index.js 同步加载轻量索引（列表、搜索、筛选够用）；
 *       详情按「年级+类型」拆成 6 个分片，打开详情时才拉取对应分片。
 * 分片：data/texts/detail-{g1|g2|g3}-{poetry|wenyan|text}.js
 * ========================================================== */
(function () {
  'use strict';

  var SHARD_KEYS = [
    'g1-poetry', 'g1-wenyan', 'g1-text',
    'g2-poetry', 'g2-wenyan', 'g2-text',
    'g3-poetry', 'g3-wenyan', 'g3-text'
  ];

  // 分片加载状态：undefined 未加载 / Promise 加载中或已完成
  var shardPromise = {};
  // 已成功注册的分片
  var shardLoaded = {};

  /* ---------- 分片注册回调（由分片文件调用） ---------- */
  window.__registerTextDetails = function (shardKey, details) {
    var store = window.SAMPLE_TEXTS || (window.SAMPLE_TEXTS = {});
    Object.keys(details).forEach(function (name) {
      if (store[name]) {
        // 详情字段合并进索引条目（索引字段优先保留）
        var d = details[name];
        Object.keys(d).forEach(function (k) { store[name][k] = d[k]; });
      } else {
        store[name] = details[name];
      }
    });
    shardLoaded[shardKey] = true;
  };

  /* ---------- 分片键推导（须与 _split.js 保持一致） ---------- */
  function shardKeyOf(item) {
    if (!item) return null;
    var g = item.grade === '高一' ? 'g1' : (item.grade === '高二' ? 'g2' : 'g3');
    var t = item.type === '古诗词' ? 'poetry' : (item.type === '文言文' ? 'wenyan' : 'text');
    return g + '-' + t;
  }

  /* ---------- 按标题取索引条目（兼容带 * 前缀的键名） ---------- */
  function getIndexItem(title) {
    var store = window.SAMPLE_TEXTS || {};
    if (store[title]) return store[title];
    var clean = String(title).replace(/^\*\s*/, '');
    if (store[clean]) return store[clean];
    if (store['*' + clean]) return store['*' + clean];
    return null;
  }

  /* ---------- 加载单个分片 ---------- */
  function loadShard(shardKey) {
    if (!shardKey) return Promise.resolve(false);
    if (shardPromise[shardKey]) return shardPromise[shardKey];

    shardPromise[shardKey] = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'data/texts/detail-' + shardKey + '.js';
      s.async = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () {
        // 分片缺失不阻断流程，详情页按「暂无数据」渲染
        console.warn('[text-loader] 分片加载失败：' + shardKey);
        shardLoaded[shardKey] = true;
        resolve(false);
      };
      document.head.appendChild(s);
    });
    return shardPromise[shardKey];
  }

  /* ---------- 对外：加载某篇的详情 ---------- */
  function loadTextDetail(title) {
    var item = getIndexItem(title);
    if (!item) return Promise.resolve(null);
    // 已有详情（分片已加载过）直接返回
    if (item.fullText !== undefined || item.__noDetail) return Promise.resolve(item);
    // 索引标记为未补齐，无需请求分片
    if (!item.hasDetail) { item.__noDetail = true; return Promise.resolve(item); }

    var sk = shardKeyOf(item);
    if (shardLoaded[sk]) return Promise.resolve(getIndexItem(title));
    return loadShard(sk).then(function () { return getIndexItem(title); });
  }

  /* ---------- 对外：加载全部分片（导出、全局检索等场景） ---------- */
  function loadAllTextDetails() {
    var need = {};
    var store = window.SAMPLE_TEXTS || {};
    Object.keys(store).forEach(function (n) {
      if (store[n].hasDetail) need[shardKeyOf(store[n])] = 1;
    });
    var keys = Object.keys(need).filter(function (k) { return SHARD_KEYS.indexOf(k) !== -1; });
    return Promise.all(keys.map(loadShard)).then(function () { return window.SAMPLE_TEXTS; });
  }

  /* ---------- 对外：预取（空闲时后台加载，提升点击响应） ---------- */
  function prefetchShard(shardKey) {
    if (!shardKey || shardPromise[shardKey]) return;
    var run = function () { loadShard(shardKey); };
    if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 3000 });
    else setTimeout(run, 1200);
  }

  /* ---------- 判断某篇是否已补齐详情（列表打标用） ---------- */
  function hasTextDetail(title) {
    var item = getIndexItem(title);
    return !!(item && (item.hasDetail || item.fullText));
  }

  window.loadTextDetail = loadTextDetail;
  window.loadAllTextDetails = loadAllTextDetails;
  window.prefetchTextShard = prefetchShard;
  window.hasTextDetail = hasTextDetail;
  window.textShardKeyOf = shardKeyOf;
})();
