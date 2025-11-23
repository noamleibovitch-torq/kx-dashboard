// Renderer process - UI logic and data management

// Register Chart.js datalabels plugin
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
  console.log('✅ Chart.js datalabels plugin registered');
}

class DashboardApp {
  constructor() {
    this.data = null;
    this.documentationData = null;
    this.currentView = this.loadView();
    this.selectedPeriod = this.loadPeriod();
    this.daysBack = this.calculateDaysBack(this.selectedPeriod);
    this.docPeriod = this.loadDocPeriod(); // 'mtd' or 'prev'
    this.refreshTimer = null;
    this.rotationTimer = null; // For auto-rotation
    this.rotationInterval = this.loadRotationInterval(); // seconds, 0 = disabled
    this.showWeather = this.loadWeatherToggle();
    this.showClock = this.loadClockToggle();
    this.dataRefreshInterval = this.loadDataRefreshInterval();
    this.trendChart = null;
    this.guidesChart = null; // For top guides stacked bar chart
    this.segmentsPieChart = null;
    this.enrollmentTrendChart = null;
    this.docTrendChart = null;
    this.docEngagementChart = null;
    this.selectedSegment = null;
    
    // Color palette for segments
    // Match doc trend color palette (softer, professional)
    this.segmentColors = [
      '#00FF88', // Primary green (matches doc trends)
      '#00D9FF', // Cyan (matches doc trends)
      '#FF6B6B', // Coral (matches doc trends)
      '#FF006E', // Magenta (matches doc trends)
      '#3D5A80', // Blue-gray (matches doc trends)
      '#FFB627', // Amber
      '#8B5CF6', // Purple
      '#10B981', // Emerald
      '#F59E0B', // Orange
      '#EC4899', // Pink
      '#6366F1', // Indigo
      '#14B8A6', // Teal
      '#808080'  // Gray for others
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
    this.startClock();
    this.loadWeather();
    this.startAutoRotation(); // Start auto-rotation if enabled
    this.updateWidgetVisibility(); // Apply visibility settings
    this.loadAppVersion(); // Display app version in footer
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

  // Trend filter persistence
  loadTrendFilters(chartId) {
    const saved = localStorage.getItem(`trendFilters_${chartId}`);
    return saved ? JSON.parse(saved) : {};
  }

  saveTrendFilters(chartId, filters) {
    localStorage.setItem(`trendFilters_${chartId}`, JSON.stringify(filters));
  }

  // Settings persistence
  loadRotationInterval() {
    const saved = localStorage.getItem('rotationInterval');
    return saved ? parseInt(saved, 10) : 0; // Default: disabled
  }

  saveRotationInterval(interval) {
    localStorage.setItem('rotationInterval', interval.toString());
  }

  loadWeatherToggle() {
    const saved = localStorage.getItem('showWeather');
    return saved === null ? true : saved === 'true'; // Default: true
  }

  saveWeatherToggle(show) {
    localStorage.setItem('showWeather', show.toString());
  }

  loadClockToggle() {
    const saved = localStorage.getItem('showClock');
    return saved === null ? true : saved === 'true'; // Default: true
  }

  saveClockToggle(show) {
    localStorage.setItem('showClock', show.toString());
  }

  loadConsoleToggle() {
    const saved = localStorage.getItem('showConsole');
    return saved === null ? false : saved === 'true'; // Default: false (console hidden)
  }

  saveConsoleToggle(show) {
    localStorage.setItem('showConsole', show.toString());
  }

  loadDataRefreshInterval() {
    const saved = localStorage.getItem('dataRefreshInterval');
    return saved ? parseInt(saved, 10) : 60; // Default: 60 minutes
  }

  saveDataRefreshInterval(interval) {
    localStorage.setItem('dataRefreshInterval', interval.toString());
  }

  calculateDaysBack(period) {
    if (period === '7') return 7;
    if (period === '30') return 30;
    if (period === 'MTD') {
      // Month to Date - calculate days from start of current month to today
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const diffTime = Math.abs(now - startOfMonth);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(diffDays, 1); // Return at least 1 day
    }
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
        
        // Refresh data from webhook (background if data exists)
        console.log('Triggering data refresh...');
        const hasData = this.data && this.data.enrollments;
        this.load(!hasData); // Background refresh if we have data
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
        
        // Refresh data from webhook (background if data exists)
        console.log('Triggering documentation data refresh...');
        const hasData = this.documentationData && this.documentationData.documentation;
        this.load(!hasData); // Background refresh if we have data
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

    // Cache info click to force refresh
    const cacheInfo = document.getElementById('cacheInfo');
    if (cacheInfo) {
      cacheInfo.addEventListener('click', () => {
        console.log('🔄 Cache info clicked: clearing cache and reloading data');
        this.api.invalidateCache();
        this.load();
      });
    }

    // Settings modal
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const rotateInterval = document.getElementById('rotateInterval');
    const showWeather = document.getElementById('showWeather');
    const showClock = document.getElementById('showClock');
    const showConsole = document.getElementById('showConsole');

    if (settingsBtn && settingsModal && closeSettings) {
      settingsBtn.addEventListener('click', async () => {
        settingsModal.classList.add('active');
        // Load current settings into modal
        rotateInterval.value = this.rotationInterval.toString();
        showWeather.checked = this.showWeather;
        showClock.checked = this.showClock;
        
        // Load console state from Electron
        if (window.electronAPI && window.electronAPI.isDevToolsOpened) {
          const isOpened = await window.electronAPI.isDevToolsOpened();
          showConsole.checked = isOpened;
          this.showConsole = isOpened;
        } else {
          showConsole.checked = this.showConsole;
        }
      });

      closeSettings.addEventListener('click', () => {
        settingsModal.classList.remove('active');
      });

      // Close modal on background click
      settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
          settingsModal.classList.remove('active');
        }
      });

      // Rotation interval change
      rotateInterval.addEventListener('change', (e) => {
        const newInterval = parseInt(e.target.value, 10);
        console.log('⏱️  Rotation interval changed to:', newInterval);
        this.rotationInterval = newInterval;
        this.saveRotationInterval(newInterval);
        this.startAutoRotation(); // Restart with new interval
      });

      // Weather toggle
      showWeather.addEventListener('change', (e) => {
        console.log('🌤️  Weather toggle changed to:', e.target.checked);
        this.showWeather = e.target.checked;
        this.saveWeatherToggle(e.target.checked);
        this.updateWidgetVisibility();
      });

      // Clock toggle
      showClock.addEventListener('change', (e) => {
        console.log('🕒 Clock toggle changed to:', e.target.checked);
        this.showClock = e.target.checked;
        this.saveClockToggle(e.target.checked);
        this.updateWidgetVisibility();
      });
    }

