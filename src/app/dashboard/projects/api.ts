// Client-side API wrappers for dashboard project operations

export async function fetchProjects() {
  try {
    console.log('Fetching projects from API...');
    
    // Retrieve auth token
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      console.error('Authentication Error: Missing token. Please login.');
      throw new Error('Authentication Error: Missing token');
    }
    
    // Get current user data to pass as query params
    let queryParams = '';
    let currentUser: any = null;
    
    try {
      // First try to get user from localStorage
      const storedUser = localStorage.getItem('user');
      
      console.log('Stored token exists:', !!storedToken);
      console.log('Stored user exists:', !!storedUser);
      
      if (storedUser) {
        try {
          currentUser = JSON.parse(storedUser);
          console.log('Parsed user from localStorage:', 
            currentUser?.email, 
            currentUser?.role, 
            currentUser?.companyCode
          );
        } catch (e) {
          console.error('Failed to parse stored user:', e);
        }
      }
      
      // Always refresh user data from API to capture any role/companyCode updates
      if (storedToken) {
        console.log('Refreshing user data from API...');
        const userResponse = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${storedToken}` }
        });
        if (userResponse.ok) {
          const userData = await userResponse.json();
          currentUser = userData.user || userData;
          console.log('Refreshed user data:', currentUser);
        } else {
          console.warn('Could not refresh user data:', userResponse.status, userResponse.statusText);
        }
      }
      
      if (currentUser) {
        const params = new URLSearchParams();
        if (currentUser.id) params.append('userId', currentUser.id);
        if (currentUser.email) params.append('userEmail', currentUser.email);
        if (currentUser.role) params.append('userRole', currentUser.role);
        if (currentUser.companyCode) params.append('companyCode', currentUser.companyCode);
        
        // Add company_code as an alias just in case
        if (currentUser.company_code && !currentUser.companyCode) {
          params.append('companyCode', currentUser.company_code);
        }
        
        queryParams = params.toString() ? `?${params.toString()}` : '';
        
        console.log('User data for project fetch:', 
          currentUser.email, 
          currentUser.role, 
          currentUser.companyCode || currentUser.company_code
        );
        
        // Make sure we have a companyCode
        if (!currentUser.companyCode && !currentUser.company_code) {
          console.error('Missing company code in user data:', currentUser);
          throw new Error('Missing company code in user data');
        }
      } else {
        console.error('No user data available for projects API call');
        throw new Error('Authentication required to view projects');
      }
    } catch (error) {
      console.warn('Could not fetch user data for project query:', error);
      throw error;
    }
    
    // Make request with user params
    console.log(`Fetching projects with params: ${queryParams}`);
    const res = await fetch(`/api/projects${queryParams}`, { headers: { Authorization: `Bearer ${storedToken}` } });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Error response:', errorText);
      throw new Error(`Failed to fetch projects: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log('Projects fetched successfully:', data);
    return data;
  } catch (error) {
    console.error('Error in fetchProjects:', error);
    // Return empty array as fallback to prevent UI errors
    return { projects: [], error: error.message };
  }
}

export async function addNewProject(data: any) {
  try {
    console.log('Adding new project:', data);
    
    // Get current user information if not provided in data
    let userInfo = {};
    if (!data.creatorEmail || !data.companyCode) {
      try {
        // First try to get user from localStorage
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        let currentUser = null;
        
        if (storedUser) {
          try {
            currentUser = JSON.parse(storedUser);
            userInfo = {
              userEmail: currentUser.email,
              userName: currentUser.name,
              userRole: currentUser.role,
              companyCode: currentUser.companyCode || currentUser.company_code
            };
          } catch (e) {
            console.error('Failed to parse stored user:', e);
          }
        }
        
        // If we didn't get user data from localStorage, fetch from API
        if (!currentUser || !userInfo || !(userInfo as any).companyCode) {
          const userResponse = await fetch('/api/auth/me', {
            headers: storedToken ? {
              'Authorization': `Bearer ${storedToken}`
            } : {}
          });
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            // Handle both data structures
            const user = userData.user || userData;
            if (user) {
              userInfo = {
                userEmail: user.email,
                userName: user.name,
                userRole: user.role,
                companyCode: user.companyCode || user.company_code
              };
            }
          } else {
            console.error('Failed to fetch user data:', userResponse.status, userResponse.statusText);
            throw new Error('Authentication required to create projects');
          }
        }
        
        // Make sure we have a companyCode
        if (!(userInfo as any).companyCode) {
          console.error('Missing company code in user data:', userInfo);
          throw new Error('Missing company code in user data');
        }
      } catch (err) {
        console.error('Error fetching user data for project creation:', err);
        throw err;
      }
    }
    
    // Build query parameters
    const params = new URLSearchParams();
    if (userInfo && (userInfo as any).userEmail) params.append('userEmail', (userInfo as any).userEmail);
    if (userInfo && (userInfo as any).userRole) params.append('userRole', (userInfo as any).userRole);
    if (userInfo && (userInfo as any).companyCode) params.append('companyCode', (userInfo as any).companyCode);
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    
    const res = await fetch(`/api/projects${queryString}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        // Include user info directly in the body as well
        creatorEmail: data.creatorEmail || (userInfo as any).userEmail,
        creatorName: data.creatorName || (userInfo as any).userName,
        creatorRole: data.creatorRole || (userInfo as any).userRole,
        companyCode: data.companyCode || (userInfo as any).companyCode
      }),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Error response:', errorText);
      throw new Error(`Failed to add project: ${res.status} ${res.statusText}`);
    }
    
    const result = await res.json();
    console.log('Project created successfully:', result);
    
    // Wait a moment to ensure the project is fully created in the database
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Ensure we return a valid success response with projectId
    return { 
      success: true, 
      projectId: result.projectId || result._id || result.id,
      project: result.project // Return the complete project if available
    };
  } catch (error) {
    console.error('Error in addNewProject:', error);
    // Return error response instead of throwing
    return { success: false, error };
  }
}

export async function searchUsers(term: string) {
  const res = await fetch(`/api/users/search?term=${encodeURIComponent(term)}`);
  if (!res.ok) throw new Error('User search failed');
  return (await res.json()).users || [];
}

export async function addUserToProject(projectId: string, userId: string) {
  const res = await fetch(`/api/projects/${projectId}/add-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

export async function removeUserFromProject(projectId: string, userId: string) {
  const res = await fetch(`/api/projects/${projectId}/remove-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

export async function assignedTasks(projectId: string) {
  const res = await fetch(`/api/projects/${projectId}/tasks`);
  if (!res.ok) throw new Error('Failed to fetch assigned tasks');
  return (await res.json()).tasks || [];
}

export async function fetchTasks(projectId: string) {
  const res = await fetch(`/api/projects/${projectId}/tasks`);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return (await res.json()).tasks || [];
}

export async function unassignTask(taskId: string) {
  const res = await fetch(`/api/tasks/${taskId}/unassign`, { method: 'POST' });
  return res.json();
}

export async function assignTask(taskId: string, userId: string) {
  const res = await fetch(`/api/tasks/${taskId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

export async function addToolToUser(userId: string, tool: string) {
  const res = await fetch(`/api/users/${userId}/tools/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool }),
  });
  return res.json();
}

export async function removeToolFromUser(userId: string, tool: string) {
  const res = await fetch(`/api/users/${userId}/tools/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool }),
  });
  return res.json();
}
