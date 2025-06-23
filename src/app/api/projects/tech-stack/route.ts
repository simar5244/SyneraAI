import { NextRequest, NextResponse } from 'next/server';

// Comprehensive tech stack categories and options
const techStackOptions = {
  programming: [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'Go', 'Ruby', 'PHP', 'Swift', 'Kotlin',
    'Rust', 'C++', 'Scala', 'Dart', 'R'
  ],
  frontend: [
    'React', 'Angular', 'Vue.js', 'Next.js', 'Svelte', 'Remix', 'TailwindCSS', 'Material UI',
    'Bootstrap', 'Chakra UI', 'SASS/SCSS', 'CSS Modules', 'styled-components', 'Emotion'
  ],
  backend: [
    'Node.js', 'Django', 'Flask', 'Spring Boot', 'Express.js', 'Laravel', 'ASP.NET Core',
    'Ruby on Rails', 'FastAPI', 'NestJS', 'GraphQL', 'REST API', 'gRPC'
  ],
  database: [
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'SQL Server', 'Oracle DB',
    'DynamoDB', 'Firebase Firestore', 'Cassandra', 'Neo4j', 'Elasticsearch', 'Prisma'
  ],
  cloud: [
    'AWS', 'Azure', 'Google Cloud', 'Heroku', 'Vercel', 'Netlify', 'DigitalOcean',
    'Kubernetes', 'Docker', 'Terraform', 'CloudFormation', 'Serverless'
  ],
  devops: [
    'CI/CD', 'Jenkins', 'GitHub Actions', 'GitLab CI', 'CircleCI', 'Travis CI',
    'Ansible', 'Puppet', 'Chef', 'Prometheus', 'Grafana', 'ELK Stack'
  ],
  testing: [
    'Jest', 'Testing Library', 'Cypress', 'Selenium', 'Playwright', 'Mocha', 'Chai',
    'PyTest', 'JUnit', 'TestNG', 'Mockito', 'Postman', 'K6'
  ],
  microsoft: [
    'Power Apps', 'Power BI', 'Power Automate', 'SharePoint', 'Teams', 'Office 365',
    'Excel', 'Microsoft Graph API', 'Dynamics 365', 'Azure DevOps', 'Azure Functions',
    'Azure Logic Apps', 'Microsoft Flow', 'Outlook', 'Microsoft Forms'
  ],
  productivity: [
    'Jira', 'Asana', 'Trello', 'Notion', 'Confluence', 'Smartsheet', 'Monday.com',
    'ClickUp', 'Airtable', 'Basecamp', 'Teamwork', 'Slack', 'Zoom', 'Google Workspace'
  ],
  ai_ml: [
    'TensorFlow', 'PyTorch', 'scikit-learn', 'Keras', 'NLTK', 'OpenAI API', 'Hugging Face',
    'LangChain', 'SpaCy', 'Computer Vision', 'NLP', 'Recommendation Systems'
  ],
  mobile: [
    'React Native', 'Flutter', 'iOS/Swift', 'Android/Kotlin', 'Expo', 'Xamarin',
    'SwiftUI', 'Jetpack Compose', 'Ionic', 'Capacitor', 'Mobile Web'
  ],
  analytics: [
    'Google Analytics', 'Mixpanel', 'Amplitude', 'Looker', 'Tableau', 'Metabase',
    'Snowflake', 'BigQuery', 'Apache Spark', 'Databricks', 'dbt'
  ],
  security: [
    'Auth0', 'OAuth 2.0', 'OIDC', 'JWT', 'SAML', 'SSL/TLS', 'WAF', 'Penetration Testing',
    'Vulnerability Scanning', 'SOC 2', 'GDPR', 'HIPAA', 'ISO 27001'
  ],
  other: []
};

export async function GET(req: NextRequest) {
  try {
    // Return all categories with their options
    return NextResponse.json({ success: true, techStackOptions });
  } catch (error) {
    console.error('Error fetching tech stack options:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Allow adding custom tech stack options
    const data = await req.json();
    
    if (!data.option || typeof data.option !== 'string' || data.option.trim() === '') {
      return NextResponse.json(
        { success: false, message: 'Invalid tech stack option' },
        { status: 400 }
      );
    }
    
    // Add to "Other" category if it doesn't exist
    const newOption = data.option.trim();
    
    // Check if option already exists in any category
    const exists = Object.values(techStackOptions).some(
      category => category.includes(newOption)
    );
    
    if (!exists) {
      techStackOptions.other.push(newOption);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Tech stack option added', 
      techStackOptions 
    });
  } catch (error) {
    console.error('Error adding tech stack option:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
} 