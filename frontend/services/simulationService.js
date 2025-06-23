import { apiClient } from './apiClient';

export const simulationService = {
  /**
   * Get all available simulation types
   */
  async getSimulationTypes() {
    try {
      const response = await apiClient.get('/simulations/types');
      return response.data;
    } catch (error) {
      console.error('Error fetching simulation types:', error);
      throw error;
    }
  },

  /**
   * Get all simulation scenarios for the current user
   * @param {Object} params - Query parameters
   * @param {boolean} params.is_template - Filter for templates
   */
  async getSimulationScenarios(params = {}) {
    try {
      const response = await apiClient.get('/simulations/scenarios', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching simulation scenarios:', error);
      throw error;
    }
  },

  /**
   * Get a specific simulation scenario by ID
   * @param {string} id - Scenario ID
   */
  async getSimulationScenario(id) {
    try {
      const response = await apiClient.get(`/simulations/scenarios/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching simulation scenario ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create a new simulation scenario
   * @param {Object} scenario - The scenario data
   */
  async createSimulation(scenario) {
    try {
      const response = await apiClient.post('/simulations/scenarios', scenario);
      return response.data;
    } catch (error) {
      console.error('Error creating simulation scenario:', error);
      throw error;
    }
  },

  /**
   * Update an existing simulation scenario
   * @param {string} id - Scenario ID
   * @param {Object} scenario - Updated scenario data
   */
  async updateSimulation(id, scenario) {
    try {
      const response = await apiClient.put(`/simulations/scenarios/${id}`, scenario);
      return response.data;
    } catch (error) {
      console.error(`Error updating simulation scenario ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete a simulation scenario
   * @param {string} id - Scenario ID
   */
  async deleteSimulation(id) {
    try {
      await apiClient.delete(`/simulations/scenarios/${id}`);
      return true;
    } catch (error) {
      console.error(`Error deleting simulation scenario ${id}:`, error);
      throw error;
    }
  },

  /**
   * Run a simulation based on a scenario
   * @param {string} scenarioId - ID of the scenario to run
   * @param {Object} organizationData - Optional organization data to use
   */
  async runSimulation(scenarioId, organizationData = null) {
    try {
      const response = await apiClient.post('/simulations/run', { 
        scenario_id: scenarioId,
        organization_data: organizationData 
      });
      return response.data;
    } catch (error) {
      console.error('Error running simulation:', error);
      throw error;
    }
  },

  /**
   * Get all simulation results, optionally filtered by scenario
   * @param {Object} params - Query parameters
   * @param {string} params.scenario_id - Optional scenario ID filter
   */
  async getSimulationResults(params = {}) {
    try {
      const response = await apiClient.get('/simulations/results', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching simulation results:', error);
      throw error;
    }
  },

  /**
   * Get a specific simulation result by ID
   * @param {string} id - Result ID
   */
  async getSimulationResult(id) {
    try {
      const response = await apiClient.get(`/simulations/results/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching simulation result ${id}:`, error);
      throw error;
    }
  },

  /**
   * Export simulation results as CSV or PDF
   * @param {string} id - Result ID
   * @param {string} format - Export format ('csv' or 'pdf')
   */
  async exportSimulationResult(id, format = 'csv') {
    try {
      const response = await apiClient.get(`/simulations/results/${id}/export`, {
        params: { format },
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `simulation-${id}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      return true;
    } catch (error) {
      console.error(`Error exporting simulation result ${id}:`, error);
      throw error;
    }
  }
}; 