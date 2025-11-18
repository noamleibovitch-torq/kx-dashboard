// API client for Torq webhook
class DashboardAPI {
  constructor() {
    this.webhookURL = 'https://hooks.torq.io/v1/webhooks/8f17760c-c43f-4270-b465-95dabb54389d/workflows/78f77a59-d2ee-4015-afee-3c8043bb6b31/sync';
  }

  async fetchDashboard(daysBack) {
    try {
      // CRITICAL: Use text/plain to avoid CORS issues
      const response = await fetch(this.webhookURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({ days_back: daysBack })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.body;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }
}

// Export for use in renderer
window.DashboardAPI = DashboardAPI;

