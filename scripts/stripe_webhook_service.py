#!/usr/bin/env python3
"""
Stripe Webhook Service
A robust webhook handler for Stripe events with extremely detailed logging.
"""

import os
import json
import logging
import sys
import time
from datetime import datetime
from http import HTTPStatus
from typing import Dict, Any, Optional, List, Union
import traceback

import uvicorn
from fastapi import FastAPI, Request, Response, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
import stripe
from pymongo import MongoClient
from pymongo.database import Database
from dotenv import load_dotenv
import sys

# Load variables from .env.local
env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.local')
if os.path.exists(env_file):
    load_dotenv(env_file)
    logger = logging.getLogger("stripe_webhook")
    logger.info(f"✅ Loaded .env.local from {env_file}")
else:
    logger = logging.getLogger("stripe_webhook")
    logger.error(f"❌ .env.local not found at {env_file}")
    sys.exit(1)

# Configure extremely detailed logging
class DetailedFormatter(logging.Formatter):
    def format(self, record):
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        return f"{timestamp} | {record.levelname:8} | {record.name:20} | {record.getMessage()}"

# Setup logging with detailed formatter
logger.setLevel(logging.DEBUG)

# Console handler with detailed formatting
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.DEBUG)
console_handler.setFormatter(DetailedFormatter())

# File handler with detailed formatting
file_handler = logging.FileHandler("stripe_webhook_detailed.log")
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(DetailedFormatter())

logger.addHandler(console_handler)
logger.addHandler(file_handler)

# Initialize startup logging
logger.info("=" * 80)
logger.info("🚀 STRIPE WEBHOOK SERVICE INITIALIZATION STARTING")
logger.info("=" * 80)

# Enhanced environment loading with detailed logging
def load_environment_variables():
    logger.info("📁 Starting environment variable loading process...")
    
    # Try multiple possible locations for .env.local
    possible_paths = [
        # Current directory
        os.path.join(os.getcwd(), '.env.local'),
        # Parent directory
        os.path.join(os.path.dirname(__file__), '.env.local'),
        # Two levels up (common structure)
        os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.local'),
        # Root project directory
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env.local'),
    ]
    
    logger.debug(f"🔍 Searching for .env.local in {len(possible_paths)} possible locations:")
    for i, path in enumerate(possible_paths, 1):
        logger.debug(f"   {i}. {path}")
    
    env_loaded = False
    for path in possible_paths:
        logger.debug(f"🔎 Checking path: {path}")
        if os.path.exists(path):
            logger.info(f"✅ Found .env.local at: {path}")
            logger.debug(f"📊 File size: {os.path.getsize(path)} bytes")
            logger.debug(f"📅 Last modified: {datetime.fromtimestamp(os.path.getmtime(path))}")
            
            # Load the file
            load_dotenv(path)
            logger.info(f"🔄 Successfully loaded environment variables from {path}")
            env_loaded = True
            
            # Log file contents (safely, without exposing secrets)
            try:
                with open(path, 'r') as f:
                    lines = f.readlines()
                logger.debug(f"📝 .env.local contains {len(lines)} lines:")
                for i, line in enumerate(lines, 1):
                    if '=' in line and not line.strip().startswith('#'):
                        key = line.split('=')[0].strip()
                        logger.debug(f"   Line {i}: {key}=***REDACTED***")
                    else:
                        logger.debug(f"   Line {i}: {line.strip()}")
            except Exception as e:
                logger.warning(f"⚠️ Could not read .env.local contents: {e}")
            break
        else:
            logger.debug(f"❌ Not found: {path}")
    
    if not env_loaded:
        logger.warning("⚠️ No .env.local file found in any of the expected locations")
        logger.info("🔄 Falling back to system environment variables")
    
    # Also load default .env if it exists
    default_env_path = os.path.join(os.getcwd(), '.env')
    if os.path.exists(default_env_path):
        logger.info(f"📁 Also loading default .env from: {default_env_path}")
        load_dotenv(default_env_path)
    
    return env_loaded

# Load environment variables
env_loaded = load_environment_variables()

