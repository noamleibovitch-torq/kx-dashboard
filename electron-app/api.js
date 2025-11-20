// API client for Torq webhook
class DashboardAPI {
  constructor() {
    this.webhookURL = 'https://hooks.torq.io/v1/webhooks/8f17760c-c43f-4270-b465-95dabb54389d/workflows/78f77a59-d2ee-4015-afee-3c8043bb6b31/sync';
    // Set to true to use mock data for testing
    this.useMockData = false; // Disabled - will fetch from real webhook
  }

  async fetchDashboard(daysBack) {
    // Use mock data if enabled
    if (this.useMockData) {
      console.log('Using mock data for testing');
      return this.getMockData(daysBack);
    }

    try {
      // CRITICAL: Use text/plain to avoid CORS issues
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 300 second (5 minute) timeout

      const response = await fetch(this.webhookURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({ days_back: daysBack }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // Response is directly the data, not wrapped in "body"
      return data;
    } catch (error) {
      console.error('API Error:', error);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - webhook took too long to respond');
      }
      throw error;
    }
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

