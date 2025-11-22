// API client for Torq webhook
class DashboardAPI {
  constructor() {
    this.webhookURL = 'https://hooks.torq.io/v1/webhooks/8f17760c-c43f-4270-b465-95dabb54389d/workflows/78f77a59-d2ee-4015-afee-3c8043bb6b31/sync';
    this.authSecret = 'i9HpRTZLL4sq7AJW1qmpKqZsb85qB1Su9vcyvCayidk';
    // TESTING ONLY: Set to true to use mock data (includes trend chart data)
    this.useMockData = false;
    // Smart caching - auto-invalidates when queries change
    this.enableCache = true;
    // Cache TTL: 1 hour (can be cleared manually with Cmd+Shift+R)
    this.cacheExpirationMs = 60 * 60 * 1000;
    this.defaultSegments = ["Torq employees", "Torq App User", "Channel Partner"];
  }

  // Generate a simple hash for query strings
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  // Get cache key based on parameters and query hashes
  getCacheKey(daysBack, docPeriod) {
    const academyQuery = window.DashboardQueries.ENROLLMENTS_DASHBOARD_QUERY;
    const docQuery = window.DashboardQueries.DOCUMENTATION_DASHBOARD_QUERY;
    const academyHash = this.hashString(academyQuery);
    const docHash = this.hashString(docQuery);
    return `dashboard_cache_${daysBack}_${docPeriod}_${academyHash}_${docHash}`;
  }