# Configuration with detailed logging
class Config:
    def __init__(self):
        logger.info("⚙️ Initializing configuration...")
        
        # Port configuration
        self.PORT = int(os.getenv("WEBHOOK_PORT", 3333))
        logger.info(f"🌐 WEBHOOK_PORT: {self.PORT} (source: {'env var' if os.getenv('WEBHOOK_PORT') else 'default'})")
        
        # Stripe secret key
        self.STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
        if self.STRIPE_SECRET_KEY:
            logger.info(f"🔑 STRIPE_SECRET_KEY: Found (length: {len(self.STRIPE_SECRET_KEY)} chars, starts with: {self.STRIPE_SECRET_KEY[:7]}...)")
        else:
            logger.error("❌ STRIPE_SECRET_KEY: NOT FOUND - This is required!")
        
        # Stripe webhook secret
        default_webhook_secret = "whsec_4ff06f9221fffc56e4ea5a57714183e6162b7a83a5f25fcca80c83f798c68f83"
        self.STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", default_webhook_secret)
        is_default = self.STRIPE_WEBHOOK_SECRET == default_webhook_secret
        logger.info(f"🔐 STRIPE_WEBHOOK_SECRET: {'Using default' if is_default else 'Custom value'} (starts with: {self.STRIPE_WEBHOOK_SECRET[:10]}...)")
        
        # MongoDB URI
        self.MONGODB_URI = os.getenv("MONGODB_URI")
        if self.MONGODB_URI:
            # Safely log MongoDB URI without exposing credentials
            uri_parts = self.MONGODB_URI.split('@')
            if len(uri_parts) > 1:
                logger.info(f"🗄️ MONGODB_URI: Found (connects to: {uri_parts[-1]})")
            else:
                logger.info(f"🗄️ MONGODB_URI: Found (local connection)")
        else:
            logger.error("❌ MONGODB_URI: NOT FOUND - This is required!")
        
        # Host configuration
        self.HOST = "0.0.0.0"
        logger.info(f"🏠 HOST: {self.HOST}")
        
        logger.info("✅ Configuration initialization complete")

# Initialize configuration
config = Config()

# Initialize Stripe with detailed logging
logger.info("💳 Initializing Stripe API...")
stripe.api_key = config.STRIPE_SECRET_KEY
if config.STRIPE_SECRET_KEY:
    logger.info("✅ Stripe API key configured successfully")
else:
    logger.error("❌ Stripe API key not configured - service will not work properly")

# Initialize FastAPI with detailed logging
logger.info("🚀 Initializing FastAPI application...")
app = FastAPI(
    title="Stripe Webhook Service", 
    version="1.0.0",
    description="Enhanced Stripe webhook handler with detailed logging"
)
logger.info("✅ FastAPI application initialized")

# CORS middleware with logging
logger.info("🌐 Adding CORS middleware...")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info("✅ CORS middleware configured")

# Enhanced MongoDB connection with detailed logging
def get_db_connection(company_code: str) -> Database:
    """
    Connect to MongoDB for the given company. DB name: company_<companycode>.
    """
    if not company_code:
        logger.error("❌ company_code is required for DB connection")
        raise ValueError("company_code missing")
    db_name = f"company_{company_code.lower()}"
    try:
        logger.info(f"🗄 Connecting to MongoDB at {config.MONGODB_URI}, DB: {db_name}")
        client = MongoClient(config.MONGODB_URI)
        return client[db_name]
    except Exception as e:
        logger.error(f"❌ MongoDB connection error for {db_name}: {e}")
        logger.debug(traceback.format_exc())
        raise