    // Data refresh interval setting
    const dataRefreshInterval = document.getElementById('dataRefreshInterval');
    if (dataRefreshInterval) {
      dataRefreshInterval.value = this.dataRefreshInterval.toString();
      
      dataRefreshInterval.addEventListener('change', (e) => {
        const minutes = parseInt(e.target.value, 10);
        console.log('🔄 Data refresh interval changed to:', minutes, 'minutes');
        this.dataRefreshInterval = minutes;
        this.saveDataRefreshInterval(minutes);
        this.startAutoRefresh(); // Restart with new interval
      });
    }
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
  async load(isBackgroundRefresh = false) {
    try {
      // Only show loading indicator on initial load or if we have no data
      const hasData = this.data && this.data.enrollments && this.documentationData && this.documentationData.documentation;
      const shouldShowLoading = !isBackgroundRefresh && !hasData;
      
      if (shouldShowLoading) {
        this.showLoading(true);
        console.log('📊 Initial load - showing loading indicator');
      } else if (isBackgroundRefresh) {
        console.log('🔄 Background refresh - silent update');
      }
      
      this.hideError();

      console.log('🔄 Loading dashboard data from cache...');
      
      // Load from cached JSON file (generated by GitHub Actions)
      const response = await fetch('./data/dashboard.json?t=' + Date.now()); // Cache bust
      if (!response.ok) {
        throw new Error('Failed to load dashboard data');
      }
      
      const result = await response.json();
      console.log('📥 Dashboard data received:', result);
      
      // Log the structure
      console.log('📊 Data structure check:');
      console.log('  - enrollments:', result.enrollments ? '✅' : '❌');
      console.log('  - labs:', result.labs ? '✅' : '❌');
      console.log('  - documentation:', result.documentation ? '✅' : '❌');
      
      if (result.enrollments) {
        console.log('  - enrollments.guides:', result.enrollments.guides ? '✅' : '❌');
        console.log('  - enrollments.window:', result.enrollments.window ? '✅' : '❌');
      }
      
      // Split the combined response
      this.data = result; // Contains enrollments and labs
      this.documentationData = result; // Contains documentation
      
      this.render();
      this.updateLastUpdated(result.timestamp);
      
      if (isBackgroundRefresh) {
        console.log('✅ Background refresh complete');
      }
    } catch (error) {
      console.error('Load error:', error);
      // Only show error banner if this isn't a background refresh or if we have no data
      const hasData = this.data && this.data.enrollments;
      if (!isBackgroundRefresh || !hasData) {
        this.showError(error.message || 'Failed to load data. Will retry in 60 minutes.');
      } else {
        console.warn('⚠️ Background refresh failed, keeping existing data');
      }
    } finally {
      this.hideLoading();
    }
  }