  // Get cached data if available and valid
  getCachedData(cacheKey) {
    if (!this.enableCache) return null;
    
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) {
        console.log('💾 No cache found for key:', cacheKey);
        return null;
      }
      
      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      
      if (age < this.cacheExpirationMs) {
        console.log(`✅ Using cached data (age: ${Math.round(age / 1000)}s / ${Math.round(this.cacheExpirationMs / 1000)}s)`);
        console.log('📦 Cached data structure:', Object.keys(data));
        if (data.documentation) {
          console.log('📊 Documentation keys:', Object.keys(data.documentation));
          console.log('📈 Trend in cache:', data.documentation.trend ? `${data.documentation.trend.length} items` : 'missing');
        }
        return data;
      } else {
        console.log('⏰ Cache expired, fetching fresh data');
        localStorage.removeItem(cacheKey);
        return null;
      }
    } catch (error) {
      console.error('❌ Cache read error:', error);
      return null;
    }
  }

  // Store data in cache
  setCachedData(cacheKey, data) {
    if (!this.enableCache) return;
    
    try {
      const cacheEntry = {
        data: data,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
      console.log('💾 Data cached for future use');
    } catch (error) {
      console.error('Cache write error:', error);
      // If localStorage is full, clear old caches
      if (error.name === 'QuotaExceededError') {
        this.clearOldCaches();
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
        } catch (e) {
          console.error('Failed to cache even after cleanup:', e);
        }
      }
    }
  }

  // Clear old cache entries
  clearOldCaches() {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(k => k.startsWith('dashboard_cache_'));
    console.log('🧹 Clearing', cacheKeys.length, 'old cache entries');
    cacheKeys.forEach(key => localStorage.removeItem(key));
  }

  // Manual cache invalidation
  invalidateCache() {
    const stats = this.getCacheStats();
    console.log(`📊 Cache stats before clear: ${stats.count} entries, ${stats.totalSize}KB`);
    this.clearOldCaches();
    console.log('🗑️ All caches cleared - next load will fetch fresh data from webhook');
  }

  // Get cache statistics
  getCacheStats() {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(k => k.startsWith('dashboard_cache_'));
      
      if (cacheKeys.length === 0) {
        return { count: 0, totalSize: 0 };
      }

      let totalSize = 0;
      
      for (const key of cacheKeys) {
        const cached = localStorage.getItem(key);
        if (cached) {
          totalSize += new Blob([cached]).size;
        }
      }

      return {
        count: cacheKeys.length,
        totalSize: Math.round(totalSize / 1024)
      };
    } catch (error) {
      return { count: 0, totalSize: 0 };
    }
  }

  prepareQuery(daysBack) {
    // Get current timestamp
    const now = new Date().toISOString();
    
    // Replace Torq template variables with actual values
    let query = window.DashboardQueries.ENROLLMENTS_DASHBOARD_QUERY;
    
    // Replace template variables
    query = query.replace(/\{\{\s*\$\.now\.result\s*\}\}/g, now);
    query = query.replace(/\{\{\s*\$\.days_back\.result\s*\}\}/g, daysBack.toString());
    
    // For segments, we'll use a default priority list - you can customize this
    const defaultSegments = JSON.stringify(["Torq employees", "Channel Partner", "Torq App User"]);
    query = query.replace(/\{\{\s*\$\.segments\.result\s*\}\}/g, defaultSegments);
    
    return query;
  }

  async fetchDashboard(daysBack, docPeriod = 'mtd') {
    // TESTING ONLY: Use mock data to see trend chart before Torq update
    if (this.useMockData) {
      console.log('⚠️ USING MOCK DATA (change useMockData to false for production)');
      return {
        ...this.getMockData(daysBack),
        ...this.getMockDocumentationData()
      };
    }

    // Check cache first
    const cacheKey = this.getCacheKey(daysBack, docPeriod);
    const cachedData = this.getCachedData(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // No valid cache, fetch from webhook
    try {
      // Prepare queries (trend is now included in documentation query)
      const academyQuery = this.prepareQuery(daysBack);
      const { monthStart, documentationQuery } = this.prepareDocumentationQuery(docPeriod);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout for debugging

      console.log('🌐 Fetching fresh data from webhook...');
      console.log('📋 Webhook URL:', this.webhookURL);
      console.log('📋 Days back:', daysBack);
      console.log('📋 Doc period:', docPeriod);
      console.log('📋 Documentation query includes 12-month trend data');

      const response = await fetch(this.webhookURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'auth': this.authSecret
        },
        body: JSON.stringify({ 
          days_back: daysBack,
          month_start: monthStart,
          dashboard_query: academyQuery,
          documentation_query: documentationQuery
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('🌐 Webhook response received');
      console.log('📦 Response structure:', Object.keys(data));
      
      if (data.documentation) {
        console.log('📊 Documentation keys:', Object.keys(data.documentation));
        console.log('📈 Total Numbers Trend in response:', data.documentation.trend ? `${data.documentation.trend.length} items` : 'MISSING ❌');
        console.log('📈 Rates Trend in response:', data.documentation.engagement_trend ? `${data.documentation.engagement_trend.length} items` : 'MISSING ❌');
        
        if (data.documentation.trend && data.documentation.trend.length > 0) {
          console.log('📊 First total numbers item:', data.documentation.trend[0]);
          console.log('📊 Last total numbers item:', data.documentation.trend[data.documentation.trend.length - 1]);
        } else {
          console.warn('⚠️ Total numbers trend array is empty or missing!');
        }

        if (data.documentation.engagement_trend && data.documentation.engagement_trend.length > 0) {
          console.log('📊 First rates item:', data.documentation.engagement_trend[0]);
          console.log('📊 Last rates item:', data.documentation.engagement_trend[data.documentation.engagement_trend.length - 1]);
        } else {
          console.warn('⚠️ Rates trend array is empty or missing!');
        }

        if ((!data.documentation.trend || data.documentation.trend.length === 0) || 
            (!data.documentation.engagement_trend || data.documentation.engagement_trend.length === 0)) {
          console.warn('⚠️ Check Torq workflow:');
          console.warn('   1. Ensure documentation query includes both trend CTEs');
          console.warn('   2. Verify documentation query returns trend and engagement_trend arrays');
          console.warn('   3. Check BigQuery permissions for all tables');
        }
      } else {
        console.warn('⚠️ No documentation object in response!');
      }
      
      // Cache the response for future use
      this.setCachedData(cacheKey, data);
      
      // Response should contain enrollments, labs, and documentation
      return data;
    } catch (error) {
      console.error('API Error:', error);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - webhook took too long to respond');
      }
      throw error;
    }
  }

  prepareDocumentationQuery(docPeriod = 'mtd') {
    // Calculate month_start based on period selection
    const now = new Date();
    let monthStart;
    
    if (docPeriod === 'prev') {
      // Previous month: first day of previous month
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      monthStart = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-01`;
    } else {
      // Month to date (default): first day of current month
      monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    }
    
    // Get the documentation query
    let query = window.DashboardQueries.DOCUMENTATION_DASHBOARD_QUERY;
    
    // Replace template variable
    query = query.replace(/\{\{\s*\$\.month_start\.result\s*\}\}/g, monthStart);
    
    return { monthStart, documentationQuery: query };
  }

  // Mock data for testing (NOT USED - kept for reference)
  // To enable: Change line ~7 from useMockData: false to true (temporarily)
  getMockDocumentationData() {
    return {
      documentation: {
        window: {
          start_date: '2025-11-01',
          end_date: '2025-12-01',
          month: '2025-11'
        },
        support: {
          active_users: 896,
          tickets_amount: 191,
          tickets_volume_percent: 21.32,
          total_conversations: 794
        },
        ai_agent: {
          adoption_rate_percent: 25.00,
          deflection_rate_percent: 93.70,
          chatbot_users: 224,
          conversations_no_escalations: 744,
          total_conversations_for_deflection: 794
        },
        trend: [
          { month: '2024-11', total_active_users: 1100, total_tickets_amount: 200, total_conversations: 820 },
          { month: '2024-12', total_active_users: 1150, total_tickets_amount: 210, total_conversations: 850 },
          { month: '2025-01', total_active_users: 1200, total_tickets_amount: 195, total_conversations: 870 },
          { month: '2025-02', total_active_users: 1180, total_tickets_amount: 205, total_conversations: 840 },
          { month: '2025-03', total_active_users: 1220, total_tickets_amount: 190, total_conversations: 880 },
          { month: '2025-04', total_active_users: 1250, total_tickets_amount: 185, total_conversations: 900 },
          { month: '2025-05', total_active_users: 1240, total_tickets_amount: 200, total_conversations: 890 },
          { month: '2025-06', total_active_users: 1270, total_tickets_amount: 195, total_conversations: 920 },
          { month: '2025-07', total_active_users: 1280, total_tickets_amount: 205, total_conversations: 930 },
          { month: '2025-08', total_active_users: 1300, total_tickets_amount: 198, total_conversations: 950 },
          { month: '2025-09', total_active_users: 1290, total_tickets_amount: 210, total_conversations: 940 },
          { month: '2025-10', total_active_users: 1320, total_tickets_amount: 202, total_conversations: 970 },
          { month: '2025-11', total_active_users: 1190, total_tickets_amount: 190, total_conversations: 801 }
        ],
        engagement_trend: [
          { month: '2024-11', adoption_rate_percent: 25.06, deflection_rate_percent: 91.56, tickets_volume_percent: 18.21 },
          { month: '2024-12', adoption_rate_percent: 15.86, deflection_rate_percent: 93.60, tickets_volume_percent: 22.90 },
          { month: '2025-01', adoption_rate_percent: 30.03, deflection_rate_percent: 92.93, tickets_volume_percent: 24.35 },
          { month: '2025-02', adoption_rate_percent: 22.61, deflection_rate_percent: 94.96, tickets_volume_percent: 25.03 },
          { month: '2025-03', adoption_rate_percent: 24.35, deflection_rate_percent: 93.96, tickets_volume_percent: 24.44 },
          { month: '2025-04', adoption_rate_percent: 25.03, deflection_rate_percent: 93.70, tickets_volume_percent: 23.91 },
          { month: '2025-05', adoption_rate_percent: 24.44, deflection_rate_percent: 94.66, tickets_volume_percent: 16.82 },
          { month: '2025-06', adoption_rate_percent: 23.91, deflection_rate_percent: 94.98, tickets_volume_percent: 17.17 },
          { month: '2025-07', adoption_rate_percent: 23.92, deflection_rate_percent: 96.12, tickets_volume_percent: 24.07 },
          { month: '2025-08', adoption_rate_percent: 24.07, deflection_rate_percent: 97.30, tickets_volume_percent: 17.12 },
          { month: '2025-09', adoption_rate_percent: 25.65, deflection_rate_percent: 96.30, tickets_volume_percent: 18.00 },
          { month: '2025-10', adoption_rate_percent: 24.76, deflection_rate_percent: 97.44, tickets_volume_percent: 16.40 },
          { month: '2025-11', adoption_rate_percent: 22.44, deflection_rate_percent: 97.00, tickets_volume_percent: 15.97 }
        ]
      }
    };
  }

  getMockData(daysBack) {
    // Mock data based on the example from the spec
    return {
      enrollments: {
        current: {
          completed_failed: 0,
          completed_passed: 190,
          in_progress: 90,
          not_started: 13,
          total_enrollments: 293,
          unique_users: 129
        },
        previous: {
          completed_failed: 0,
          completed_passed: 305,
          in_progress: 78,
          not_started: 130,
          total_enrollments: 513,
          unique_users: 309
        },
        delta: {
          completed_failed: { abs: 0, percent: null },
          completed_passed: { abs: -115, percent: -38 },
          in_progress: { abs: 12, percent: 15 },
          not_started: { abs: -117, percent: -90 },
          total_enrollments: { abs: -220, percent: -43 },
          unique_users: { abs: -180, percent: -58 }
        },
        guides: {
          top: [
            { title: "Torq Fundamentals", count: 69, percent: 24 },
            { title: "Hyperautomation Practitioner", count: 44, percent: 15 },
            { title: "HyperSOC Analyst", count: 16, percent: 5 },
            { title: "Create Nested Workflows", count: 14, percent: 5 },
            { title: "Use the Torq API", count: 13, percent: 4 }
          ],
          others: { count: 137, percent: 47 }
        },
        segments: {
          current: [
            { segment: "(none)", count: 2, percent: 1 },
            { segment: "Torq employees", count: 291, percent: 99 }
          ],
          previous: [
            { segment: "(none)", count: 4, percent: 1 },
            { segment: "Torq employees", count: 509, percent: 99 }
          ]
        },
        window: {
          days_back: daysBack,
          current: {
            start_iso: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString(),
            end_iso: new Date().toISOString()
          },
          previous: {
            start_iso: new Date(Date.now() - daysBack * 2 * 24 * 60 * 60 * 1000).toISOString(),
            end_iso: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
          }
        }
      },
      labs: {
        current: {
          avg_resolve_hours: 33.1167,
          avg_resolve_seconds: 119220.16,
          created_labs: 6,
          failed_checks: 22,
          failed_checks_percent: 73,
          labs_running_now: 101,
          passed_checks: 8,
          passed_checks_percent: 27,
          resolved_labs: 8,
          total_attempts: 30
        },
        previous: {
          avg_resolve_hours: 0,
          avg_resolve_seconds: 0,
          created_labs: 0,
          failed_checks: 0,
          failed_checks_percent: 0,
          labs_running_now: 0,
          passed_checks: 0,
          passed_checks_percent: 0,
          resolved_labs: 0,
          total_attempts: 0
        },
        delta: {
          avg_resolve_hours: { abs: 33.1167, percent: null },
          passed_checks_percent: { abs: 27, percent: null },
          total_attempts: { abs: 30, percent: null }
        },
        today: {
          avg_resolve_hours: 33.1167,
          avg_resolve_seconds: 119220.16,
          created_labs: 6,
          failed_checks: 22,
          failed_checks_percent: 73,
          labs_running_now: 101,
          passed_checks: 8,
          passed_checks_percent: 27,
          resolved_labs: 8,
          total_attempts: 30
        },
        trend: [
          {
            time: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
            labs_running: 103,
            created_labs: 0,
            resolved_labs: 0,
            failed_checks: 0,
            passed_checks: 0,
            total_attempts: 0,
            avg_resolve_seconds: 0
          },
          {
            time: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            labs_running: 101,
            created_labs: 1,
            resolved_labs: 1,
            failed_checks: 0,
            passed_checks: 1,
            total_attempts: 1,
            avg_resolve_seconds: 1434.4196
          },
          {
            time: new Date().toISOString(),
            labs_running: 101,
            created_labs: 1,
            resolved_labs: 1,
            failed_checks: 5,
            passed_checks: 3,
            total_attempts: 8,
            avg_resolve_seconds: 2500
          }
        ],
        window: {
          days_back: daysBack,
          current: {
            start_iso: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString(),
            end_iso: new Date().toISOString()
          },
          previous: {
            start_iso: new Date(Date.now() - daysBack * 2 * 24 * 60 * 60 * 1000).toISOString(),
            end_iso: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
          }
        }
      }
    };
  }
}

// Export for use in renderer
window.DashboardAPI = DashboardAPI;