# Enhanced request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    request_id = str(int(start_time * 1000))
    
    logger.info("=" * 60)
    logger.info(f"📥 INCOMING REQUEST [{request_id}]")
    logger.info("=" * 60)
    logger.info(f"🌐 Method: {request.method}")
    logger.info(f"🔗 URL: {request.url}")
    logger.info(f"🏠 Client: {request.client.host if request.client else 'Unknown'}")
    logger.info(f"🕐 Timestamp: {datetime.now().isoformat()}")
    
    # Log headers in detail
    logger.info("📋 Headers:")
    for name, value in request.headers.items():
        if name.lower() in ['authorization', 'stripe-signature']:
            logger.info(f"   {name}: {value[:20]}...***REDACTED***")
        else:
            logger.info(f"   {name}: {value}")
    
    # Log request body
    try:
        body = await request.body()
        if body:
            logger.info(f"📄 Body length: {len(body)} bytes")
            if request.url.path == "/webhook":
                logger.debug(f"📄 Raw body (first 200 chars): {body[:200].decode('utf-8', errors='ignore')}...")
            else:
                try:
                    body_str = body.decode('utf-8')
                    logger.debug(f"📄 Body content: {body_str}")
                except:
                    logger.debug(f"📄 Body content (bytes): {body}")
        else:
            logger.info("📄 Body: Empty")
    except Exception as e:
        logger.warning(f"⚠️ Could not read request body: {str(e)}")
    
    # Process the request
    logger.info(f"🔄 Processing request [{request_id}]...")
    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        
        logger.info("=" * 60)
        logger.info(f"📤 RESPONSE [{request_id}]")
        logger.info("=" * 60)
        logger.info(f"✅ Status: {response.status_code}")
        logger.info(f"⏱️ Processing time: {process_time:.2f}ms")
        logger.info(f"📊 Response headers:")
        for name, value in response.headers.items():
            logger.info(f"   {name}: {value}")
        
        return response
        
    except Exception as e:
        process_time = (time.time() - start_time) * 1000
        logger.error("=" * 60)
        logger.error(f"❌ REQUEST FAILED [{request_id}]")
        logger.error("=" * 60)
        logger.error(f"💥 Error: {str(e)}")
        logger.error(f"⏱️ Failed after: {process_time:.2f}ms")
        logger.error(f"🔍 Exception type: {type(e).__name__}")
        logger.debug(f"📚 Full traceback: {traceback.format_exc()}")
        raise

# Health check endpoint with detailed logging
@app.get("/health")
async def health_check():
    logger.info("🏥 Health check endpoint called")
    
    health_data = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "stripe-webhook-service",
        "version": "1.0.0",
        "environment": {
            "stripe_configured": bool(config.STRIPE_SECRET_KEY),
            "mongodb_configured": bool(config.MONGODB_URI),
            "env_file_loaded": env_loaded
        }
    }
    
    logger.info(f"✅ Health check response: {json.dumps(health_data, indent=2)}")
    return health_data

# Enhanced test webhook endpoint
@app.post("/test-webhook")
async def test_webhook(companyCode: str, isPaid: str = "true", planName: str = "premium"):
    """
    Test endpoint to update user status manually
    companyCode: The company code (e.g., 'acme')
    isPaid: 'true' or 'false' as string
    planName: One of the 3 plan options
    """
    logger.info("🧪 TEST WEBHOOK ENDPOINT CALLED")
    logger.info("=" * 50)
    logger.info(f"📝 Input parameters:")
    logger.info(f"   Company Code: {companyCode}")
    logger.info(f"   Is Paid: {isPaid}")
    logger.info(f"   Plan Name: {planName}")
    
    try:
        # Convert and validate inputs
        logger.info("🔄 Processing input parameters...")
        is_paid_bool = isPaid.lower() == 'true'
        logger.info(f"✅ Converted isPaid '{isPaid}' to boolean: {is_paid_bool}")
        
        plan_name_lower = planName.lower()
        logger.info(f"✅ Converted planName '{planName}' to lowercase: '{plan_name_lower}'")
        
        # Update company users
        logger.info("🔄 Calling update_company_users function...")
        result = update_company_users(
            companyCode, 
            is_paid_bool, 
            plan_name_lower
        )
        
        response_data = {
            "success": True,
            "message": "Test webhook processed successfully",
            "companyCode": companyCode,
            "isPaid": is_paid_bool,
            "planName": plan_name_lower,
            "modifiedCount": result.modified_count if result else 0,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        logger.info("✅ Test webhook completed successfully")
        logger.info(f"📊 Response data: {json.dumps(response_data, indent=2)}")
        
        return response_data
        
    except Exception as e:
        logger.error("❌ Test webhook failed")
        logger.error(f"💥 Error: {str(e)}")
        logger.error(f"🔍 Exception type: {type(e).__name__}")
        logger.debug(f"📚 Full traceback: {traceback.format_exc()}")
        
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail=f"Test webhook failed: {str(e)}"
        )

