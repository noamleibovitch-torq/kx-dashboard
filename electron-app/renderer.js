// Renderer process - UI logic and data management
class DashboardApp {
  constructor() {
    this.api = new DashboardAPI();
    this.data = null;
    this.documentationData = null;
    this.currentView = this.loadView();
    this.selectedPeriod = this.loadPeriod();
    this.daysBack = this.calculateDaysBack(this.selectedPeriod);
    this.docPeriod = this.loadDocPeriod(); // 'mtd' or 'prev'
    this.refreshTimer = null;
    this.trendChart = null;
    this.segmentsPieChart = null;
    this.enrollmentTrendChart = null;
    this.docTrendChart = null;
    this.docEngagementChart = null;
    this.selectedSegment = null;
    
    // Color palette for segments
    this.segmentColors = [
      '#00FF88', // Bright green
      '#00D9FF', // Cyan
      '#FF6B6B', // Coral red
      '#FFD93D', // Yellow
      '#A259FF', // Purple
      '#FF9CEE', // Pink
      '#6BCF7F', // Light green
      '#FF8C42', // Orange
      '#4ECDC4', // Turquoise
      '#95E1D3', // Mint
      '#F38181', // Salmon
      '#AA96DA', // Lavender
      '#FCBAD3', // Light pink
      '#FFFFD2', // Light yellow
      '#A8D8EA', // Light blue
      '#999999'  // Gray for others
    ];
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.updatePeriodDisplay();
    this.updateDocPeriodDisplay();
    this.updateViewDisplay();
    this.load();
    this.startAutoRefresh();
  }

  // Persistence
  loadView() {
    const saved = localStorage.getItem('currentView');
    return saved || 'academy';
  }

  saveView() {
    localStorage.setItem('currentView', this.currentView);
  }

  loadPeriod() {
    const saved = localStorage.getItem('selectedPeriod');
    return saved || '7';
  }

  savePeriod() {
    localStorage.setItem('selectedPeriod', this.selectedPeriod);
  }

  loadDocPeriod() {
    const saved = localStorage.getItem('docPeriod');
    return saved || 'mtd'; // Default to Month to Date
  }

  saveDocPeriod() {
    localStorage.setItem('docPeriod', this.docPeriod);
  }

  calculateDaysBack(period) {
    if (period === '7') return 7;
    if (period === '30') return 30;
    if (period === 'Q') {
      // Quarter = 90 days (approximately 3 months)
      return 90;
    }
    if (period === 'YTD') {
      // Year to Date - calculate days from Jan 1 to today
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const diffTime = Math.abs(now - startOfYear);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    }
    return 7; // default
  }

