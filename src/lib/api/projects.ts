// Client-side API wrappers for dashboard project operations

export async function fetchProjects() {
  try {
    console.log('Fetching projects from API with permission filtering...');
    
    // Attempt to get current user data to pass in query params
    let queryParams = '';
    let userData = null;
    
    try {
      const userResponse = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (userResponse.ok) {
        const userResult = await userResponse.json();
        userData = userResult.user;
        
        if (userData) {
          const params = new URLSearchParams();
          if (userData.id) params.append('userId', userData.id);
          if (userData.email) params.append('userEmail', userData.email);
          if (userData.role) params.append('userRole', userData.role);
          queryParams = params.toString() ? `?${params.toString()}` : '';
          console.log('User data for project filtering:', userData);
        }
      } else {
        console.warn('Failed to fetch user data for permission filtering:', userResponse.status);
      }
    } catch (error) {
      console.warn('Could not fetch user data for project query:', error);
    }
    
    // Make request with user params if available
    const timestamp = new Date().getTime(); // Add timestamp to bust cache
    const res = await fetch(`/api/projects${queryParams}${queryParams ? '&' : '?'}t=${timestamp}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Error response:', errorText);
      throw new Error(`Failed to fetch projects: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    
    if (data.projects) {
      // Apply any additional client-side filtering if needed
      console.log(`Projects fetched successfully: ${data.projects.length}`);
      
      // Log user access level for debugging
      if (userData) {
        const isTopManagement = ['top_management_tier_1', 'top_management_tier_2', 'top_management_tier_3'].includes(userData.role);
        console.log(`User role: ${userData.role}, Is top management: ${isTopManagement}`);
      }
      
      // Log which projects are management projects for debugging
      data.projects.forEach((p: any) => {
        const isManagement = p.isManagementProject || 
                            (p.createdByRole && ['top_management_tier_1', 'top_management_tier_2', 'top_management_tier_3'].includes(p.createdByRole));
        if (isManagement) {
          console.log(`Management project: ${p.project_title || p.name || 'Unnamed'}`);
        }
      });
    }
    
    return data;
  } catch (error) {
    console.error('Error in fetchProjects:', error);
    // Return empty array as fallback to prevent UI errors
    return { projects: [] };
  }
}

export async function addNewProject(data: any) {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
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