# Enhanced main webhook endpoint
@app.post("/webhook")
async def webhook_received(
    request: Request,
    stripe_signature: str = Header(..., alias="Stripe-Signature")
):
    logger.info("🎣 STRIPE WEBHOOK RECEIVED")
    logger.info("=" * 50)
    
    try:
        # Get payload
        logger.info("📥 Reading webhook payload...")
        payload = await request.body()
        logger.info(f"✅ Payload received: {len(payload)} bytes")
        
        # Verify signature
        logger.info("🔐 Verifying webhook signature...")
        logger.debug(f"   Signature header: {stripe_signature[:20]}...***REDACTED***")
        logger.debug(f"   Webhook secret configured: {'Yes' if config.STRIPE_WEBHOOK_SECRET else 'No'}")
        
        try:
            event = stripe.Webhook.construct_event(
                payload, stripe_signature, config.STRIPE_WEBHOOK_SECRET
            )
            logger.info("✅ Webhook signature verified successfully")
            
        except ValueError as e:
            logger.error("❌ Invalid payload received")
            logger.error(f"💥 ValueError: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid payload")
            
        except stripe.error.SignatureVerificationError as e:
            logger.error("❌ Webhook signature verification failed")
            logger.error(f"💥 SignatureVerificationError: {str(e)}")
            logger.debug(f"📚 Full traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        # Log event details
        event_type = event.get("type", "unknown")
        event_id = event.get("id", "N/A")
        logger.info(f"📋 Event Details:")
        logger.info(f"   Type: {event_type}")
        logger.info(f"   ID: {event_id}")
        logger.info(f"   Created: {datetime.fromtimestamp(event.get('created', 0)).isoformat()}")
        
        # Log event data structure
        if "data" in event and "object" in event["data"]:
            obj = event["data"]["object"]
            logger.info(f"   Object Type: {obj.get('object', 'unknown')}")
            logger.info(f"   Object ID: {obj.get('id', 'N/A')}")
        
        # Process the event
        logger.info("🔄 Processing Stripe event...")
        await process_stripe_event(event)
        
        logger.info("✅ Webhook processed successfully")
        return {"status": "success", "event_id": event_id, "event_type": event_type}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("❌ Unexpected webhook processing error")
        logger.error(f"💥 Error: {str(e)}")
        logger.error(f"🔍 Exception type: {type(e).__name__}")
        logger.debug(f"📚 Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=400, detail=str(e))

async def process_stripe_event(event: Dict[str, Any]):
    event_type = event["type"]
    logger.info(f"🔄 PROCESSING STRIPE EVENT: {event_type}")
    logger.info("-" * 40)
    
    try:
        # Handle subscription schedule events
        if event_type.startswith("subscription_schedule."):
            logger.info("📊 Event category: Subscription Schedule")
            schedule_obj = event.get("data", {}).get("object", {})
            subscription_id = schedule_obj.get("subscription")
            if subscription_id:
                logger.info(f"🔍 Retrieving subscription {subscription_id} for schedule event")
                subscription = stripe.Subscription.retrieve(subscription_id)
                synthetic_event = {
                    "type": "customer.subscription.updated",
                    "data": {"object": subscription},
                    "created": event.get("created")
                }
                await handle_subscription_event(synthetic_event)
            else:
                logger.warning("⚠️ subscription_schedule event missing subscription id - skipped")
        # Handle direct subscription events
        elif event_type.startswith("customer.subscription."):
            logger.info("📊 Event category: Subscription")
            await handle_subscription_event(event)
        # Handle invoice events
        elif event_type.startswith("invoice."):
            logger.info("🧾 Event category: Invoice")
            await handle_invoice_event(event)
        # Handle payment intent events
        elif event_type.startswith("payment_intent."):
            logger.info("💳 Event category: Payment Intent")
            await handle_payment_intent_event(event)
        else:
            logger.info(f"ℹ️ Unhandled event category: {event_type}")
            logger.info("   This event will be logged but not processed")
            
    except Exception as e:
        logger.error(f"❌ Error processing event {event_type}")
        logger.error(f"💥 Error: {str(e)}")
        logger.error(f"🔍 Exception type: {type(e).__name__}")
        logger.debug(f"📚 Full traceback: {traceback.format_exc()}")
        raise

async def handle_subscription_event(event: Dict[str, Any]):
    subscription = event["data"]["object"]
    customer_id = subscription["customer"]
    event_type = event["type"]
    
    logger.info(f"📊 HANDLING SUBSCRIPTION EVENT")
    logger.info(f"   Event Type: {event_type}")
    logger.info(f"   Customer ID: {customer_id}")
    logger.info(f"   Subscription ID: {subscription.get('id', 'N/A')}")
    logger.info(f"   Status: {subscription.get('status', 'unknown')}")
    
    try:
        # Get customer details
        logger.info("🔍 Retrieving customer details from Stripe...")
        customer = stripe.Customer.retrieve(customer_id)
        logger.info("✅ Customer retrieved successfully")
        
        # Log customer metadata
        metadata = customer.metadata or {}
        logger.info(f"👤 Customer Metadata:")
        for key, value in metadata.items():
            logger.info(f"   {key}: {value}")
        
        company_code = metadata.get("companyCode")
        if not company_code:
            logger.warning("⚠️ No companyCode found in customer metadata")
            logger.warning("   Cannot process subscription without company code")
            return
        
        logger.info(f"🏢 Processing subscription for company: {company_code}")
        
        # Handle different subscription events
        if event_type == "customer.subscription.deleted":
            logger.info("🗑️ Subscription deleted - setting company to unpaid")
            await update_company_users(
                company_code, 
                False, 
                "free"
            )
            
        else:
            # For created/updated subscriptions
            status = subscription.get("status", "unknown")
            is_active = status in ["active", "trialing"]
            logger.info(f"📊 Subscription status: {status} (active: {is_active})")
            
            plan_name = "free"  # Default
            
            # Get plan details
            items = subscription.get("items", {})
            if items and items.get("data"):
                logger.info("🔍 Retrieving plan details...")
                price_id = items["data"][0]["price"]["id"]
                logger.info(f"💰 Price ID: {price_id}")
                
                price = stripe.Price.retrieve(price_id)
                logger.info(f"💰 Price details: {price.get('unit_amount', 0)/100} {price.get('currency', 'USD')}")
                
                product = stripe.Product.retrieve(price.product)
                plan_name = product.name.lower()
                logger.info(f"📦 Product: {product.name} (normalized: {plan_name})")
            
            logger.info(f"📋 Final processing details:")
            logger.info(f"   Company: {company_code}")
            logger.info(f"   Is Paid: {is_active}")
            logger.info(f"   Plan: {plan_name}")
            
            # Update company users
            await update_company_users(
                company_code, 
                is_paid=is_active, 
                plan_name=plan_name
            )
            
            # Update subscription in database
            await update_subscription_in_db(
                company_code=company_code,
                subscription_id=subscription["id"],
                is_active=is_active,
                plan_name=plan_name,
                status=status,
                cancel_at_period_end=subscription.get("cancel_at_period_end", False)
            )
        
        logger.info("✅ Subscription event handled successfully")
                
    except Exception as e:
        logger.error(f"❌ Error in handle_subscription_event")
        logger.error(f"💥 Error: {str(e)}")
        logger.error(f"🔍 Exception type: {type(e).__name__}")
        logger.debug(f"📚 Full traceback: {traceback.format_exc()}")
        raise

async def handle_invoice_event(event: Dict[str, Any]):
    invoice = event["data"]["object"]
    event_type = event["type"]
    
    logger.info(f"🧾 HANDLING INVOICE EVENT")
    logger.info(f"   Event Type: {event_type}")
    logger.info(f"   Invoice ID: {invoice.get('id', 'N/A')}")
    logger.info(f"   Amount: {invoice.get('amount_total', 0)/100} {invoice.get('currency', 'USD')}")
    logger.info(f"   Status: {invoice.get('status', 'unknown')}")
    
    if event_type == "invoice.payment_succeeded":
        logger.info("✅ Payment succeeded - invoice paid successfully")
    elif event_type == "invoice.payment_failed":
        logger.warning("❌ Payment failed - invoice payment unsuccessful")
        logger.info(f"   Failure reason: {invoice.get('last_payment_error', {}).get('message', 'Unknown')}")

async def handle_payment_intent_event(event: Dict[str, Any]):
    payment_intent = event["data"]["object"]
    event_type = event["type"]
    
    logger.info(f"💳 HANDLING PAYMENT INTENT EVENT")
    logger.info(f"   Event Type: {event_type}")
    logger.info(f"   Payment Intent ID: {payment_intent.get('id', 'N/A')}")
    logger.info(f"   Amount: {payment_intent.get('amount', 0)/100} {payment_intent.get('currency', 'USD')}")
    logger.info(f"   Status: {payment_intent.get('status', 'unknown')}")

async def handle_subscription_schedule_event(event: Dict[str, Any]):
    """
    Handle subscription schedule events by retrieving the underlying subscription and delegating to subscription handler.
    """
    schedule = event.get("data", {}).get("object", {})
    subscription_id = schedule.get("subscription")
    if not subscription_id:
        logger.warning(f"⚠️ No subscription id in schedule object: {schedule.get('id')}")
        return
    logger.info(f"📥 Handling subscription schedule event for subscription: {subscription_id}")
    try:
        subscription = stripe.Subscription.retrieve(subscription_id)
        synthetic_event = {
            "type": "customer.subscription.updated",
            "data": {"object": subscription},
            "created": event.get("created")
        }
        await handle_subscription_event(synthetic_event)
        logger.info(f"✅ Subscription schedule event processed for {subscription_id}")
    except Exception as e:
        logger.error(f"❌ Error in schedule handler: {e}")
        logger.debug(traceback.format_exc())
        raise

async def update_company_users(
    company_code: str, 
    is_paid: bool, 
    plan_name: Optional[str] = None
):
    """
    Update all users in the specified company's database
    is_paid: Boolean indicating if the subscription is paid
    plan_name: One of the 3 plan options (converted to lowercase)
    """
    logger.info(f"👥 UPDATING COMPANY USERS")
    logger.info(f"   Company Code: {company_code}")
    logger.info(f"   Is Paid: {is_paid}")
    logger.info(f"   Plan Name: {plan_name}")
    
    db_name = f"company_{company_code.lower()}"
    logger.info(f"🗄️ Target database: {db_name}")
    
    try:
        # Get database connection
        logger.info("🔌 Establishing database connection...")
        db = get_db_connection(company_code)
        users_collection = db["users"]
        logger.info("✅ Connected to users collection")
        
        # Build update fields
        update_fields = {}
        if is_paid is not None:
            # Store as string "true"/"false"
            paid_value = "true" if is_paid else "false"
            update_fields["paid"] = paid_value
            logger.info(f"   Adding paid field: {paid_value}")
            
        if plan_name is not None:
            # Ensure plan name is lowercase
            plan_value = plan_name.lower()
            update_fields["plan"] = plan_value
            logger.info(f"   Adding plan field: {plan_value}")
        
        if not update_fields:
            logger.warning("⚠️ No fields to update - operation skipped")
            return None
        
        logger.info(f"📝 Update operation details:")
        logger.info(f"   Fields to update: {json.dumps(update_fields, indent=4)}")
        logger.info(f"   Target: All users in {db_name}")
        
        # Count documents before update
        logger.info("🔢 Counting existing users...")
        total_users = users_collection.count_documents({})
        logger.info(f"   Total users in database: {total_users}")
        
        # Update all users in the company's database
        logger.info("🔄 Executing update operation...")
        result = users_collection.update_many(
            {},  # Match all documents
            {"$set": update_fields}
        )
        
        logger.info("✅ Update operation completed")
        logger.info(f"📊 Update results:")
        logger.info(f"   Matched documents: {result.matched_count}")
        logger.info(f"   Modified documents: {result.modified_count}")
        logger.info(f"   Acknowledged: {result.acknowledged}")
        
        if result.matched_count != total_users:
            logger.warning(f"⚠️ Matched count ({result.matched_count}) differs from total users ({total_users})")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error updating company users")
        logger.error(f"💥 Error: {str(e)}")
        logger.error(f"🔍 Exception type: {type(e).__name__}")
        logger.debug(f"📚 Full traceback: {traceback.format_exc()}")
        raise

async def update_subscription_in_db(
    company_code: str,
    subscription_id: str,
    is_active: bool,
    plan_name: str,
    status: str,
    cancel_at_period_end: bool = False
):
    logger.info(f"💾 UPDATING SUBSCRIPTION IN DATABASE")
    logger.info(f"   Company Code: {company_code}")
    logger.info(f"   Subscription ID: {subscription_id}")
    logger.info(f"   Is Active: {is_active}")
    logger.info(f"   Plan Name: {plan_name}")
    logger.info(f"   Status: {status}")
    logger.info(f"   Cancel at Period End: {cancel_at_period_end}")
    
    try:
        # Get database connection
        logger.info("🔌 Establishing database connection...")
        db = get_db_connection(company_code)
        subscriptions = db["subscriptions"]
        logger.info("✅ Connected to subscriptions collection")
        
        # Prepare update data
        update_data = {
            "status": status,
            "planType": plan_name,
            "isActive": is_active,
            "cancelAtPeriodEnd": cancel_at_period_end,
            "updatedAt": datetime.utcnow()
        }
        
        logger.info(f"📝 Subscription update data:")
        logger.info(json.dumps({k: str(v) for k, v in update_data.items()}, indent=4))
        
        # Check if subscription exists
        logger.info("🔍 Checking if subscription exists...")
        existing = subscriptions.find_one({"stripeSubscriptionId": subscription_id})
        if existing:
            logger.info(f"✅ Found existing subscription record: {existing.get('_id')}")
        else:
            logger.info("📝 No existing subscription record - will create new one")
        
        # Perform upsert operation
        logger.info("🔄 Executing upsert operation...")
        result = subscriptions.update_one(
            {"stripeSubscriptionId": subscription_id},
            {"$set": update_data},
            upsert=True
        )
        
        logger.info("✅ Subscription update completed")
        logger.info(f"📊 Update results:")
        logger.info(f"   Matched documents: {result.matched_count}")
        logger.info(f"   Modified documents: {result.modified_count}")
        logger.info(f"   Upserted ID: {result.upserted_id}")
        logger.info(f"   Acknowledged: {result.acknowledged}")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error updating subscription in database")
        logger.error(f"💥 Error: {str(e)}")
        logger.error(f"🔍 Exception type: {type(e).__name__}")
        logger.debug(f"📚 Full traceback: {traceback.format_exc()}")
        raise

# Application startup event
@app.on_event("startup")
async def startup_event():
    logger.info("🚀 APPLICATION STARTUP EVENT")
    logger.info("=" * 60)
    
    # Test database connectivity
    logger.info("🧪 Testing database connectivity...")
    try:
        db = get_db_connection("test")
        logger.info("✅ Database connectivity test passed")
    except Exception as e:
        logger.error(f"❌ Database connectivity test failed: {str(e)}")
    
    # Test Stripe API connectivity
    logger.info("🧪 Testing Stripe API connectivity...")
    try:
        if config.STRIPE_SECRET_KEY:
            account = stripe.Account.retrieve()
            logger.info(f"✅ Stripe API test passed - Account ID: {account.id}")
        else:
            logger.warning("⚠️ Stripe API key not configured - skipping test")
    except Exception as e:
        logger.error(f"❌ Stripe API test failed: {str(e)}")
    
    logger.info("🎉 Application startup completed")
    logger.info("=" * 60)

# Application shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 APPLICATION SHUTDOWN EVENT")
    logger.info("=" * 60)
    logger.info("👋 Stripe Webhook Service shutting down...")
    logger.info("💾 Flushing logs...")
    for handler in logger.handlers:
        handler.flush()
    logger.info("✅ Shutdown completed")

if __name__ == "__main__":
    logger.info("🚀 Starting Stripe Webhook Service with retry-on-bind...")
    logger.info(f"🌐 Listening on http://{config.HOST}:{config.PORT}")
    import time
    max_retries = 5
    for attempt in range(1, max_retries + 1):
        try:
            uvicorn.run(
                app,
                host=config.HOST,
                port=config.PORT,
                log_level="info",
                access_log=True
            )
            break
        except OSError as e:
            if getattr(e, 'errno', None) == 48:
                logger.error(f"❌ Bind error: port {config.PORT} in use (attempt {attempt}/{max_retries}). Retrying in 5s...")
                time.sleep(5)
                continue
            else:
                logger.error(f"❌ Server error: {e}")
                logger.debug(traceback.format_exc())
                sys.exit(1)
    else:
        logger.error(f"❌ Could not bind to port {config.PORT} after {max_retries} attempts")
        sys.exit(1)