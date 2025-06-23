#!/bin/bash

# Set up color outputs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Installing dependencies for AI-powered Report Generation System ===${NC}"
echo -e "${YELLOW}This script will install all required npm packages and verify API keys${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm not found. Please install Node.js and npm first.${NC}"
    exit 1
fi

# Install npm dependencies
echo -e "\n${GREEN}Installing npm dependencies...${NC}"
npm install

# Check for required API keys in .env.local
echo -e "\n${GREEN}Checking required API keys...${NC}"

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}Creating .env.local file...${NC}"
    touch .env.local
fi

# Function to check if a key exists in .env.local
check_key() {
    if grep -q "^$1=" .env.local; then
        echo -e "${GREEN}✓ $1 is configured${NC}"
    else
        echo -e "${RED}✗ $1 is missing. Please add it to .env.local${NC}"
        # Add a template line to .env.local if it doesn't exist
        echo "$1=" >> .env.local
    fi
}

# Check essential API keys
check_key "MONGODB_URI"
check_key "MONGODB_DB_NAME"
check_key "GEMINI_API_KEY"
check_key "CLAUDE_API_KEY"
check_key "NEXTAUTH_URL"
check_key "NEXTAUTH_SECRET"
check_key "INTERNAL_API_KEY"
check_key "ADMIN_KEY"

# Check for MongoDB connection
echo -e "\n${GREEN}Checking MongoDB connection...${NC}"
MONGODB_URI=$(grep "^MONGODB_URI=" .env.local | cut -d '=' -f2)

if [ -z "$MONGODB_URI" ]; then
    echo -e "${RED}MongoDB URI not found in .env.local${NC}"
else
    echo -e "${YELLOW}MongoDB URI found. Attempting connection...${NC}"
    # Use a temporary Node.js script to test MongoDB connection
    NODE_CODE="
    const { MongoClient } = require('mongodb');
    async function testConnection() {
        const client = new MongoClient('$MONGODB_URI');
        try {
            await client.connect();
            console.log('MongoDB connection successful!');
            return true;
        } catch(e) {
            console.error('MongoDB connection failed:', e.message);
            return false;
        } finally {
            await client.close();
        }
    }
    testConnection().then(success => process.exit(success ? 0 : 1));
    "
    
    if node -e "$NODE_CODE"; then
        echo -e "${GREEN}MongoDB connection verified!${NC}"
    else
        echo -e "${RED}MongoDB connection failed. Please check your connection string.${NC}"
    fi
fi

# Check if API keys are valid
echo -e "\n${GREEN}Verifying API keys...${NC}"

# Check Claude API key
CLAUDE_API_KEY=$(grep "^CLAUDE_API_KEY=" .env.local | cut -d '=' -f2)
if [ -z "$CLAUDE_API_KEY" ]; then
    echo -e "${RED}Claude API key not found in .env.local${NC}"
else
    echo -e "${YELLOW}Testing Claude API key...${NC}"
    
    # Use curl to test the Claude API key
    CLAUDE_RESPONSE=$(curl -s -X POST https://api.anthropic.com/v1/messages \
        -H "x-api-key: $CLAUDE_API_KEY" \
        -H "anthropic-version: 2023-06-01" \
        -H "content-type: application/json" \
        -d '{"model":"claude-3-sonnet-20240229","max_tokens":10,"messages":[{"role":"user","content":"Say hello"}]}'
    )
    
    if echo "$CLAUDE_RESPONSE" | grep -q "\"role\":\"assistant\""; then
        echo -e "${GREEN}Claude API key is valid!${NC}"
    else
        echo -e "${RED}Claude API key verification failed.${NC}"
        echo -e "${YELLOW}Response: ${CLAUDE_RESPONSE}${NC}"
    fi
fi

# Check Gemini API key
GEMINI_API_KEY=$(grep "^GEMINI_API_KEY=" .env.local | cut -d '=' -f2)
if [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${RED}Gemini API key not found in .env.local${NC}"
else
    echo -e "${YELLOW}Testing Gemini API key...${NC}"
    
    # Use curl to test the Gemini API key
    GEMINI_RESPONSE=$(curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=$GEMINI_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"contents":[{"parts":[{"text":"Say hello"}]}]}'
    )
    
    if echo "$GEMINI_RESPONSE" | grep -q "\"text\":"; then
        echo -e "${GREEN}Gemini API key is valid!${NC}"
    else
        echo -e "${RED}Gemini API key verification failed.${NC}"
        echo -e "${YELLOW}Response: ${GEMINI_RESPONSE}${NC}"
    fi
fi

echo -e "\n${GREEN}Setup complete! You can now run the application with:${NC}"
echo -e "  npm run dev"
echo -e "${YELLOW}Make sure to properly configure all API keys in .env.local${NC}"
echo -e "${YELLOW}For full functionality, ensure both Claude and Gemini API keys are valid${NC}" 