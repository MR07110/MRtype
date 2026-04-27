// statistic.js - Professional Statistics Module with Charts

class Statistics {
  constructor() {
    this.history = [];
    this.chartInstances = {};
    this.loadHistory();
  }

  loadHistory() {
    try {
      this.history = JSON.parse(localStorage.getItem('mrtype_history') || '[]');
    } catch {
      this.history = [];
    }
  }

  saveHistory() {
    localStorage.setItem('mrtype_history', JSON.stringify(this.history.slice(0, 500)));
  }

  addResult(result) {
    this.history.unshift(result);
    this.saveHistory();
    this.updateStatsUI();
  }

  getStats() {
    if (this.history.length === 0) {
      return {
        total: 0,
        bestWpm: 0,
        avgWpm: 0,
        avgAcc: 0,
        totalTime: 0,
        totalWords: 0,
        bestRaw: 0,
        bestAcc: 0,
        consistency: 0,
        peakWpm: 0,
        rank: 'Boshlangich'
      };
    }

    const total = this.history.length;
    const bestWpm = Math.max(...this.history.map(h => h.wpm));
    const avgWpm = Math.round(this.history.reduce((a, b) => a + b.wpm, 0) / total);
    const avgAcc = Math.round(this.history.reduce((a, b) => a + b.acc, 0) / total);
    const totalTime = this.history.reduce((a, b) => a + b.time, 0);
    const totalWords = this.history.reduce((a, b) => a + b.words, 0);
    const bestRaw = Math.max(...this.history.map(h => h.raw || h.wpm));
    const bestAcc = Math.max(...this.history.map(h => h.acc));
    
    // Calculate consistency (standard deviation of WPM)
    const wpmValues = this.history.map(h => h.wpm);
    const mean = avgWpm;
    const variance = wpmValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / total;
    const consistency = Math.max(0, Math.min(100, Math.round(100 - (Math.sqrt(variance) / mean) * 100)));

    // Get peak WPM (highest recorded)
    const peakWpm = bestWpm;

    return {
      total,
      bestWpm,
      avgWpm,
      avgAcc,
      totalTime,
      totalWords,
      bestRaw,
      bestAcc,
      consistency,
      peakWpm
    };
  }

  getWeeklyData() {
    const weekData = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('uz-UZ', { weekday: 'short' });
      
      const dayResults = this.history.filter(h => {
        const hDate = new Date(h.date);
        return hDate.toDateString() === date.toDateString();
      });
      
      const avgWpm = dayResults.length > 0 
        ? Math.round(dayResults.reduce((a, b) => a + b.wpm, 0) / dayResults.length)
        : 0;
      
      weekData.push({ day: dateStr, wpm: avgWpm, count: dayResults.length });
    }
    