  // Auto-refresh
  startAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    if (this.dataRefreshInterval > 0) {
      const intervalMs = this.dataRefreshInterval * 60 * 1000;
      this.refreshTimer = setInterval(() => {
        this.load(true); // Background refresh
      }, intervalMs);
      console.log(`⏰ Auto-refresh enabled: every ${this.dataRefreshInterval} minutes (background)`);
    } else {
      console.log('⏰ Auto-refresh disabled');
    }
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

  updateLastUpdated(timestamp) {
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (timestamp) {
      const date = new Date(timestamp);
      lastUpdatedEl.textContent = `Last updated: ${date.toLocaleString()}`;
    } else {
      lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleString()}`;
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
    
    // Validate data structure
    if (!enrollments || !enrollments.window || !labs) {
      console.error('❌ Invalid data structure:');
      console.error('  enrollments:', enrollments);
      console.error('  labs:', labs);
      const kpiGrid = document.getElementById('kpiGrid');
      if (kpiGrid) {
        kpiGrid.innerHTML = '<p style="color: #FF6B6B; padding: 20px;">Error loading KPI data. Please check the console for details.</p>';
      }
      return;
    }
    
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
        label: 'Today\'s Avg Solve Time',
        sublabel: null,
        value: labs.today.avg_resolve_hours.toFixed(1),
        previousValue: null,
        delta: null,
        suffix: 'h',
        weeklyInfo: {
          value: labs.current.avg_resolve_hours.toFixed(1),
          label: `${enrollments.window.days_back}d Average`
        }
      }
    ];

    const html = kpis.map(kpi => this.createKPICard(kpi)).join('');
    document.getElementById('kpiGrid').innerHTML = html;
  }

  createKPICard({ label, sublabel, value, previousValue, delta, suffix = '', weeklyInfo = null }) {
    const deltaHTML = delta ? `
      <div class="kpi-delta ${delta.abs >= 0 ? 'positive' : 'negative'}">
        <span class="previous-value">${previousValue}${suffix}</span>
        <span>${delta.abs >= 0 ? '↑' : '↓'} ${delta.abs >= 0 ? '+' : ''}${Math.abs(delta.abs)}${suffix}</span>
        ${delta.percent !== null && delta.percent !== undefined ? `<span>(${delta.percent >= 0 ? '+' : ''}${delta.percent}%)</span>` : ''}
      </div>
    ` : weeklyInfo ? `
      <div class="kpi-info-box">
        <span class="info-label">${weeklyInfo.label}</span>
        <span class="info-value">${weeklyInfo.value}${suffix}</span>
      </div>
    ` : '<div class="kpi-delta-spacer"></div>';

    return `
      <div class="kpi-card">
        <div class="kpi-label">${label}</div>
        <div class="kpi-sublabel">${sublabel || ''}</div>
        <div class="kpi-value">
          ${value}${suffix ? `<span class="suffix">${suffix}</span>` : ''}
        </div>
        ${deltaHTML}
      </div>
    `;
  }

  renderEnrollments(displayData = this.data) {
    const { enrollments } = displayData;
    
    // Validate enrollments data
    if (!enrollments || !enrollments.guides || !enrollments.guides.top || !enrollments.guides.others) {
      console.error('❌ Invalid enrollments data structure:');
      console.error('  enrollments:', enrollments);
      const guidesChart = document.getElementById('guidesChart');
      if (guidesChart) {
        guidesChart.innerHTML = '<p style="color: #FF6B6B; padding: 20px;">Error loading guides data. Please check the console.</p>';
      }
      return;
    }
    
    // Top Guides - now with stacked bars
    const allGuides = [
      ...enrollments.guides.top,
      {
        title: 'Others',
        count: enrollments.guides.others.count,
        completed_passed: enrollments.guides.others.completed_passed,
        in_progress: enrollments.guides.others.in_progress,
        not_started: enrollments.guides.others.not_started,
        percent: enrollments.guides.others.percent
      }
    ];
    
    this.renderGuidesChart(allGuides);
    
    // Enrollment trend chart - using mock daily data based on current/previous
    this.renderEnrollmentTrendChart(enrollments);
  }

  renderGuidesChart(guides) {
    const guidesContainer = document.getElementById('guidesChart');
    
    // Find the max count for scaling
    const maxCount = Math.max(...guides.map(g => g.count));
    
    // Generate HTML for each guide
    const guidesHTML = guides.map(guide => {
      const isOthers = guide.title === 'Others';
      const completed = guide.completed_passed || 0;
      const inProgress = guide.in_progress || 0;
      const notStarted = guide.not_started || 0;
      const total = guide.count;
      
      // Calculate percentages for bar widths
      const completedWidth = (completed / maxCount) * 100;
      const inProgressWidth = (inProgress / maxCount) * 100;
      const notStartedWidth = (notStarted / maxCount) * 100;
      
      return `
        <div class="guide-item">
          <div class="guide-header">
            <span class="guide-title">${guide.title}</span>
            <span class="guide-stats">
              <span class="count">${total}</span> <span class="percent">(${guide.percent}%)</span>
            </span>
          </div>
          <div class="guide-bar-container">
            <div class="guide-bar-segment" 
                 style="width: ${notStartedWidth}%; background: rgba(128, 128, 128, 0.8); border: 2px solid #999999;"
                 title="Not Started: ${notStarted}"></div>
            <div class="guide-bar-segment" 
                 style="width: ${inProgressWidth}%; background: rgba(0, 217, 255, 0.8); border: 2px solid #00D9FF;"
                 title="In Progress: ${inProgress}"></div>
            <div class="guide-bar-segment" 
                 style="width: ${completedWidth}%; background: rgba(0, 255, 136, 0.8); border: 2px solid #00FF88;"
                 title="Completed: ${completed}"></div>
          </div>
        </div>
      `;
    }).join('');
    
    guidesContainer.innerHTML = guidesHTML;
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
            backgroundColor: 'rgba(0, 255, 136, 0.8)',
            borderColor: '#00FF88',
            borderWidth: 2,
            borderRadius: 4,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowBlur: 10,
            shadowColor: 'rgba(0, 255, 136, 0.5)'
          },
          {
            label: 'In Progress',
            data: dailyData.map(point => point.in_progress),
            backgroundColor: 'rgba(0, 217, 255, 0.8)',
            borderColor: '#00D9FF',
            borderWidth: 2,
            borderRadius: 4,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowBlur: 10,
            shadowColor: 'rgba(0, 217, 255, 0.5)'
          },
          {
            label: 'Not Started',
            data: dailyData.map(point => point.not_started),
            backgroundColor: 'rgba(128, 128, 128, 0.8)',
            borderColor: '#999999',
            borderWidth: 2,
            borderRadius: 4,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowBlur: 10,
            shadowColor: 'rgba(128, 128, 128, 0.5)'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#E0E0E0',
              font: { size: 12 },
              usePointStyle: true,
              padding: 15
            }
          },
          tooltip: {
            backgroundColor: 'rgba(13, 13, 13, 0.95)',
            titleColor: '#FFFFFF',
            bodyColor: '#E0E0E0',
            borderColor: '#3D3D3D',
            borderWidth: 1,
            padding: 12,
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
              color: '#808080',
              font: { size: 11 }
            },
            grid: { 
              color: 'rgba(255, 255, 255, 0.05)',
              drawBorder: false
            }
          },
          x: {
            stacked: true,
            ticks: { 
              color: '#808080',
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
    
    // Render legend with neon Tron styling
    const legendHTML = segments.current.map((seg, index) => {
      const segmentName = seg.segment || '(none)';
      const color = this.getSegmentColor(index);
      const isSelected = this.selectedSegment === segmentName;
      return `
        <div class="segment-legend-item ${isSelected ? 'selected' : ''}" data-segment="${segmentName}">
          <div class="segment-legend-dot" style="background: ${color}; box-shadow: 0 0 4px ${color}AA, 0 0 6px ${color}66;"></div>
          <span class="segment-legend-label">${segmentName}</span>
          <span class="segment-legend-value" style="color: ${color};">${seg.percent}%</span>
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
    
    // Create semi-transparent versions for fills
    const backgroundColors = colors.map(color => {
      // Convert hex to rgba with 0.85 alpha for vibrant Tron look
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, 0.85)`;
    });

    this.segmentsPieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: backgroundColors,
          borderColor: colors,
          borderWidth: 3,
          hoverBorderColor: '#FFFFFF',
          hoverBorderWidth: 4,
          hoverOffset: 12,
          offset: 0,
          spacing: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '50%',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(13, 13, 13, 0.95)',
            titleColor: '#FFFFFF',
            titleFont: { size: 14, weight: 'bold' },
            bodyColor: '#E0E0E0',
            bodyFont: { size: 13 },
            borderColor: '#3D3D3D',
            borderWidth: 1,
            padding: 14,
            displayColors: true,
            usePointStyle: true,
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const count = segments[context.dataIndex].count || 0;
                return `${label}: ${value.toFixed(1)}% (${count} users)`;
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
        <div class="kpi-label">Ticket Amount</div>
        <div class="kpi-value">${formatNumber(doc.support?.tickets_amount)}</div>
        ${renderDelta(doc.support_delta?.tickets_amount, doc.support_previous?.tickets_amount, 0, '', true)}
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Ticket Volume</div>
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

    // Load saved filter states
    const savedFilters = this.loadTrendFilters('docTrend');

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
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#00FF88',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            yAxisID: 'y',
            hidden: savedFilters['Total Active Users'] === true
          },
          {
            label: 'Total Ticket Amount',
            data: totalTicketsAmount,
            borderColor: '#FF6B6B',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#FF6B6B',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            yAxisID: 'y',
            hidden: savedFilters['Total Ticket Amount'] === true
          },
          {
            label: 'Total Conversations',
            data: totalConversations,
            borderColor: '#00D9FF',
            backgroundColor: 'rgba(0, 217, 255, 0.1)',
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#00D9FF',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            yAxisID: 'y',
            hidden: savedFilters['Total Conversations'] === true
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
          datalabels: {
            display: true,
            anchor: 'end',
            align: 'top',
            offset: 6,
            color: function(context) {
              return context.dataset.borderColor;
            },
            font: {
              size: 11,
              weight: 'bold'
            },
            formatter: function(value) {
              if (value === null || value === undefined || value === 0) return '';
              return value.toLocaleString();
            },
            backgroundColor: 'rgba(13, 13, 13, 0.9)',
            borderRadius: 4,
            padding: {
              top: 3,
              bottom: 3,
              left: 5,
              right: 5
            },
            textStrokeColor: 'rgba(0, 0, 0, 0.8)',
            textStrokeWidth: 2
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#E0E0E0',
              font: { size: 12 },
              usePointStyle: true,
              padding: 15
            },
            onClick: (e, legendItem, legend) => {
              const index = legendItem.datasetIndex;
              const chart = legend.chart;
              const meta = chart.getDatasetMeta(index);
              
              // Toggle visibility
              meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
              
              // Save filter state
              const filters = {};
              chart.data.datasets.forEach((dataset, i) => {
                const datasetMeta = chart.getDatasetMeta(i);
                filters[dataset.label] = datasetMeta.hidden === true;
              });
              this.saveTrendFilters('docTrend', filters);
              
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

    // Load saved filter states
    const savedFilters = this.loadTrendFilters('docEngagement');

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
            borderColor: '#00D9FF',
            backgroundColor: 'rgba(0, 217, 255, 0.15)',
            tension: 0.4,
            borderWidth: 4,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#00D9FF',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            yAxisID: 'y',
            hidden: savedFilters['Intercom Adoption Rate'] === true
          },
          {
            label: 'Deflection Rate',
            data: deflectionRate,
            borderColor: '#3D5A80',
            backgroundColor: 'rgba(61, 90, 128, 0.15)',
            tension: 0.4,
            borderWidth: 4,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#3D5A80',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            yAxisID: 'y',
            hidden: savedFilters['Deflection Rate'] === true
          },
          {
            label: 'Ticket Volume',
            data: ticketsVolume,
            borderColor: '#FF006E',
            backgroundColor: 'rgba(255, 0, 110, 0.15)',
            tension: 0.4,
            borderWidth: 4,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#FF006E',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            yAxisID: 'y',
            hidden: savedFilters['Ticket Volume'] === true
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
          datalabels: {
            display: true,
            anchor: 'end',
            align: 'top',
            offset: 6,
            color: function(context) {
              return context.dataset.borderColor;
            },
            font: {
              size: 11,
              weight: 'bold'
            },
            formatter: function(value) {
              if (value === null || value === undefined || value === 0) return '';
              return value.toFixed(1) + '%';
            },
            backgroundColor: 'rgba(13, 13, 13, 0.9)',
            borderRadius: 4,
            padding: {
              top: 3,
              bottom: 3,
              left: 5,
              right: 5
            },
            textStrokeColor: 'rgba(0, 0, 0, 0.8)',
            textStrokeWidth: 2
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#E0E0E0',
              font: { size: 12 },
              usePointStyle: true,
              padding: 15
            },
            onClick: (e, legendItem, legend) => {
              const index = legendItem.datasetIndex;
              const chart = legend.chart;
              const meta = chart.getDatasetMeta(index);
              
              // Toggle visibility
              meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
              
              // Save filter state
              const filters = {};
              chart.data.datasets.forEach((dataset, i) => {
                const datasetMeta = chart.getDatasetMeta(i);
                filters[dataset.label] = datasetMeta.hidden === true;
              });
              this.saveTrendFilters('docEngagement', filters);
              
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
            beginAtZero: false,
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
            backgroundColor: 'rgba(0, 255, 136, 0.8)',
            borderColor: '#00FF88',
            borderWidth: 2,
            borderRadius: 4,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowBlur: 10,
            shadowColor: 'rgba(0, 255, 136, 0.5)'
          },
          {
            label: 'Failed Checks',
            data: dailyData.map(point => point.failed_checks),
            backgroundColor: 'rgba(255, 0, 110, 0.8)',
            borderColor: '#FF006E',
            borderWidth: 2,
            borderRadius: 4,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowBlur: 10,
            shadowColor: 'rgba(255, 0, 110, 0.5)'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#E0E0E0',
              font: { size: 12 },
              usePointStyle: true,
              padding: 15
            }
          },
          tooltip: {
            backgroundColor: 'rgba(13, 13, 13, 0.95)',
            titleColor: '#FFFFFF',
            bodyColor: '#E0E0E0',
            borderColor: '#3D3D3D',
            borderWidth: 1,
            padding: 12,
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
              color: '#808080',
              font: { size: 11 }
            },
            grid: { 
              color: 'rgba(255, 255, 255, 0.05)',
              drawBorder: false
            }
          },
          x: {
            stacked: true,
            ticks: { 
              color: '#808080',
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

  // Clock functionality
  startClock() {
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
  }

  updateClock() {
    const now = new Date();
    const clockElement = document.getElementById('headerClock');
    
    if (clockElement) {
      // Manual formatting to ensure proper 24-hour format (00:00:00 for midnight, not 24:00:00)
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}:${seconds}`;
      
      const dateStr = now.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
      
      clockElement.querySelector('.clock-time').textContent = timeStr;
      clockElement.querySelector('.clock-date').textContent = dateStr;
    }
  }

