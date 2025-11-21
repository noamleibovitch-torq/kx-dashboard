// API client for Torq webhook
class DashboardAPI {
  constructor() {
    this.webhookURL = 'https://hooks.torq.io/v1/webhooks/8f17760c-c43f-4270-b465-95dabb54389d/workflows/78f77a59-d2ee-4015-afee-3c8043bb6b31/sync';
    this.authSecret = 'i9HpRTZLL4sq7AJW1qmpKqZsb85qB1Su9vcyvCayidk';
    // Set to true to use mock data for testing
    this.useMockData = false; // Disabled - will fetch from real webhook
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
    // Use mock data if enabled
    if (this.useMockData) {
      console.log('Using mock data for testing');
      return {
        ...this.getMockData(daysBack),
        ...this.getMockDocumentationData()
      };
    }

    try {
      // Prepare both queries
      const academyQuery = this.prepareQuery(daysBack);
      const { monthStart, documentationQuery } = this.prepareDocumentationQuery(docPeriod);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

      console.log('Sending both academy and documentation queries...');

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
        }
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

