function renderDataAnalysis() {
  return `
    <div class="card">
      <h2><i class="fas fa-chart-line"></i> 学情趋势分析</h2>
      <button class="btn-primary" id="trend-btn">生成趋势图</button>
      <canvas id="trend-chart" width="400" height="200" style="max-width:100%;margin-top:15px;"></canvas>
      <div id="trend-info" style="margin-top:12px;"></div>
    </div>
  `;
}

function initDataAnalysis() {
  document.getElementById('trend-btn').addEventListener('click', function() {
    const ctx = document.getElementById('trend-chart').getContext('2d');
    if (window._trendInstance) window._trendInstance.destroy();
    window._trendInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['第1周', '第2周', '第3周', '第4周', '第5周'],
        datasets: [
          { label: '班级平均分', data: [68, 72, 70, 75, 78], borderColor: '#4a6fa5', tension: 0.2 },
          { label: '年级平均分', data: [65, 67, 69, 71, 73], borderColor: '#ffb74d', tension: 0.2 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: true }
    });
    document.getElementById('trend-info').innerHTML = '📈 近五周成绩呈上升趋势，建议继续保持。';
  });
}

renderDataAnalysis.init = initDataAnalysis;