  // Weather functionality
  getWeatherIcon(weatherCode) {
    // Weather codes from wttr.in - return SVG-style unicode symbols
    const iconMap = {
      '113': '◉',   // Sunny/Clear - filled circle
      '116': '◐',   // Partly cloudy - half circle
      '119': '◯',   // Cloudy - hollow circle
      '122': '◯',   // Overcast
      '143': '≋',   // Mist - wavy lines
      '176': '⌇',   // Patchy rain possible
      '179': '❄',   // Patchy snow possible
      '182': '◈',   // Patchy sleet possible
      '185': '⌇',   // Patchy freezing drizzle
      '200': '⚡',  // Thundery outbreaks
      '227': '❄',   // Blowing snow
      '230': '❄',   // Blizzard
      '248': '≋',   // Fog
      '260': '≋',   // Freezing fog
      '263': '⌇',   // Patchy light drizzle
      '266': '⌇',   // Light drizzle
      '281': '⌇',   // Freezing drizzle
      '284': '⌇',   // Heavy freezing drizzle
      '293': '⌇',   // Patchy light rain
      '296': '⌇',   // Light rain
      '299': '◐',   // Moderate rain at times
      '302': '◐',   // Moderate rain
      '305': '◨',   // Heavy rain at times
      '308': '◨',   // Heavy rain
      '311': '⌇',   // Light freezing rain
      '314': '◨',   // Moderate or heavy freezing rain
      '317': '◈',   // Light sleet
      '320': '◈',   // Moderate or heavy sleet
      '323': '❄',   // Patchy light snow
      '326': '❄',   // Light snow
      '329': '❄',   // Patchy moderate snow
      '332': '❄',   // Moderate snow
      '335': '❄',   // Patchy heavy snow
      '338': '❄',   // Heavy snow
      '350': '◈',   // Ice pellets
      '353': '⌇',   // Light rain shower
      '356': '◨',   // Moderate or heavy rain shower
      '359': '◨',   // Torrential rain shower
      '362': '◈',   // Light sleet showers
      '365': '◈',   // Moderate or heavy sleet showers
      '368': '❄',   // Light snow showers
      '371': '❄',   // Moderate or heavy snow showers
      '374': '◈',   // Light showers of ice pellets
      '377': '◈',   // Moderate or heavy showers of ice pellets
      '386': '⚡',  // Patchy light rain with thunder
      '389': '⚡',  // Moderate or heavy rain with thunder
      '392': '⚡',  // Patchy light snow with thunder
      '395': '⚡'   // Moderate or heavy snow with thunder
    };
    
    return iconMap[weatherCode] || '◉';
  }

