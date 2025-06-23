import { OrgNode } from '../components/NewOrgSimAIContent';

// Sample organizational data for demonstration
export const mockOrgData: OrgNode = {
  id: "ceo",
  name: "Alex Johnson",
  role: "Chief Executive Officer",
  workload: 75,
  skills: ["Leadership", "Strategy", "Business Development"],
  experience: 15,
  projects: ["Company Vision 2025", "Board Relations", "Investor Relations"],
  children: [
    {
      id: "cto",
      name: "Sam Chen",
      role: "Chief Technology Officer",
      workload: 85,
      skills: ["Software Architecture", "System Design", "Technical Leadership"],
      experience: 12,
      projects: ["Platform Modernization", "Technical Roadmap", "Security Initiative"],
      children: [
        {
          id: "engineering-lead",
          name: "Jordan Taylor",
          role: "Engineering Lead",
          workload: 95,
          skills: ["Frontend", "React", "TypeScript", "Team Leadership"],
          experience: 8,
          projects: ["Platform Modernization", "Component Library"],
          children: [
            {
              id: "frontend-dev-1",
              name: "Riley Smith",
              role: "Frontend Developer",
              workload: 100,
              skills: ["React", "TypeScript", "CSS", "UI Design"],
              experience: 3,
              projects: ["Platform Modernization", "Bug Fixes"],
              children: []
            },
            {
              id: "frontend-dev-2",
              name: "Morgan Lee",
              role: "Frontend Developer",
              workload: 85,
              skills: ["React", "JavaScript", "Tailwind", "Accessibility"],
              experience: 2,
              projects: ["Platform Modernization", "Component Library"],
              children: []
            }
          ]
        },
        {
          id: "backend-lead",
          name: "Casey Wong",
          role: "Backend Lead",
          workload: 80,
          skills: ["Node.js", "Database Design", "API Architecture", "Team Leadership"],
          experience: 7,
          projects: ["API Modernization", "Database Migration"],
          children: [
            {
              id: "backend-dev-1",
              name: "Taylor Jones",
              role: "Backend Developer",
              workload: 70,
              skills: ["Node.js", "MongoDB", "Express", "API Design"],
              experience: 4,
              projects: ["API Modernization", "Database Migration"],
              children: []
            },
            {
              id: "backend-dev-2",
              name: "Jamie Garcia",
              role: "Backend Developer",
              workload: 90,
              skills: ["Node.js", "PostgreSQL", "GraphQL"],
              experience: 2,
              projects: ["API Modernization", "Database Migration"],
              children: []
            }
          ]
        }
      ]
    },
    {
      id: "cpo",
      name: "Quinn Rivera",
      role: "Chief Product Officer",
      workload: 65,
      skills: ["Product Strategy", "User Research", "Market Analysis"],
      experience: 9,
      projects: ["Product Roadmap", "Market Research"],
      children: [
        {
          id: "product-manager",
          name: "Jordan Patel",
          role: "Product Manager",
          workload: 75,
          skills: ["Product Management", "User Stories", "Roadmapping"],
          experience: 5,
          projects: ["Feature Launch Q1", "User Research"],
          children: []
        },
        {
          id: "ux-designer",
          name: "Reagan Kim",
          role: "UX Designer",
          workload: 40,
          skills: ["UI Design", "User Research", "Figma", "Prototyping"],
          experience: 3,
          projects: ["Feature Launch Q1", "Design System"],
          children: []
        }
      ]
    }
  ]
};