    return weekData;
  }

  getMonthlyData() {
    const monthData = [];
    const today = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = date.toLocaleDateString('uz-UZ', { month: 'short' });
      
      const monthResults = this.history.filter(h => {
        const hDate = new Date(h.date);
        return hDate.getMonth() === date.getMonth() && hDate.getFullYear() === date.getFullYear();
      });
      
      const avgWpm = monthResults.length > 0 
        ? Math.round(monthResults.reduce((a, b) => a + b.wpm, 0) / monthResults.length)
        : 0;
      
      monthData.push({ month: monthStr, wpm: avgWpm, count: monthResults.length });
    }
    
    return monthData;
  }

  getProgressionData() {
    // Last 30 tests progression
    return this.history.slice(0, 30).reverse().map((h, i) => ({
      test: i + 1,
      wpm: h.wpm,
      acc: h.acc,
      raw: h.raw || h.wpm
    }));
  }

  getDistributionData() {
    const ranges = [
      { min: 0, max: 20, label: '0-20', count: 0 },
      { min: 20, max: 40, label: '20-40', count: 0 },
      { min: 40, max: 60, label: '40-60', count: 0 },
      { min: 60, max: 80, label: '60-80', count: 0 },
      { min: 80, max: 100, label: '80-100', count: 0 },
      { min: 100, max: 120, label: '100-120', count: 0 },
      { min: 120, max: 150, label: '120-150', count: 0 },
      { min: 150, max: 999, label: '150+', count: 0 }
    ];
    
    this.history.forEach(h => {
      for (const range of ranges) {
        if (h.wpm >= range.min && h.wpm < range.max) {
          range.count++;
          break;
        }
      }
    });
    
    return ranges;
  }

  getHeatmapData() {
    const heatmap = {};
    const allChars = 'abcdefghijklmnopqrstuvwxyz';
    
    for (const char of allChars) {
      heatmap[char] = { correct: 0, error: 0, total: 0 };
    }
    
    this.history.slice(0, 50).forEach(h => {
      if (h.errors) {
        Object.entries(h.errors).forEach(([char, count]) => {
          if (heatmap[char]) {
            heatmap[char].error += count;
            heatmap[char].total += count;
          }
        });
      }
    });
    
    return heatmap;
  }

  renderStatsPage(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const stats = this.getStats();
    const weeklyData = this.getWeeklyData();
    const monthlyData = this.getMonthlyData();
    const progressionData = this.getProgressionData();
    const distributionData = this.getDistributionData();
    
    const rank = this.getRank(stats.bestWpm);
    
    container.innerHTML = `
      <div class="stats-container">
        <!-- Header -->
        <div class="stats-header">
          <div class="stats-title">Statistika</div>
          <div class="stats-subtitle">Sizning yozish natijalaringiz</div>
        </div>
        
        <!-- Rank Card -->
        <div class="stats-rank-card">
          <div class="rank-badge-large">
            <div class="rank-icon"></div>
            <div class="rank-name-large">${rank.name}</div>
            <div class="rank-stars-large">${'★'.repeat(rank.stars)}${'☆'.repeat(5 - rank.stars)}</div>
            <div class="rank-next-info">${rank.next ? `Keyingi daraja: ${rank.next} WPM` : 'Maksimal daraja!'}</div>
          </div>
          <div class="rank-stats">
            <div class="rank-stat-item">
              <div class="rank-stat-value">${stats.bestWpm}</div>
              <div class="rank-stat-label">Rekord WPM</div>
            </div>
            <div class="rank-stat-item">
              <div class="rank-stat-value">${stats.avgWpm}</div>
              <div class="rank-stat-label">O'rtacha WPM</div>
            </div>
            <div class="rank-stat-item">
              <div class="rank-stat-value">${stats.total}</div>
              <div class="rank-stat-label">Testlar</div>
            </div>
          </div>
        </div>
        
        <!-- Summary Grid -->
        <div class="stats-summary-grid">
          <div class="stats-summary-card">
            <div class="summary-icon"></div>
            <div class="summary-value">${stats.bestWpm}</div>
            <div class="summary-label">Eng yuqori WPM</div>
            <div class="summary-trend ${this.getTrend(stats.bestWpm, 'wpm')}"></div>
          </div>
          <div class="stats-summary-card">
            <div class="summary-icon"></div>
            <div class="summary-value">${stats.avgAcc}%</div>
            <div class="summary-label">O'rtacha aniqlik</div>
          </div>
          <div class="stats-summary-card">
            <div class="summary-icon"></div>
            <div class="summary-value">${stats.peakWpm}</div>
            <div class="summary-label">Eng yuqori tezlik</div>
          </div>
          <div class="stats-summary-card">
            <div class="summary-icon"></div>
            <div class="summary-value">${stats.bestRaw}</div>
            <div class="summary-label">Raw WPM</div>
          </div>
          <div class="stats-summary-card">
            <div class="summary-icon"></div>
            <div class="summary-value">${Math.floor(stats.totalTime / 60)}m ${stats.totalTime % 60}s</div>
            <div class="summary-label">Jami vaqt</div>
          </div>
          <div class="stats-summary-card">
            <div class="summary-icon"></div>
            <div class="summary-value">${stats.totalWords}</div>
            <div class="summary-label">Yozilgan sozlar</div>
          </div>
        </div>
        
        <!-- Charts Section -->
        <div class="stats-charts-section">
          <div class="chart-container">
            <div class="chart-header">
              <div class="chart-title">WPM Progression</div>
              <div class="chart-subtitle">So'nggi 30 test</div>
            </div>
            <canvas id="progressionChart" class="stat-canvas"></canvas>
          </div>
          
          <div class="chart-container">
            <div class="chart-header">
              <div class="chart-title">Weekly Average</div>
              <div class="chart-subtitle">Oxirgi 7 kun</div>
            </div>
            <canvas id="weeklyChart" class="stat-canvas"></canvas>
          </div>
          
          <div class="chart-container">
            <div class="chart-header">
              <div class="chart-title">WPM Distribution</div>
              <div class="chart-subtitle">Natijalar taqsimoti</div>
            </div>
            <canvas id="distributionChart" class="stat-canvas"></canvas>
          </div>
          
          <div class="chart-container">
            <div class="chart-header">
              <div class="chart-title">Accuracy Trend</div>
              <div class="chart-subtitle">Aniqlik o'zgarishi</div>
            </div>
            <canvas id="accuracyChart" class="stat-canvas"></canvas>
          </div>
        </div>
        
        <!-- Recent Tests Table -->
        <div class="stats-table-container">
          <div class="table-header">
            <div class="table-title">So'nggi testlar</div>
          </div>
          <div class="table-wrapper">
            <table class="stats-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>WPM</th>
                  <th>Raw</th>
                  <th>Aniqlik</th>
                  <th>Sozlar</th>
                  <th>Vaqt</th>
                  <th>Tur</th>
                  <th>Sana</th>
                 </tr>
              </thead>
              <tbody>
                ${this.history.slice(0, 50).map((h, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td class="wpm-cell">${h.wpm}</td>
                    <td class="raw-cell">${h.raw || h.wpm}</td>
                    <td class="acc-cell">${h.acc}%</td>
                    <td>${h.words}</td>
                    <td>${h.time}s</td>
                    <td class="mode-cell">${h.mode || 'time'}</td>
                    <td class="date-cell">${new Date(h.date).toLocaleDateString('uz-UZ')}</td>
                  </tr>
                `).join('')}
                ${this.history.length === 0 ? '<tr><td colspan="8" class="empty-cell">Hali natijalar yoq</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    this.drawCharts(progressionData, weeklyData, distributionData, progressionData);
  }

  drawCharts(progressionData, weeklyData, distributionData, accuracyData) {
    this.drawProgressionChart(progressionData);
    this.drawWeeklyChart(weeklyData);
    this.drawDistributionChart(distributionData);
    this.drawAccuracyChart(accuracyData);
  }

  drawProgressionChart(data) {
    const canvas = document.getElementById('progressionChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.clientWidth - 40;
    const height = 280;
    
    canvas.width = width;
    canvas.height = height;
    
    ctx.clearRect(0, 0, width, height);
    
    if (data.length === 0) {
      ctx.fillStyle = '#4a4a60';
      ctx.font = '12px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('Ma\'lumot yoq', width / 2, height / 2);
      return;
    }
    
    const values = data.map(d => d.wpm);
    const maxWpm = Math.max(...values, 50);
    const minWpm = Math.min(...values, 0);
    const range = maxWpm - minWpm || 1;
    
    const padding = { left: 40, right: 20, top: 20, bottom: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Draw grid lines
    ctx.beginPath();
    ctx.strokeStyle = '#20202a';
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight * i / 4);
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      
      const wpmValue = Math.round(maxWpm - (range * i / 4));
      ctx.fillStyle = '#4a4a60';
      ctx.font = '10px "JetBrains Mono"';
      ctx.textAlign = 'right';
      ctx.fillText(wpmValue, padding.left - 5, y + 3);
    }
    
    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = '#e2b714';
    ctx.lineWidth = 2.5;
    
    data.forEach((point, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((point.wpm - minWpm) / range) * chartHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // Draw gradient under line
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(226, 183, 20, 0.2)');
    gradient.addColorStop(1, 'rgba(226, 183, 20, 0)');
    
    ctx.beginPath();
    data.forEach((point, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((point.wpm - minWpm) / range) * chartHeight;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.lineTo(padding.left + chartWidth, height - padding.bottom);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw points
    data.forEach((point, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((point.wpm - minWpm) / range) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#e2b714';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0c';
      ctx.fill();
    });
    
    // X-axis labels
    ctx.fillStyle = '#4a4a60';
    ctx.font = '10px "JetBrains Mono"';
    ctx.textAlign = 'center';
    
    const step = Math.ceil(data.length / 6);
    for (let i = 0; i < data.length; i += step) {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      ctx.fillText(data[i].test, x, height - padding.bottom + 15);
    }
  }

  drawWeeklyChart(data) {
    const canvas = document.getElementById('weeklyChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.clientWidth - 40;
    const height = 280;
    
    canvas.width = width;
    canvas.height = height;
    
    ctx.clearRect(0, 0, width, height);
    
    if (data.length === 0 || data.every(d => d.wpm === 0)) {
      ctx.fillStyle = '#4a4a60';
      ctx.font = '12px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('Ma\'lumot yoq', width / 2, height / 2);
      return;
    }
    
    const maxWpm = Math.max(...data.map(d => d.wpm), 50);
    
    const barWidth = (width - 60) / data.length - 8;
    const startX = 40;
    
    data.forEach((item, i) => {
      const barHeight = (item.wpm / maxWpm) * (height - 70);
      const x = startX + i * (barWidth + 8);
      const y = height - 30 - barHeight;
      
      // Draw bar
      ctx.fillStyle = item.wpm > 0 ? '#e2b714' : '#20202a';
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Draw value on top
      if (item.wpm > 0) {
        ctx.fillStyle = '#d0d0ea';
        ctx.font = '10px "JetBrains Mono"';
        ctx.textAlign = 'center';
        ctx.fillText(item.wpm, x + barWidth / 2, y - 5);
      }
      
      // Draw day label
      ctx.fillStyle = '#4a4a60';
      ctx.font = '9px "JetBrains Mono"';
      ctx.fillText(item.day, x + barWidth / 2, height - 10);
    });
  }

  drawDistributionChart(data) {
    const canvas = document.getElementById('distributionChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.clientWidth - 40;
    const height = 280;
    
    canvas.width = width;
    canvas.height = height;
    
    ctx.clearRect(0, 0, width, height);
    
    const total = data.reduce((a, b) => a + b.count, 0);
    if (total === 0) {
      ctx.fillStyle = '#4a4a60';
      ctx.font = '12px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('Ma\'lumot yoq', width / 2, height / 2);
      return;
    }
    
    const maxCount = Math.max(...data.map(d => d.count), 1);
    const barWidth = (width - 60) / data.length - 6;
    const startX = 40;
    
    const colors = ['#e2b714', '#f0c830', '#d0a010', '#4ec9a0', '#7eb8f7', '#f06a6a', '#b89ef7', '#88c0d0'];
    
    data.forEach((item, i) => {
      const barHeight = (item.count / maxCount) * (height - 70);
      const x = startX + i * (barWidth + 6);
      const y = height - 30 - barHeight;
      
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Draw label
      ctx.fillStyle = '#4a4a60';
      ctx.font = '8px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, x + barWidth / 2, height - 10);
      
      // Draw count
      if (item.count > 0) {
        ctx.fillStyle = '#d0d0ea';
        ctx.font = '9px "JetBrains Mono"';
        ctx.fillText(item.count, x + barWidth / 2, y - 5);
      }
    });
  }

  drawAccuracyChart(data) {
    const canvas = document.getElementById('accuracyChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.clientWidth - 40;
    const height = 280;
    
    canvas.width = width;
    canvas.height = height;
    
    ctx.clearRect(0, 0, width, height);
    
    if (data.length === 0) {
      ctx.fillStyle = '#4a4a60';
      ctx.font = '12px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('Ma\'lumot yoq', width / 2, height / 2);
      return;
    }
    
    const values = data.map(d => d.acc);
    const maxAcc = 100;
    const minAcc = Math.min(...values, 80);
    
    const padding = { left: 40, right: 20, top: 20, bottom: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Draw grid lines
    ctx.beginPath();
    ctx.strokeStyle = '#20202a';
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight * i / 4);
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      
      const accValue = Math.round(maxAcc - (20 * i));
      ctx.fillStyle = '#4a4a60';
      ctx.font = '10px "JetBrains Mono"';
      ctx.textAlign = 'right';
      ctx.fillText(accValue + '%', padding.left - 5, y + 3);
    }
    
    // Draw area
    ctx.beginPath();
    data.forEach((point, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((point.acc - minAcc) / (maxAcc - minAcc)) * chartHeight;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.lineTo(padding.left + chartWidth, height - padding.bottom);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.fillStyle = 'rgba(78, 201, 160, 0.15)';
    ctx.fill();
    
    // Draw line
    ctx.beginPath();
    data.forEach((point, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((point.acc - minAcc) / (maxAcc - minAcc)) * chartHeight;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = '#4ec9a0';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // X-axis labels
    ctx.fillStyle = '#4a4a60';
    ctx.font = '10px "JetBrains Mono"';
    ctx.textAlign = 'center';
    
    const step = Math.ceil(data.length / 6);
    for (let i = 0; i < data.length; i += step) {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      ctx.fillText(data[i].test, x, height - padding.bottom + 15);
    }
  }

  getRank(wpm) {
    const ranks = [
      { name: 'Boshlangich', min: 0, stars: 1, next: 20 },
      { name: 'Organuvchi', min: 20, stars: 2, next: 40 },
      { name: 'Ortacha', min: 40, stars: 2, next: 60 },
      { name: 'Mohir', min: 60, stars: 3, next: 80 },
      { name: 'Ustoz', min: 80, stars: 4, next: 100 },
      { name: 'Ekspert', min: 100, stars: 4, next: 120 },
      { name: 'Master', min: 120, stars: 5, next: 150 },
      { name: 'Legend', min: 150, stars: 5, next: null }
    ];
    
    for (let i = ranks.length - 1; i >= 0; i--) {
      if (wpm >= ranks[i].min) return ranks[i];
    }
    return ranks[0];
  }

  getTrend(value, type) {
    if (this.history.length < 2) return '';
    const prevBest = Math.max(...this.history.slice(1).map(h => h[type === 'wpm' ? 'wpm' : 'acc']));
    if (value > prevBest) return 'trend-up';
    if (value < prevBest) return 'trend-down';
    return 'trend-steady';
  }

  exportData() {
    const data = {
      exportedAt: new Date().toISOString(),
      history: this.history,
      stats: this.getStats()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mrtype_stats_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Initialize global statistics instance
window.mrStatistics = new Statistics();