  async loadWeather() {
    try {
      // Using wttr.in for simple weather without API key
      // Try with a timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('https://wttr.in/?format=j1', {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log('🌤️ Weather data received successfully');
      
      if (data && data.current_condition && data.current_condition[0]) {
        const current = data.current_condition[0];
        const location = data.nearest_area && data.nearest_area[0];
        
        const tempC = Math.round(current.temp_C);
        const weatherCode = current.weatherCode;
        const weatherDesc = current.weatherDesc && current.weatherDesc[0] ? 
          current.weatherDesc[0].value : 'Unknown';
        
        console.log('🌤️ Weather Code:', weatherCode, '- Description:', weatherDesc);
        
        const locationName = location ? 
          (location.areaName && location.areaName[0] ? location.areaName[0].value : 'Unknown') : 
          'Unknown';
        
        const weatherIcon = this.getWeatherIcon(weatherCode);
        
        const weatherElement = document.getElementById('headerWeather');
        if (weatherElement) {
          const iconEl = weatherElement.querySelector('.weather-icon');
          iconEl.textContent = weatherIcon;
          iconEl.title = weatherDesc; // Add tooltip with description
          weatherElement.querySelector('.weather-temp').textContent = `${tempC}°C`;
          weatherElement.querySelector('.weather-location').textContent = locationName;
        }
        
        // Schedule next refresh only if successful
        setTimeout(() => this.loadWeather(), 30 * 60 * 1000);
      }
    } catch (error) {
      console.warn('⚠️ Weather fetch failed (non-critical):', error.message);
      const weatherElement = document.getElementById('headerWeather');
      if (weatherElement) {
        weatherElement.querySelector('.weather-icon').textContent = '◉';
        weatherElement.querySelector('.weather-icon').title = 'Weather unavailable';
        weatherElement.querySelector('.weather-temp').textContent = '--°C';
        weatherElement.querySelector('.weather-location').textContent = 'N/A';
      }
      
      // Retry in 5 minutes on error
      setTimeout(() => this.loadWeather(), 5 * 60 * 1000);
    }
  }

