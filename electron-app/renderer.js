// Renderer process - UI logic and data management
class DashboardApp {
  constructor() {
    this.api = new DashboardAPI();
    this.data = null;
    this.daysBack = this.loadDaysBack();
    this.refreshTimer = null;
    this.trendChart = null;
    this.segmentsPieChart = null;
    this.enrollmentTrendChart = null;
    
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
        sublabel: `Last ${enrollments.window.days_back} days`,
        value: enrollments.current.total_enrollments,
        previousValue: enrollments.previous.total_enrollments,
        delta: enrollments.delta.total_enrollments
      },
      {
        label: 'Unique Users',
        sublabel: `Last ${enrollments.window.days_back} days`,
        value: enrollments.current.unique_users,
        previousValue: enrollments.previous.unique_users,
        delta: enrollments.delta.unique_users
      },
      {
        label: 'Completed Passed',
        sublabel: `Last ${enrollments.window.days_back} days`,
        value: enrollments.current.completed_passed,
        previousValue: enrollments.previous.completed_passed,
        delta: enrollments.delta.completed_passed
      },
      {
        label: 'In Progress',
        sublabel: `Last ${enrollments.window.days_back} days`,
        value: enrollments.current.in_progress,
        previousValue: enrollments.previous.in_progress,
        delta: enrollments.delta.in_progress
      },
      {
        label: 'Labs Running Now',
        sublabel: 'Current',
        value: labs.today.labs_running_now,
        previousValue: null,
        delta: null
      },
      {
        label: 'Total Attempts',
        sublabel: 'Today',
        value: labs.today.total_attempts,
        previousValue: labs.previous.total_attempts,
        delta: labs.delta.total_attempts
      },
      {
        label: 'Passed Checks',
        sublabel: 'Today',
        value: labs.today.passed_checks_percent,
        previousValue: labs.previous.passed_checks_percent,
        delta: labs.delta.passed_checks_percent,
        suffix: '%'
      },
      {
        label: 'Failed Checks',
        sublabel: 'Today',
        value: labs.today.failed_checks_percent,
        previousValue: null,
        delta: null,
        suffix: '%'
      }
    ];

    const html = kpis.map(kpi => this.createKPICard(kpi)).join('');
    document.getElementById('kpiGrid').innerHTML = html;
  }

  createKPICard({ label, sublabel, value, previousValue, delta, suffix = '' }) {
    const deltaHTML = delta ? `
      <div class="kpi-delta ${delta.abs >= 0 ? 'positive' : 'negative'}">
        <span>${delta.abs >= 0 ? '▲' : '▼'}</span>
        <span>${Math.abs(delta.abs)}${suffix}</span>
        ${previousValue !== null ? `<span class="previous-value">(prev: ${previousValue}${suffix})</span>` : ''}
      </div>
    ` : '<div style="height: 24px;"></div>';

    return `
      <div class="kpi-card">
        <div class="kpi-label">${label}</div>
        <div class="kpi-sublabel">${sublabel}</div>
        <div class="kpi-value">
          ${value}${suffix ? `<span class="suffix">${suffix}</span>` : ''}
        </div>
        ${deltaHTML}
      </div>
    `;
  }

  renderEnrollments() {
    const { enrollments } = this.data;
    
    // Top Guides
    const maxCount = Math.max(...enrollments.guides.top.map(g => g.count), enrollments.guides.others.count);
    const guidesHTML = [
      ...enrollments.guides.top.map(guide => this.createGuideBar(guide, maxCount)),
      this.createGuideBar({ title: 'Others', count: enrollments.guides.others.count, percent: enrollments.guides.others.percent }, maxCount, true)
    ].join('');
    document.getElementById('guidesChart').innerHTML = guidesHTML;
    
    // Enrollment trend chart - using mock daily data based on current/previous
    this.renderEnrollmentTrendChart(enrollments);
  }

  renderEnrollmentTrendChart(enrollments) {
    const ctx = document.getElementById('enrollmentTrendChart');
    
    // Destroy existing chart
    if (this.enrollmentTrendChart) {
      this.enrollmentTrendChart.destroy();
    }

    // Generate daily data for the period
    const daysBack = enrollments.window.days_back;
    const dailyData = [];
    
    // Create daily breakdown (estimate based on current totals)
    const currentStart = new Date(enrollments.window.current.start_iso);
    const currentEnd = new Date(enrollments.window.current.end_iso);
    const daysDiff = Math.max(1, Math.ceil((currentEnd - currentStart) / (1000 * 60 * 60 * 24)));
    
    // Distribute enrollments across days
    const dailyCompleted = Math.floor(enrollments.current.completed_passed / daysDiff);
    const dailyInProgress = Math.floor(enrollments.current.in_progress / daysDiff);
    const dailyNotStarted = Math.floor(enrollments.current.not_started / daysDiff);
    
    for (let i = 0; i < daysDiff; i++) {
      const date = new Date(currentStart);
      date.setDate(date.getDate() + i);
      dailyData.push({
        date: date.toISOString().split('T')[0],
        completed_passed: dailyCompleted,
        in_progress: dailyInProgress,
        not_started: dailyNotStarted
      });
    }

    this.enrollmentTrendChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dailyData.map(point => this.formatDate(point.date)),
        datasets: [
          {
            label: 'Completed',
            data: dailyData.map(point => point.completed_passed),
            backgroundColor: '#00FF88',
            borderColor: '#00FF88',
            borderWidth: 1
          },
          {
            label: 'In Progress',
            data: dailyData.map(point => point.in_progress),
            backgroundColor: '#00D9FF',
            borderColor: '#00D9FF',
            borderWidth: 1
          },
          {
            label: 'Not Started',
            data: dailyData.map(point => point.not_started),
            backgroundColor: '#999999',
            borderColor: '#999999',
            borderWidth: 1
          }
        ]
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
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              footer: function(tooltipItems) {
                let total = 0;
                tooltipItems.forEach(function(tooltipItem) {
                  total += tooltipItem.parsed.y;
                });
                return 'Total: ' + total;
              }
            }
          }
        },
        scales: {
          y: {
            stacked: true,
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
            stacked: true,
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
    
    // Render pie chart for current segments
    this.renderSegmentsPieChart(segments.current);
    
    // Render legend
    const legendHTML = segments.current.map(seg => {
      const isTorq = seg.segment.toLowerCase().includes('torq');
      const color = isTorq ? '#00FF88' : '#999999';
      return `
        <div class="segment-legend-item">
          <div class="segment-legend-dot" style="background: ${color};"></div>
          <div class="segment-legend-label">${seg.segment}</div>
          <div class="segment-legend-value">${seg.count} (${seg.percent}%)</div>
        </div>
      `;
    }).join('');
    
    document.getElementById('segmentsLegend').innerHTML = legendHTML;
  }

  renderSegmentsPieChart(segments) {
    const ctx = document.getElementById('segmentsPieChart');
    
    // Destroy existing chart
    if (this.segmentsPieChart) {
      this.segmentsPieChart.destroy();
    }

    const labels = segments.map(s => s.segment);
    const data = segments.map(s => s.percent);
    const colors = segments.map(s => 
      s.segment.toLowerCase().includes('torq') ? '#00FF88' : '#999999'
    );

    this.segmentsPieChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderColor: '#0D0D0D',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.label + ': ' + context.parsed + '%';
              }
            }
          }
        }
      }
    });
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

  aggregateTrendByDay(trendData) {
    // Group trend data by day
    const dailyData = {};
    
    trendData.forEach(point => {
      const date = new Date(point.time);
      const dateKey = date.toISOString().split('T')[0]; // Get YYYY-MM-DD
      
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date: dateKey,
          passed_checks: 0,
          failed_checks: 0,
          total_attempts: 0,
          labs_running: point.labs_running,
          created_labs: 0,
          resolved_labs: 0
        };
      }
      
      dailyData[dateKey].passed_checks += point.passed_checks;
      dailyData[dateKey].failed_checks += point.failed_checks;
      dailyData[dateKey].total_attempts += point.total_attempts;
      dailyData[dateKey].created_labs += point.created_labs;
      dailyData[dateKey].resolved_labs += point.resolved_labs;
    });
    
    // Convert to array and sort by date
    return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
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

    // Aggregate by day
    const dailyData = this.aggregateTrendByDay(trendData);

    this.trendChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dailyData.map(point => this.formatDate(point.date)),
        datasets: [
          {
            label: 'Passed Checks',
            data: dailyData.map(point => point.passed_checks),
            backgroundColor: '#00FF88',
            borderColor: '#00FF88',
            borderWidth: 1
          },
          {
            label: 'Failed Checks',
            data: dailyData.map(point => point.failed_checks),
            backgroundColor: '#FF006E',
            borderColor: '#FF006E',
            borderWidth: 1
          }
        ]
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
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              footer: function(tooltipItems) {
                let total = 0;
                tooltipItems.forEach(function(tooltipItem) {
                  total += tooltipItem.parsed.y;
                });
                return 'Total: ' + total;
              }
            }
          }
        },
        scales: {
          y: {
            stacked: true,
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
            stacked: true,
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

  formatDate(dateString) {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
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