  // Event Listeners
  setupEventListeners() {
    // View switcher buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        console.log('View changed to:', view);
        
        this.currentView = view;
        this.saveView();
        this.updateViewDisplay();
        
        // Just render the view, data is already loaded
        this.render();
      });
    });

    // Period selector buttons (Academy)
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const period = btn.dataset.period;
        console.log('Period changed to:', period);
        
        this.selectedPeriod = period;
        this.daysBack = this.calculateDaysBack(period);
        console.log('Days back calculated:', this.daysBack);
        
        this.savePeriod();
        this.updatePeriodDisplay();
        
        // Refresh data from webhook
        console.log('Triggering data refresh...');
        this.load();
      });
    });

    // Documentation period selector buttons
    document.querySelectorAll('.doc-period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const docPeriod = btn.dataset.docPeriod;
        console.log('Documentation period changed to:', docPeriod);
        
        this.docPeriod = docPeriod;
        this.saveDocPeriod();
        this.updateDocPeriodDisplay();
        
        // Refresh data from webhook
        console.log('Triggering documentation data refresh...');
        this.load();
      });
    });

    document.getElementById('clearFilter').addEventListener('click', () => {
      this.setSegmentFilter(null);
    });

    // Keyboard shortcut to clear cache: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        console.log('🔄 Force refresh (keyboard): clearing cache and reloading data');
        this.api.invalidateCache();
        this.load();
      }
    });
  }

  updatePeriodDisplay() {
    // Update active button
    document.querySelectorAll('.period-btn').forEach(btn => {
      if (btn.dataset.period === this.selectedPeriod) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  updateDocPeriodDisplay() {
    // Update active documentation period button
    document.querySelectorAll('.doc-period-btn').forEach(btn => {
      if (btn.dataset.docPeriod === this.docPeriod) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  updateViewDisplay() {
    // Update active view button
    document.querySelectorAll('.view-btn').forEach(btn => {
      if (btn.dataset.view === this.currentView) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Show/hide view content
    document.getElementById('academyView').classList.toggle('active', this.currentView === 'academy');
    document.getElementById('documentationView').classList.toggle('active', this.currentView === 'documentation');

    // Show/hide appropriate period controls in header
    const academyControls = document.getElementById('academyControls');
    const docControls = document.getElementById('docControls');
    
    if (this.currentView === 'academy') {
      academyControls.style.display = 'flex';
      docControls.style.display = 'none';
    } else if (this.currentView === 'documentation') {
      academyControls.style.display = 'none';
      docControls.style.display = 'flex';
    }

    // Show/hide segment filter (only for academy view)
    const segmentFilter = document.getElementById('segmentFilter');
    if (this.currentView === 'academy' && this.selectedSegment) {
      segmentFilter.style.display = 'flex';
    } else {
      segmentFilter.style.display = 'none';
    }
  }

  // Data Loading
  async load() {
    try {
      // Always show loading indicator
      this.showLoading(true);
      this.hideError();

      console.log('Fetching all dashboard data for', this.daysBack, 'days and doc period:', this.docPeriod);
      
      // Single API call that returns both academy and documentation data
      const result = await this.api.fetchDashboard(this.daysBack, this.docPeriod);
      console.log('Dashboard data received:', result);
      
      // Split the combined response
      this.data = result; // Contains enrollments and labs
      this.documentationData = result; // Contains documentation
      
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
    
    // Get cache stats
    const stats = this.api.getCacheStats();
    const cacheInfo = stats.count > 0 
      ? ` | <span class="cache-info" id="cacheInfo" title="Click to force refresh from webhook">💾 ${stats.count} cached (${stats.totalSize}KB)</span>` 
      : '';
    
    document.getElementById('lastUpdated').innerHTML = `Updated: ${timeString}${cacheInfo}`;
    
    // Add click handler to cache info
    const cacheInfoEl = document.getElementById('cacheInfo');
    if (cacheInfoEl) {
      cacheInfoEl.onclick = () => {
        console.log('🔄 Cache info clicked - forcing refresh from webhook');
        this.api.invalidateCache();
        this.load();
      };
    }
  }

  // Data Filtering
  getFilteredData() {
    if (!this.selectedSegment || !this.data.enrollments.raw_data) {
      return this.data;
    }

    // Filter raw enrollment data by selected segment
    const rawData = this.data.enrollments.raw_data;
    const filtered = rawData.filter(e => e.primary_segment === this.selectedSegment);

    // Recalculate metrics based on filtered data
    const filteredEnrollments = {
      ...this.data.enrollments,
      current: {
        total_enrollments: filtered.length,
        unique_users: new Set(filtered.map(e => e.user_id)).size,
        completed_passed: filtered.filter(e => e.is_completed && e.pass_status === 'passed').length,
        completed_failed: filtered.filter(e => e.is_completed && e.pass_status === 'failed').length,
        in_progress: filtered.filter(e => e.pass_status === 'in_progress').length,
        not_started: filtered.filter(e => e.pass_status === 'not_started').length
      }
    };

    // Recalculate guides distribution
    const guidesCounts = {};
    filtered.forEach(e => {
      guidesCounts[e.title] = (guidesCounts[e.title] || 0) + 1;
    });
    
    const guidesArray = Object.entries(guidesCounts)
      .map(([title, count]) => ({
        title,
        count,
        percent: filtered.length > 0 ? Math.round(count * 100 / filtered.length) : 0
      }))
      .sort((a, b) => b.count - a.count);

    const topGuides = guidesArray.slice(0, 6);
    const othersCount = guidesArray.slice(6).reduce((sum, g) => sum + g.count, 0);
    const othersPercent = filtered.length > 0 ? Math.round(othersCount * 100 / filtered.length) : 0;

    filteredEnrollments.guides = {
      top: topGuides,
      others: { count: othersCount, percent: othersPercent }
    };

    // Recalculate daily trend
    const dailyData = {};
    filtered.forEach(e => {
      if (!dailyData[e.created_date]) {
        dailyData[e.created_date] = {
          total_enrollments: 0,
          completed_passed: 0,
          completed_failed: 0,
          in_progress: 0,
          not_started: 0
        };
      }
      dailyData[e.created_date].total_enrollments++;
      if (e.is_completed && e.pass_status === 'passed') dailyData[e.created_date].completed_passed++;
      if (e.is_completed && e.pass_status === 'failed') dailyData[e.created_date].completed_failed++;
      if (e.pass_status === 'in_progress') dailyData[e.created_date].in_progress++;
      if (e.pass_status === 'not_started') dailyData[e.created_date].not_started++;
    });

    filteredEnrollments.trend = Object.entries(dailyData)
      .map(([date, metrics]) => ({ date, ...metrics }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      ...this.data,
      enrollments: filteredEnrollments
    };
  }

  // Rendering
  render() {
    if (this.currentView === 'academy') {
      if (!this.data) return;

      const displayData = this.getFilteredData();

      this.renderKPIs(displayData);
      this.renderEnrollments(displayData);
      this.renderSegments(); // Always show unfiltered segments
      this.renderLabs();
    } else if (this.currentView === 'documentation') {
      this.renderDocumentation();
    }
  }

  renderKPIs(displayData = this.data) {
    const { enrollments, labs } = displayData;
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
        label: 'Today\'s Labs',
        sublabel: `Created: ${labs.today.created_labs} | Resolved: ${labs.today.resolved_labs}`,
        value: labs.today.created_labs + labs.today.resolved_labs,
        previousValue: null,
        delta: null
      },
      {
        label: 'Total Attempts',
        sublabel: `Today - Passed: ${labs.today.passed_checks_percent}% | Failed: ${labs.today.failed_checks_percent}%`,
        value: labs.today.total_attempts,
        previousValue: null,
        delta: null
      },
      {
        label: 'Avg Solve Time',
        sublabel: `Today vs ${enrollments.window.days_back}d Period`,
        value: `${labs.today.avg_resolve_hours.toFixed(1)}/${labs.current.avg_resolve_hours.toFixed(1)}`,
        previousValue: null,
        delta: null,
        suffix: 'h'
      }
    ];

    const html = kpis.map(kpi => this.createKPICard(kpi)).join('');
    document.getElementById('kpiGrid').innerHTML = html;
  }

  createKPICard({ label, sublabel, value, previousValue, delta, suffix = '' }) {
    const deltaHTML = delta ? `
      <div class="kpi-delta ${delta.abs >= 0 ? 'positive' : 'negative'}">
        <span class="previous-value">${previousValue}${suffix}</span>
        <span>${delta.abs >= 0 ? '↑' : '↓'} ${delta.abs >= 0 ? '+' : ''}${Math.abs(delta.abs)}${suffix}</span>
        ${delta.percent !== null && delta.percent !== undefined ? `<span>(${delta.percent >= 0 ? '+' : ''}${delta.percent}%)</span>` : ''}
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

  renderEnrollments(displayData = this.data) {
    const { enrollments } = displayData;
    
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

    // Use the daily trend data from the API
    const dailyData = enrollments.trend || [];

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

  getSegmentColor(index) {
    return this.segmentColors[index % this.segmentColors.length];
  }

  setSegmentFilter(segmentName) {
    if (this.selectedSegment === segmentName) {
      // Toggle off if clicking the same segment
      this.selectedSegment = null;
    } else {
      this.selectedSegment = segmentName;
    }
    this.updateFilterDisplay();
    this.render();
  }

  updateFilterDisplay() {
    const filterElement = document.getElementById('segmentFilter');
    const filterNameElement = document.getElementById('filterSegmentName');
    
    if (this.selectedSegment) {
      filterNameElement.textContent = this.selectedSegment;
      filterElement.style.display = 'flex';
    } else {
      filterElement.style.display = 'none';
    }
  }

  renderSegments() {
    const { segments } = this.data.enrollments;
    
    // Render pie chart for current segments
    this.renderSegmentsPieChart(segments.current);
    
    // Render legend
    const legendHTML = segments.current.map((seg, index) => {
      const segmentName = seg.segment || '(none)';
      const color = this.getSegmentColor(index);
      const isSelected = this.selectedSegment === segmentName;
      return `
        <div class="segment-legend-item ${isSelected ? 'selected' : ''}" data-segment="${segmentName}">
          <div class="segment-legend-dot" style="background: ${color};"></div>
          <div class="segment-legend-label">${segmentName}</div>
          <div class="segment-legend-value">${seg.count} (${seg.percent}%)</div>
        </div>
      `;
    }).join('');
    
    document.getElementById('segmentsLegend').innerHTML = legendHTML;
    
    // Add click handlers to legend items
    document.querySelectorAll('.segment-legend-item').forEach(item => {
      item.addEventListener('click', () => {
        const segmentName = item.dataset.segment;
        this.setSegmentFilter(segmentName);
      });
    });
  }

  renderSegmentsPieChart(segments) {
    const ctx = document.getElementById('segmentsPieChart');
    
    // Destroy existing chart
    if (this.segmentsPieChart) {
      this.segmentsPieChart.destroy();
    }

    const labels = segments.map(s => s.segment || '(none)');
    const data = segments.map(s => s.percent);
    const colors = segments.map((s, index) => this.getSegmentColor(index));

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
        },
        onClick: (event, activeElements) => {
          if (activeElements.length > 0) {
            const index = activeElements[0].index;
            const segmentName = labels[index];
            this.setSegmentFilter(segmentName);
          }
        }
      }
    });
  }

  renderLabs() {
    const { labs } = this.data;

    // Trend chart only - metrics are now in KPI tiles
    this.renderTrendChart(labs.trend);
  }

  renderDocumentation() {
    if (!this.documentationData || !this.documentationData.documentation) {
      console.log('No documentation data available');
      return;
    }
    
    const doc = this.documentationData.documentation;
    console.log('📊 Documentation data:', doc);
    console.log('📈 Trend data:', doc.trend);
    
    // Helper function to safely format numbers
    const formatNumber = (value, decimals = 0) => {
      
      if (value === null || value === undefined) {
        return 'N/A';
      }
      
      // Handle string division like "1597/100"
      if (typeof value === 'string' && value.includes('/')) {
        const parts = value.split('/');
        if (parts.length === 2) {
          const numerator = parseFloat(parts[0]);
          const denominator = parseFloat(parts[1]);
          if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
            return (numerator / denominator).toFixed(decimals);
          }
        }
      }
      
      // Try to parse string numbers
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          return parsed.toFixed(decimals);
        }
        return 'N/A';
      }
      
      // Handle numeric values
      if (typeof value === 'number' && !isNaN(value)) {
        return value.toFixed(decimals);
      }
      
      return 'N/A';
    };
    
    // Helper to render delta (matching Academy style)
    const renderDelta = (delta, previousValue, decimals = 0, suffix = '', inverse = false) => {
      if (!delta || delta.absolute === undefined || delta.absolute === null) return '';
      
      // Parse the absolute value if it's a string
      let absoluteValue = delta.absolute;
      
      // Handle string division like "-43/100"
      if (typeof absoluteValue === 'string' && absoluteValue.includes('/')) {
        const parts = absoluteValue.split('/');
        if (parts.length === 2) {
          const numerator = parseFloat(parts[0]);
          const denominator = parseFloat(parts[1]);
          if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
            absoluteValue = numerator / denominator;
          } else {
            return '';
          }
        }
      } else if (typeof absoluteValue === 'string') {
        absoluteValue = parseFloat(absoluteValue);
      }
      
      if (isNaN(absoluteValue)) return '';
      
      const isPositive = absoluteValue >= 0;
      const arrow = isPositive ? '↑' : '↓';
      const sign = isPositive ? '+' : '';
      
      // For inverse metrics (like tickets), lower is better so flip the color
      const colorClass = inverse 
        ? (isPositive ? 'negative' : 'positive')
        : (isPositive ? 'positive' : 'negative');
      
      // Format percent change
      let percentChange = '';
      if (delta.percent !== undefined && delta.percent !== null) {
        const percentValue = formatNumber(delta.percent, 1);
        percentChange = ` (${sign}${percentValue}%)`;
      }
      
      return `
        <div class="kpi-delta ${colorClass}">
          <span class="previous-value">${formatNumber(previousValue, decimals)}${suffix}</span>
          <span>${arrow} ${sign}${Math.abs(absoluteValue).toFixed(decimals)}${suffix}</span>
          ${percentChange ? `<span>${percentChange}</span>` : ''}
        </div>
      `;
    };

    // Update section title with period
    const periodTitle = doc.window?.month || 'Current Month';
    document.getElementById('docPeriodTitle').textContent = periodTitle;

    // Render all 6 metrics in one row (without individual sublabels)
    const allMetricsHTML = `
      <div class="kpi-card">
        <div class="kpi-label">Active users within timeframe</div>
        <div class="kpi-value">${formatNumber(doc.support?.active_users)}</div>
        ${renderDelta(doc.support_delta?.active_users, doc.support_previous?.active_users, 0, '', false)}
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Tickets Amount</div>
        <div class="kpi-value">${formatNumber(doc.support?.tickets_amount)}</div>
        ${renderDelta(doc.support_delta?.tickets_amount, doc.support_previous?.tickets_amount, 0, '', true)}
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Tickets Volume</div>
        <div class="kpi-value">${formatNumber(doc.support?.tickets_volume_percent, 2)}<span class="suffix">%</span></div>
        ${renderDelta(doc.support_delta?.tickets_volume_percent, doc.support_previous?.tickets_volume_percent, 2, '%', true)}
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Intercom Conversations</div>
        <div class="kpi-value">${formatNumber(doc.support?.total_conversations)}</div>
        ${renderDelta(doc.support_delta?.total_conversations, doc.support_previous?.total_conversations, 0, '', false)}
      </div>
      <div class="kpi-card">
        <div class="kpi-label">
          Adoption rate
          <span class="doc-kpi-info" title="Percentage of active users who interacted with chatbot">ⓘ</span>
        </div>
        <div class="kpi-value">${formatNumber(doc.ai_agent?.adoption_rate_percent, 2)}<span class="suffix">%</span></div>
        ${renderDelta(doc.ai_agent_delta?.adoption_rate_percent, doc.ai_agent_previous?.adoption_rate_percent, 2, '%', false)}
      </div>
      <div class="kpi-card">
        <div class="kpi-label">
          Deflection rate
          <span class="doc-kpi-info" title="Percentage of conversations resolved without human escalation">ⓘ</span>
        </div>
        <div class="kpi-value">${formatNumber(doc.ai_agent?.deflection_rate_percent, 2)}<span class="suffix">%</span></div>
        ${renderDelta(doc.ai_agent_delta?.deflection_rate_percent, doc.ai_agent_previous?.deflection_rate_percent, 2, '%', false)}
      </div>
    `;
    document.getElementById('docMetricsGrid').innerHTML = allMetricsHTML;

    // Render trend charts if data available
    if (doc.trend && doc.trend.length > 0) {
      console.log('✅ Rendering total numbers trend chart with', doc.trend.length, 'data points');
      this.renderDocTrendChart(doc.trend);
    } else {
      console.warn('❌ No total numbers trend data to render. doc.trend:', doc.trend);
    }

    if (doc.engagement_trend && doc.engagement_trend.length > 0) {
      console.log('✅ Rendering rates trend chart with', doc.engagement_trend.length, 'data points');
      this.renderDocEngagementChart(doc.engagement_trend);
    } else {
      console.warn('❌ No rates trend data to render. doc.engagement_trend:', doc.engagement_trend);
    }
  }

  renderDocTrendChart(trendData) {
    const ctx = document.getElementById('docTrendChart');
    if (!ctx) return;

    // Destroy existing chart
    if (this.docTrendChart) {
      this.docTrendChart.destroy();
    }

    // Prepare data - total numbers
    const labels = trendData.map(d => d.month || d.fact_active_users_month_start_month);
    const totalActiveUsers = trendData.map(d => d.total_active_users || d.fact_active_users_total_active_users || 0);
    const totalTicketsAmount = trendData.map(d => d.total_tickets_amount || d.agg_monthly_zendesk_tickets_tickets_amountt || 0);
    const totalConversations = trendData.map(d => d.total_conversations || d.agg_deflection_rate_total_converstions || 0);

    // Create chart
    this.docTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Total Active Users',
            data: totalActiveUsers,
            borderColor: '#00FF88',
            backgroundColor: 'rgba(0, 255, 136, 0.1)',
            tension: 0.4,
            borderWidth: 2,
            yAxisID: 'y'
          },
          {
            label: 'Total Tickets Amount',
            data: totalTicketsAmount,
            borderColor: '#FF6B6B',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            tension: 0.4,
            borderWidth: 2,
            yAxisID: 'y'
          },
          {
            label: 'Total Conversations',
            data: totalConversations,
            borderColor: '#00D9FF',
            backgroundColor: 'rgba(0, 217, 255, 0.1)',
            tension: 0.4,
            borderWidth: 2,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#E0E0E0',
              font: { size: 12 },
              usePointStyle: true,
              padding: 15
            },
            onClick: function(e, legendItem, legend) {
              const index = legendItem.datasetIndex;
              const chart = legend.chart;
              const meta = chart.getDatasetMeta(index);
              
              // Toggle visibility
              meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
              
              // Update chart with animation to trigger auto-scale
              chart.update();
            }
          },
          tooltip: {
            backgroundColor: 'rgba(13, 13, 13, 0.95)',
            titleColor: '#FFFFFF',
            bodyColor: '#E0E0E0',
            borderColor: '#3D3D3D',
            borderWidth: 1,
            padding: 12,
            displayColors: true
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#808080', font: { size: 11 } }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { 
              color: '#808080',
              font: { size: 11 },
              callback: function(value) {
                return value.toLocaleString();
              }
            }
          }
        },
        onClick: (event, activeElements, chart) => {
          // Trigger auto-scale when legend items are clicked
          chart.update('none');
        }
      }
    });
  }

  renderDocEngagementChart(engagementData) {
    const ctx = document.getElementById('docEngagementChart');
    if (!ctx) return;

    // Destroy existing chart
    if (this.docEngagementChart) {
      this.docEngagementChart.destroy();
    }

    // Helper function to parse string fractions and percentages
    const parsePercentValue = (value) => {
      if (value === null || value === undefined) return 0;
      
      // If it's already a number, return it
      if (typeof value === 'number') return value;
      
      // If it's a string fraction like "2289/25" or "1597/100"
      if (typeof value === 'string' && value.includes('/')) {
        const parts = value.split('/');
        if (parts.length === 2) {
          const numerator = parseFloat(parts[0]);
          const denominator = parseFloat(parts[1]);
          if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
            return numerator / denominator;
          }
        }
      }
      
      // Try to parse as regular number
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    };

    // Prepare data - all percentages
    const labels = engagementData.map(d => d.month || d.fact_active_users_month_start_month);
    const adoptionRate = engagementData.map(d => parsePercentValue(d.adoption_rate_percent));
    const deflectionRate = engagementData.map(d => parsePercentValue(d.deflection_rate_percent));
    const ticketsVolume = engagementData.map(d => parsePercentValue(d.tickets_volume_percent));

    console.log('📊 Parsed Adoption Rate:', adoptionRate);
    console.log('📊 Parsed Deflection Rate:', deflectionRate);
    console.log('📊 Parsed Tickets Volume:', ticketsVolume);

    // Create chart
    this.docEngagementChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Intercom Adoption Rate',
            data: adoptionRate,
            borderColor: '#FF006E',
            backgroundColor: 'rgba(255, 0, 110, 0.1)',
            tension: 0.4,
            borderWidth: 2,
            yAxisID: 'y'
          },
          {
            label: 'Deflection Rate',
            data: deflectionRate,
            borderColor: '#00D9FF',
            backgroundColor: 'rgba(0, 217, 255, 0.1)',
            tension: 0.4,
            borderWidth: 2,
            yAxisID: 'y'
          },
          {
            label: 'Tickets Volume',
            data: ticketsVolume,
            borderColor: '#3D5A80',
            backgroundColor: 'rgba(61, 90, 128, 0.1)',
            tension: 0.4,
            borderWidth: 2,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#E0E0E0',
              font: { size: 12 },
              usePointStyle: true,
              padding: 15
            },
            onClick: function(e, legendItem, legend) {
              const index = legendItem.datasetIndex;
              const chart = legend.chart;
              const meta = chart.getDatasetMeta(index);
              
              // Toggle visibility
              meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
              
              // Update chart with animation to trigger auto-scale
              chart.update();
            }
          },
          tooltip: {
            backgroundColor: 'rgba(13, 13, 13, 0.95)',
            titleColor: '#FFFFFF',
            bodyColor: '#E0E0E0',
            borderColor: '#3D3D3D',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + context.parsed.y.toFixed(2) + '%';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#808080', font: { size: 11 } }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { 
              color: '#808080',
              font: { size: 11 },
              callback: function(value) {
                return value + '%';
              }
            }
          }
        }
      }
    });
  }

  aggregateTrendByDay(trendData) {
    // Check if data is already daily-aggregated (has 'date' field instead of 'time')
    if (trendData.length > 0 && trendData[0].date && !trendData[0].time) {
      // Data is already daily, return as-is
      return trendData;
    }

    // Group hourly trend data by day
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
      
      dailyData[dateKey].passed_checks += point.passed_checks || 0;
      dailyData[dateKey].failed_checks += point.failed_checks || 0;
      dailyData[dateKey].total_attempts += point.total_attempts || 0;
      dailyData[dateKey].created_labs += point.created_labs || 0;
      dailyData[dateKey].resolved_labs += point.resolved_labs || 0;
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