// Optimized scenario data from AI recommendations
export const optimizedOrgData: OrgNode = {
  id: "ceo",
  name: "Alex Johnson",
  role: "Chief Executive Officer",
  workload: 70,
  skills: ["Leadership", "Strategy", "Business Development"],
  experience: 15,
  projects: [
    { name: "Company Vision 2025", allocation: 30 },
    { name: "Board Relations", allocation: 25 },
    { name: "Investor Relations", allocation: 15 }
  ],
  children: [
    {
      id: "cto",
      name: "Sam Chen",
      role: "Chief Technology Officer",
      workload: 75,
      skills: ["Software Architecture", "System Design", "Technical Leadership"],
      experience: 12,
      projects: [
        { name: "Platform Modernization", allocation: 30 },
        { name: "Technical Roadmap", allocation: 30 },
        { name: "Security Initiative", allocation: 15 }
      ],
      children: [
        {
          id: "engineering-director",
          name: "Jordan Taylor",
          role: "Engineering Director",
          workload: 70,
          skills: ["Technical Leadership", "Architecture", "Team Management"],
          experience: 8,
          projects: [
            { name: "Platform Modernization", allocation: 40 },
            { name: "Component Library", allocation: 30 }
          ],
          children: [
            {
              id: "frontend-lead",
              name: "Riley Smith",
              role: "Frontend Lead",
              workload: 75,
              skills: ["React", "TypeScript", "CSS", "Team Leadership"],
              experience: 3,
              projects: [
                { name: "Platform Modernization", allocation: 50 },
                { name: "Component Library", allocation: 25 }
              ],
              children: [
                {
                  id: "frontend-dev-2",
                  name: "Morgan Lee",
                  role: "Frontend Developer",
                  workload: 70,
                  skills: ["React", "JavaScript", "Tailwind", "Accessibility"],
                  experience: 2,
                  projects: [
                    { name: "Platform Modernization", allocation: 40 },
                    { name: "Component Library", allocation: 30 }
                  ]
                },
                {
                  id: "new-frontend-dev",
                  name: "New Hire",
                  role: "Frontend Developer",
                  workload: 60,
                  skills: ["React", "TypeScript", "UI Design"],
                  experience: 1,
                  projects: [
                    { name: "Platform Modernization", allocation: 60 }
                  ]
                }
              ]
            },
            {
              id: "backend-lead",
              name: "Casey Wong",
              role: "Backend Lead",
              workload: 65,
              skills: ["Node.js", "Database Design", "API Architecture", "Team Leadership"],
              experience: 7,
              projects: [
                { name: "API Modernization", allocation: 40 },
                { name: "Database Migration", allocation: 25 }
              ],
              children: [
                {
                  id: "backend-dev-1",
                  name: "Taylor Jones",
                  role: "Backend Developer",
                  workload: 70,
                  skills: ["Node.js", "MongoDB", "Express", "API Design"],
                  experience: 4,
                  projects: [
                    { name: "API Modernization", allocation: 45 },
                    { name: "Database Migration", allocation: 25 }
                  ]
                },
                {
                  id: "backend-dev-2",
                  name: "Jamie Garcia",
                  role: "Backend Developer",
                  workload: 75,
                  skills: ["Node.js", "PostgreSQL", "GraphQL"],
                  experience: 2,
                  projects: [
                    { name: "API Modernization", allocation: 50 },
                    { name: "Database Migration", allocation: 25 }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: "cpo",
      name: "Quinn Rivera",
      role: "Chief Product Officer",
      workload: 65,
      skills: ["Product Strategy", "User Research", "Market Analysis"],
      experience: 9,
      projects: [
        { name: "Product Roadmap", allocation: 40 },
        { name: "Market Research", allocation: 25 }
      ],
      children: [
        {
          id: "product-manager",
          name: "Jordan Patel",
          role: "Product Manager",
          workload: 75,
          skills: ["Product Management", "User Stories", "Roadmapping"],
          experience: 5,
          projects: [
            { name: "Feature Launch Q1", allocation: 60 },
            { name: "User Research", allocation: 15 }
          ],
          children: []
        },
        {
          id: "ux-designer",
          name: "Reagan Kim",
          role: "UX Designer",
          workload: 65,
          skills: ["UI Design", "User Research", "Figma", "Prototyping"],
          experience: 3,
          projects: [
            { name: "Feature Launch Q1", allocation: 40 },
            { name: "Design System", allocation: 25 }
          ],
          children: []
        }
      ]
    }
  ]
};

// Function to generate random org data for the demo
export function generateRandomOrgData(): OrgNode {
  // Sample names
  const firstNames = ['John', 'Jane', 'Alex', 'Sarah', 'Michael', 'Emma', 'David', 'Lisa', 'Robert', 'Jennifer'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson'];
  
  // Sample roles
  const roles = ['CEO', 'CTO', 'CFO', 'COO', 'VP Engineering', 'VP Product', 'Engineering Manager', 
                'Product Manager', 'Developer', 'Designer', 'QA Engineer', 'DevOps Engineer'];
  
  // Sample skills
  const skills = ['Leadership', 'Management', 'Strategy', 'React', 'JavaScript', 'TypeScript', 'Node.js', 
                  'UI/UX Design', 'Product', 'Finance', 'Operations', 'Communication', 'Team Building'];
  
  // Helper to get random item from array
  const getRandomItem = <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)];
  
  // Helper to get random number between min and max
  const getRandomNumber = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
  
  // Helper to generate a random employee
  const generateEmployee = (id: string, role: string, depth: number): OrgNode => {
    const firstName = getRandomItem(firstNames);
    const lastName = getRandomItem(lastNames);
    
    // Generate random skills
    const numSkills = getRandomNumber(2, 4);
    const employeeSkills: string[] = [];
    for (let i = 0; i < numSkills; i++) {
      const skill = getRandomItem(skills);
      if (!employeeSkills.includes(skill)) {
        employeeSkills.push(skill);
      }
    }
    
    // Generate random projects
    const numProjects = getRandomNumber(1, 2);
    const employeeProjects: string[] = [];
    for (let i = 0; i < numProjects; i++) {
      employeeProjects.push(`Project ${getRandomNumber(1, 10)}`);
    }
    
    const employee: OrgNode = {
      id,
      name: `${firstName} ${lastName}`,
      role,
      workload: getRandomNumber(30, 100),
      skills: employeeSkills,
      experience: getRandomNumber(1, 15),
      projects: employeeProjects,
      children: []
    };
    
    // Generate direct reports if we're not at max depth
    if (depth < 3) {
      const numReports = depth === 0 ? getRandomNumber(3, 5) : depth === 1 ? getRandomNumber(2, 4) : getRandomNumber(0, 2);
      
      for (let i = 0; i < numReports; i++) {
        const reportRole = depth === 0 ? `Chief ${getRandomItem(['Technology', 'Product', 'Financial', 'Operations'])} Officer` : 
                          depth === 1 ? `${getRandomItem(['Senior', 'Lead'])} ${getRandomItem(['Manager', 'Director'])}` : 
                          getRandomItem(roles.slice(7)); // Lower level roles
                          
        const reportId = `${id}-${i + 1}`;
        employee.children.push(generateEmployee(reportId, reportRole, depth + 1));
      }
    }
    
    return employee;
  };
  
  // Generate org chart starting with CEO
  return generateEmployee('ceo', 'Chief Executive Officer', 0);
} 