  // Widget visibility
  updateWidgetVisibility() {
    const weatherElement = document.getElementById('headerWeather');
    const clockElement = document.getElementById('headerClock');

    if (weatherElement) {
      weatherElement.style.display = this.showWeather ? 'flex' : 'none';
      console.log('🌤️ Weather widget visibility:', this.showWeather ? 'visible' : 'hidden');
    }

    if (clockElement) {
      clockElement.style.display = this.showClock ? 'flex' : 'none';
      console.log('🕒 Clock widget visibility:', this.showClock ? 'visible' : 'hidden');
    }
  }

  // Apply console settings on startup
  async applyConsoleSettings() {
    const savedConsole = this.loadConsoleToggle();
    
    if (window.electronAPI && window.electronAPI.isDevToolsOpened) {
      const isCurrentlyOpened = await window.electronAPI.isDevToolsOpened();
      
      // If saved state doesn't match current state, toggle it
      if (savedConsole !== isCurrentlyOpened) {
        if (window.electronAPI.toggleDevTools) {
          await window.electronAPI.toggleDevTools();
          console.log('🖥️  Console visibility applied:', savedConsole ? 'visible' : 'hidden');
        }
      }
    }
  }

  // Auto-rotation
  startAutoRotation() {
    // Clear existing timer
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }

