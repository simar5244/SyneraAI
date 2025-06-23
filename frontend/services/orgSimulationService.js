import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const orgSimulationService = {
  /**
   * Get the full organizational structure with workload information
   */
  getOrgStructure: async () => {
    try {
      const response = await axios.get(`${API_URL}/simulation/org-structure`, {
        withCredentials: true
      });
      
      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to retrieve org structure');
      }
    } catch (error) {
      console.error('Error fetching org structure:', error);
      throw error;
    }
  },

  /**
   * Simulate the reallocation of an employee to a new manager
   * @param {string} employeeId - The ID of the employee to reallocate
   * @param {string} newManagerId - The ID of the new manager
   */
  simulateReallocation: async (employeeId, newManagerId) => {
    try {
      const response = await axios.post(
        `${API_URL}/simulation/reallocate/${employeeId}`,
        { new_manager_id: newManagerId },
        { withCredentials: true }
      );
      
      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to simulate reallocation');
      }
    } catch (error) {
      console.error('Error simulating reallocation:', error);
      throw error;
    }
  },

  /**
   * Simulate the deletion of an employee and redistribution of their work
   * @param {string} employeeId - The ID of the employee to remove
   */
  simulateDeletion: async (employeeId) => {
    try {
      const response = await axios.post(
        `${API_URL}/simulation/simulate-deletion/${employeeId}`,
        {},
        { withCredentials: true }
      );
      
      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to simulate deletion');
      }
    } catch (error) {
      console.error('Error simulating deletion:', error);
      throw error;
    }
  },

  /**
   * Update an employee's position in the organization
   * @param {string} employeeId - The ID of the employee to update
   * @param {string} newManagerId - The ID of the new manager
   */
  updatePosition: async (employeeId, newManagerId) => {
    try {
      const response = await axios.put(
        `${API_URL}/employees/${employeeId}/manager`,
        { manager_id: newManagerId },
        { withCredentials: true }
      );
      
      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to update position');
      }
    } catch (error) {
      console.error('Error updating position:', error);
      throw error;
    }
  }
}; 