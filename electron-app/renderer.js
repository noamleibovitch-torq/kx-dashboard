// Renderer process - UI logic and data management
class DashboardApp {
  constructor() {
    this.api = new DashboardAPI();
    this.data = null;
    this.daysBack = this.loadDaysBack();
    this.refreshTimer = null;
    this.trendChart = null;
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.updateDaysBackDisplay();
    this.load();
    this.startAutoRefresh();
  }

  // Persistence
  loadDaysBack() {
    const saved = localStorage.getItem('daysBack');
    return saved ? parseInt(saved, 10) : 7;
  }

  saveDaysBack() {
    localStorage.setItem('daysBack', this.daysBack);
  }

  // Event Listeners
  setupEventListeners() {
    document.getElementById('incrementDays').addEventListener('click', () => {
      if (this.daysBack < 30) {
        this.daysBack++;
        this.saveDaysBack();
        this.updateDaysBackDisplay();
        this.load();
      }
    });

    document.getElementById('decrementDays').addEventListener('click', () => {
      if (this.daysBack > 1) {
        this.daysBack--;
        this.saveDaysBack();
        this.updateDaysBackDisplay();
        this.load();
      }
    });
  }

  updateDaysBackDisplay() {
    document.getElementById('daysBackValue').textContent = this.daysBack;
    document.getElementById('incrementDays').disabled = this.daysBack >= 30;
    document.getElementById('decrementDays').disabled = this.daysBack <= 1;
  }

  // Data Loading
  async load() {
    try {
      this.showLoading(this.data === null);
      this.hideError();

      const result = await this.api.fetchDashboard(this.daysBack);
      this.data = result;
      this.render();
      this.updateLastUpdated();
    } catch (error) {
      console.error('Load error:', error);
      this.showError(error.message || 'Failed to load data. Will retry in 60 minutes.');
    } finally {
      this.hideLoading();
    }
  }

  // Auto-refresh
  startAutoRefresh() {
    // Refresh every hour (3600000 ms)
    this.refreshTimer = setInterval(() => {
      this.load();
    }, 3600000);
  }

  // UI State
  showLoading(fullScreen = false) {
    if (fullScreen) {
      document.getElementById('loadingOverlay').classList.add('visible');
    }
  }

  hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('visible');
  }

  showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorBanner').classList.add('visible');
  }

  hideError() {
    document.getElementById('errorBanner').classList.remove('visible');
  }

  updateLastUpdated() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    document.getElementById('lastUpdated').textContent = `Updated: ${timeString}`;
  }

  // Rendering
  render() {
    if (!this.data) return;

    this.renderKPIs();
    this.renderEnrollments();
    this.renderSegments();
    this.renderLabs();
  }

  renderKPIs() {
    const { enrollments, labs } = this.data;
    const kpis = [
      {
        label: 'Total Enrollments',
        value: enrollments.current.total_enrollments,
        delta: enrollments.delta.total_enrollments
      },
      {
        label: 'Unique Users',
        value: enrollments.current.unique_users,
        delta: enrollments.delta.unique_users
      },
      {
        label: 'Completed Passed',
        value: enrollments.current.completed_passed,
        delta: enrollments.delta.completed_passed
      },
      {
        label: 'In Progress',
        value: enrollments.current.in_progress,
        delta: enrollments.delta.in_progress
      },
      {
        label: 'Labs Running',
        value: labs.current.labs_running_now,
        delta: null
      },
      {
        label: 'Total Attempts',
        value: labs.current.total_attempts,
        delta: labs.delta.total_attempts
      },
      {
        label: 'Passed Checks',
        value: labs.current.passed_checks_percent,
        delta: labs.delta.passed_checks_percent,
        suffix: '%'
      },
      {
        label: 'Failed Checks',
        value: labs.current.failed_checks_percent,
        delta: null,
        suffix: '%'
      }
    ];

    const html = kpis.map(kpi => this.createKPICard(kpi)).join('');
    document.getElementById('kpiGrid').innerHTML = html;
  }

  createKPICard({ label, value, delta, suffix = '' }) {
    const deltaHTML = delta ? `
      <div class="kpi-delta ${delta.abs >= 0 ? 'positive' : 'negative'}">
        <span>${delta.abs >= 0 ? '▲' : '▼'}</span>
        <span>${delta.percent !== null ? Math.abs(delta.percent) + '%' : Math.abs(delta.abs)}</span>
      </div>
    ` : '<div style="height: 24px;"></div>';

    return `
      <div class="kpi-card">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value">
          ${value}${suffix ? `<span class="suffix">${suffix}</span>` : ''}
        </div>
        ${deltaHTML}
      </div>
    `;
  }

  renderEnrollments() {
    const { enrollments } = this.data;
    
    // Comparison
    const currentMetrics = [
      { label: 'Total', value: enrollments.current.total_enrollments },
      { label: 'Unique Users', value: enrollments.current.unique_users },
      { label: 'Completed', value: enrollments.current.completed_passed },
      { label: 'In Progress', value: enrollments.current.in_progress },
      { label: 'Not Started', value: enrollments.current.not_started }
    ];

    const previousMetrics = [
      { label: 'Total', value: enrollments.previous.total_enrollments },
      { label: 'Unique Users', value: enrollments.previous.unique_users },
      { label: 'Completed', value: enrollments.previous.completed_passed },
      { label: 'In Progress', value: enrollments.previous.in_progress },
      { label: 'Not Started', value: enrollments.previous.not_started }
    ];

    const comparisonHTML = `
      <div class="comparison-column">
        <div class="comparison-header current">Current (${enrollments.window.days_back}d)</div>
        ${currentMetrics.map(m => `
          <div class="metric-row">
            <span class="metric-label">${m.label}</span>
            <span class="metric-value">${m.value}</span>
          </div>
        `).join('')}
      </div>
      <div class="comparison-column">
        <div class="comparison-header previous">Previous (${enrollments.window.days_back}d)</div>
        ${previousMetrics.map(m => `
          <div class="metric-row">
            <span class="metric-label">${m.label}</span>
            <span class="metric-value">${m.value}</span>
          </div>
        `).join('')}
      </div>
    `;
    document.getElementById('enrollmentComparison').innerHTML = comparisonHTML;

    // Top Guides
    const maxCount = Math.max(...enrollments.guides.top.map(g => g.count), enrollments.guides.others.count);
    const guidesHTML = [
      ...enrollments.guides.top.map(guide => this.createGuideBar(guide, maxCount)),
      this.createGuideBar({ title: 'Others', count: enrollments.guides.others.count, percent: enrollments.guides.others.percent }, maxCount, true)
    ].join('');
    document.getElementById('guidesChart').innerHTML = guidesHTML;
  }

  createGuideBar(guide, maxCount, isOthers = false) {
    const width = (guide.count / maxCount) * 100;
    return `
      <div class="guide-item">
        <div class="guide-header">
          <span class="guide-title">${guide.title}</span>
          <span class="guide-stats">
            <span class="count">${guide.count}</span> (${guide.percent}%)
          </span>
        </div>
        <div class="guide-bar-container">
          <div class="guide-bar ${isOthers ? 'others' : ''}" style="width: ${width}%"></div>
        </div>
      </div>
    `;
  }

  renderSegments() {
    const { segments } = this.data.enrollments;
    
    const currentHTML = segments.current.map(seg => this.createSegmentItem(seg)).join('');
    const previousHTML = segments.previous.map(seg => this.createSegmentItem(seg)).join('');
    
    document.getElementById('segmentsCurrent').innerHTML = currentHTML;
    document.getElementById('segmentsPrevious').innerHTML = previousHTML;
  }

  createSegmentItem(segment) {
    const isTorq = segment.segment.toLowerCase().includes('torq');
    const color = isTorq ? '#00FF88' : '#999999';
    
    return `
      <div class="segment-item">
        <div class="segment-header">
          <div class="segment-name">
            <div class="segment-dot ${isTorq ? 'torq' : 'other'}"></div>
            <span>${segment.segment}</span>
          </div>
          <div class="segment-stats">
            <span class="segment-count">${segment.count}</span>
            <span class="segment-percent">(${segment.percent}%)</span>
          </div>
        </div>
        <div class="segment-bar-container">
          <div class="segment-bar" style="width: ${segment.percent}%; background: ${color};"></div>
        </div>
      </div>
    `;
  }

  renderLabs() {
    const { labs } = this.data;
    
    // Today's metrics
    const metrics = [
      { label: 'Labs Running Now', value: labs.today.labs_running_now, color: 'cyan' },
      { label: 'Created Labs', value: labs.today.created_labs, color: '' },
      { label: 'Resolved Labs', value: labs.today.resolved_labs, color: '' },
      { label: 'Total Attempts', value: labs.today.total_attempts, color: '' },
      { label: 'Passed Checks', value: `${labs.today.passed_checks_percent}%`, color: 'green' },
      { label: 'Failed Checks', value: `${labs.today.failed_checks_percent}%`, color: 'pink' },
      { label: 'Avg Resolve Time', value: `${labs.today.avg_resolve_hours.toFixed(1)}h`, color: 'pink' }
    ];

    const metricsHTML = metrics.map((m, i) => {
      const divider = (i === 3 || i === 5) ? '<div class="divider"></div>' : '';
      return `
        ${divider}
        <div class="lab-metric">
          <span class="lab-metric-label">${m.label}</span>
          <span class="lab-metric-value ${m.color}">${m.value}</span>
        </div>
      `;
    }).join('');
    document.getElementById('labsMetrics').innerHTML = metricsHTML;

    // Trend chart
    this.renderTrendChart(labs.trend);
    
    // Trend table
    if (labs.trend.length > 0 && labs.trend.length <= 10) {
      const tableHTML = `
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Running</th>
              <th>Attempts</th>
              <th>Passed</th>
              <th>Failed</th>
            </tr>
          </thead>
          <tbody>
            ${labs.trend.map(point => `
              <tr>
                <td>${this.formatTime(point.time)}</td>
                <td>${point.labs_running}</td>
                <td>${point.total_attempts}</td>
                <td class="green">${point.passed_checks}</td>
                <td class="pink">${point.failed_checks}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      document.getElementById('trendTable').innerHTML = tableHTML;
    }
  }

  renderTrendChart(trendData) {
    const ctx = document.getElementById('trendChart');
    
    // Destroy existing chart
    if (this.trendChart) {
      this.trendChart.destroy();
    }

    if (!trendData || trendData.length === 0) {
      ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
      return;
    }

    this.trendChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: trendData.map(point => this.formatTime(point.time)),
        datasets: [{
          label: 'Total Attempts',
          data: trendData.map(point => point.total_attempts),
          backgroundColor: '#00D9FF',
          borderColor: '#00D9FF',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#999999',
              font: { size: 12 }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { 
              color: '#999999',
              font: { size: 11 }
            },
            grid: { 
              color: 'rgba(255, 255, 255, 0.1)',
              drawBorder: false
            }
          },
          x: {
            ticks: { 
              color: '#999999',
              font: { size: 10 },
              maxRotation: 45,
              minRotation: 45
            },
            grid: { 
              display: false
            }
          }
        }
      }
    });
  }

  formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new DashboardApp();
});