    if (this.rotationInterval > 0) {
      console.log(`🔄 Auto-rotation enabled: switching views every ${this.rotationInterval} seconds`);
      this.rotationTimer = setInterval(() => {
        this.rotateView();
      }, this.rotationInterval * 1000);
    } else {
      console.log('🔄 Auto-rotation disabled');
    }
  }

  rotateView() {
    // Switch between Academy and Documentation
    this.currentView = this.currentView === 'academy' ? 'documentation' : 'academy';
    console.log('🔄 Auto-rotating to:', this.currentView);
    
    this.saveView();
    this.updateViewDisplay();
    
    // Load data in background if needed
    // The load() method is already smart with caching, so it will only fetch if needed
    this.load();
    
    // Render the new view
    this.render();
  }

  // Auto-update listeners
  setupUpdateListeners() {
    if (window.electronAPI && window.electronAPI.onUpdateStatus) {
      window.electronAPI.onUpdateStatus((data) => {
        this.handleUpdateStatus(data);
      });
    }
  }

  handleUpdateStatus(data) {
    const notification = document.getElementById('updateNotification');
    const icon = document.getElementById('updateIcon');
    const message = document.getElementById('updateMessage');

    if (!notification || !icon || !message) return;

    const isHotUpdate = data.type === 'hot';

    switch (data.status) {
      case 'checking':
        icon.textContent = '🔍';
        message.textContent = isHotUpdate ? 'Checking for content updates...' : 'Checking for updates...';
        notification.style.display = 'flex';
        notification.classList.remove('downloaded');
        setTimeout(() => {
          notification.style.display = 'none';
        }, 3000);
        break;

      case 'available':
        icon.textContent = '📥';
        message.textContent = isHotUpdate 
          ? `Hot update available (v${data.latestVersion}). Downloading...`
          : `Update available (v${data.version}). Downloading...`;
        notification.style.display = 'flex';
        notification.classList.remove('downloaded');
        break;

      case 'applied':
        icon.textContent = '🔄';
        message.textContent = `Update applied (v${data.version})! Reloading...`;
        notification.style.display = 'flex';
        notification.classList.add('downloaded');
        break;

      case 'not-available':
        icon.textContent = '✅';
        message.textContent = 'App is up to date!';
        notification.style.display = 'flex';
        notification.classList.remove('downloaded');
        setTimeout(() => {
          notification.style.display = 'none';
        }, 3000);
        break;

      case 'downloading':
        icon.textContent = '⬇️';
        message.textContent = `Downloading update... ${data.percent}%`;
        notification.style.display = 'flex';
        notification.classList.remove('downloaded');
        break;

      case 'downloaded':
        icon.textContent = '✅';
        message.textContent = `Update downloaded! Installing in 5 seconds...`;
        notification.style.display = 'flex';
        notification.classList.add('downloaded');
        break;

      case 'error':
        icon.textContent = '⚠️';
        message.textContent = `Update error: ${data.error}`;
        notification.style.display = 'flex';
        notification.classList.remove('downloaded');
        setTimeout(() => {
          notification.style.display = 'none';
        }, 5000);
        break;
    }
  }

  // Load and display app version
  async loadAppVersion() {
    const versionElement = document.getElementById('appVersion');
    if (versionElement) {
      versionElement.textContent = 'Web v1.0.0';
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new DashboardApp();
});

