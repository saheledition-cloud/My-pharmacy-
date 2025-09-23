from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Request, Response, Cookie
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import os
import uuid
from datetime import datetime, timezone, timedelta
import json
import jwt
import bcrypt
import requests
import pandas as pd
import io
from openai import OpenAI

# Environment variables
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "pharmacy_platform")
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
JWT_SECRET = os.environ.get("JWT_SECRET", "your-secret-key-change-this")

# Initialize OpenAI client
openai_client = None
if OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(title="Pharmacy Platform API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Pydantic models
class Location(BaseModel):
    lat: float
    lng: float
    address: str
    wilaya: str
    commune: str
    quartier: Optional[str] = None

class PharmacyStock(BaseModel):
    medication_name: str
    quantity: int
    price: float
    available: bool = True

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    phone: Optional[str] = None
    picture: Optional[str] = None
    role: str = "pharmacy"  # "pharmacy", "admin"
    pharmacy_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PharmacyCredentials(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pharmacy_id: str
    username: str
    password_hash: str
    phone: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Pharmacy(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    email: Optional[str] = None
    location: Location
    is_guard: bool = False
    stock: List[PharmacyStock] = []
    subscription_active: bool = False
    created_at: datetime = Field(default_factory=datetime.now)

class Prescription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    pharmacy_id: str
    medications: List[str]
    image_url: Optional[str] = None
    status: str = "pending"
    created_at: datetime = Field(default_factory=datetime.now)

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pharmacy_id: str
    user_id: str
    message: str
    response: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)

class UserQuery(BaseModel):
    medication_name: str
    wilaya: Optional[str] = None
    commune: Optional[str] = None
    quartier: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    pharmacy_id: str
    phone: Optional[str] = None

class GoogleSessionData(BaseModel):
    id: str
    email: str
    name: str
    picture: str
    session_token: str

# Authentication helpers
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str, pharmacy_id: Optional[str] = None) -> str:
    payload = {
        "user_id": user_id,
        "pharmacy_id": pharmacy_id,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_jwt_token(token: str) -> Optional[Dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

async def get_current_user(request: Request, session_token: Optional[str] = Cookie(None)):
    """Get current authenticated user from session token"""
    token = session_token
    if not token:
        # Fallback to Authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check session in database
    session = await db.user_sessions.find_one({"session_token": token})
    if not session or session["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user data
    user = await db.users.find_one({"id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user)

# Sample data for Algeria locations
ALGERIA_PHARMACIES = [
    {
        "id": str(uuid.uuid4()),
        "name": "Pharmacie Central Alger",
        "phone": "021-123-456",
        "email": "central@pharmacy.dz",
        "location": {
            "lat": 36.7538, "lng": 3.0588,
            "address": "1 Rue Didouche Mourad, Alger Centre",
            "wilaya": "Alger", "commune": "Alger Centre", "quartier": "Centre-ville"
        },
        "is_guard": True,
        "stock": [
            {"medication_name": "Paracétamol 500mg", "quantity": 50, "price": 120.0, "available": True},
            {"medication_name": "Ibuprofène 400mg", "quantity": 30, "price": 250.0, "available": True},
            {"medication_name": "Amoxicilline 250mg", "quantity": 0, "price": 350.0, "available": False}
        ],
        "subscription_active": True
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Pharmacie Hydra",
        "phone": "021-789-012",
        "location": {
            "lat": 36.7225, "lng": 3.1572,
            "address": "Avenue des Frères Bouadou, Hydra",
            "wilaya": "Alger", "commune": "Hydra", "quartier": "Hydra"
        },
        "is_guard": False,
        "stock": [
            {"medication_name": "Paracétamol 500mg", "quantity": 25, "price": 125.0, "available": True},
            {"medication_name": "Doliprane 1000mg", "quantity": 40, "price": 180.0, "available": True}
        ],
        "subscription_active": True
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Pharmacie Oran Centre",
        "phone": "041-345-678",
        "location": {
            "lat": 35.6976, "lng": -0.6337,
            "address": "Boulevard de la Révolution, Oran",
            "wilaya": "Oran", "commune": "Oran", "quartier": "Centre-ville"
        },
        "is_guard": False,
        "stock": [
            {"medication_name": "Paracétamol 500mg", "quantity": 35, "price": 115.0, "available": True},
            {"medication_name": "Aspirine 500mg", "quantity": 20, "price": 200.0, "available": True}
        ],
        "subscription_active": True
    }
]

@app.on_event("startup")
async def startup_event():
    """Initialize database with sample data"""
    try:
        # Check if pharmacies collection exists and has data
        pharmacy_count = await db.pharmacies.count_documents({})
        if pharmacy_count == 0:
            # Insert sample pharmacies
            await db.pharmacies.insert_many(ALGERIA_PHARMACIES)
            print(f"Inserted {len(ALGERIA_PHARMACIES)} sample pharmacies")
            
            # Create default admin user
            admin_user = {
                "id": str(uuid.uuid4()),
                "email": "admin@pharmacarte.dz",
                "name": "Administrator",
                "role": "admin",
                "created_at": datetime.now(timezone.utc)
            }
            await db.users.insert_one(admin_user)
            print("Created admin user")
            
            # Create pharmacy credentials for sample pharmacies
            for i, pharmacy in enumerate(ALGERIA_PHARMACIES):
                credentials = {
                    "id": str(uuid.uuid4()),
                    "pharmacy_id": pharmacy["id"],
                    "username": f"pharmacie{i+1}",
                    "password_hash": hash_password("password123"),
                    "phone": pharmacy["phone"],
                    "created_at": datetime.now(timezone.utc)
                }
                await db.pharmacy_credentials.insert_one(credentials)
                print(f"Created credentials for {pharmacy['name']}")
    except Exception as e:
        print(f"Error initializing database: {e}")

# Basic API Routes
@app.get("/")
async def root():
    return {"message": "Pharmacy Platform API", "version": "1.0.0"}

@app.get("/api/pharmacies", response_model=List[Pharmacy])
async def get_pharmacies(
    wilaya: Optional[str] = None,
    commune: Optional[str] = None,
    quartier: Optional[str] = None,
    medication: Optional[str] = None
):
    """Get pharmacies with optional filtering"""
    query = {}
    
    if wilaya:
        query["location.wilaya"] = wilaya
    if commune:
        query["location.commune"] = commune
    if quartier:
        query["location.quartier"] = quartier
    
    pharmacies = await db.pharmacies.find(query).to_list(length=None)
    
    # Filter by medication availability if specified
    if medication:
        filtered_pharmacies = []
        for pharmacy in pharmacies:
            for stock_item in pharmacy.get("stock", []):
                if (medication.lower() in stock_item.get("medication_name", "").lower() 
                    and stock_item.get("available", False)):
                    filtered_pharmacies.append(pharmacy)
                    break
        pharmacies = filtered_pharmacies
    
    return [Pharmacy(**pharmacy) for pharmacy in pharmacies]

# Authentication Routes
@app.post("/api/auth/login")
async def login_pharmacy(login_request: LoginRequest, response: Response):
    """Login pharmacy with username/password"""
    credentials = await db.pharmacy_credentials.find_one({"username": login_request.username})
    if not credentials or not verify_password(login_request.password, credentials["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Get pharmacy data
    pharmacy = await db.pharmacies.find_one({"id": credentials["pharmacy_id"]})
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    
    # Create or get user
    user = await db.users.find_one({"pharmacy_id": credentials["pharmacy_id"]})
    if not user:
        user = {
            "id": str(uuid.uuid4()),
            "email": pharmacy.get("email", ""),
            "name": pharmacy["name"],
            "phone": credentials.get("phone"),
            "role": "pharmacy",
            "pharmacy_id": credentials["pharmacy_id"],
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(user)
    
    # Create session
    session_token = str(uuid.uuid4())
    session = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60  # 7 days
    )
    
    return {
        "user": User(**user),
        "pharmacy": Pharmacy(**pharmacy),
        "session_token": session_token
    }

@app.post("/api/auth/register")
async def register_pharmacy(register_request: RegisterRequest):
    """Register new pharmacy credentials"""
    # Check if pharmacy exists
    pharmacy = await db.pharmacies.find_one({"id": register_request.pharmacy_id})
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    
    # Check if username already exists
    existing = await db.pharmacy_credentials.find_one({"username": register_request.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create credentials
    credentials = {
        "id": str(uuid.uuid4()),
        "pharmacy_id": register_request.pharmacy_id,
        "username": register_request.username,
        "password_hash": hash_password(register_request.password),
        "phone": register_request.phone,
        "created_at": datetime.now(timezone.utc)
    }
    await db.pharmacy_credentials.insert_one(credentials)
    
    return {"message": "Pharmacy registered successfully"}

@app.get("/api/auth/session-data")
async def get_session_data(request: Request):
    """Get session data from Emergent Google OAuth"""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    try:
        # Call Emergent auth service
        response = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid session ID")
        
        google_data = GoogleSessionData(**response.json())
        
        # Check if user exists
        user = await db.users.find_one({"email": google_data.email})
        if not user:
            # Create new user
            user = {
                "id": str(uuid.uuid4()),
                "email": google_data.email,
                "name": google_data.name,
                "picture": google_data.picture,
                "role": "admin",  # Google users are admins by default
                "created_at": datetime.now(timezone.utc)
            }
            await db.users.insert_one(user)
        
        # Create session
        session = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "session_token": google_data.session_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc)
        }
        await db.user_sessions.insert_one(session)
        
        return {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user.get("picture"),
            "session_token": google_data.session_token,
            "role": user["role"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication error: {str(e)}")

@app.post("/api/auth/logout")
async def logout(response: Response, current_user: User = Depends(get_current_user)):
    """Logout user"""
    # Delete session from database
    await db.user_sessions.delete_many({"user_id": current_user.id})
    
    # Clear cookie
    response.delete_cookie(key="session_token", path="/")
    
    return {"message": "Logged out successfully"}

@app.get("/api/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    user_data = current_user.dict()
    
    # If pharmacy user, include pharmacy data
    if current_user.pharmacy_id:
        pharmacy = await db.pharmacies.find_one({"id": current_user.pharmacy_id})
        if pharmacy:
            user_data["pharmacy"] = Pharmacy(**pharmacy)
    
    return user_data

# Pharmacy Management Routes (Protected)
@app.get("/api/pharmacy/dashboard")
async def get_pharmacy_dashboard(current_user: User = Depends(get_current_user)):
    """Get pharmacy dashboard data"""
    if current_user.role != "pharmacy" or not current_user.pharmacy_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    pharmacy = await db.pharmacies.find_one({"id": current_user.pharmacy_id})
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    
    # Get statistics
    total_stock = len(pharmacy.get("stock", []))
    available_stock = len([item for item in pharmacy.get("stock", []) if item.get("available")])
    low_stock = len([item for item in pharmacy.get("stock", []) if item.get("quantity", 0) < 10])
    
    # Get recent prescriptions
    recent_prescriptions = await db.prescriptions.find(
        {"pharmacy_id": current_user.pharmacy_id}
    ).sort("created_at", -1).limit(5).to_list(length=5)
    
    return {
        "pharmacy": Pharmacy(**pharmacy),
        "stats": {
            "total_stock": total_stock,
            "available_stock": available_stock,
            "low_stock": low_stock,
            "recent_orders": len(recent_prescriptions)
        },
        "recent_prescriptions": recent_prescriptions
    }

@app.put("/api/pharmacy/stock")
async def update_pharmacy_stock(
    stock: List[PharmacyStock],
    current_user: User = Depends(get_current_user)
):
    """Update pharmacy stock"""
    if current_user.role != "pharmacy" or not current_user.pharmacy_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.pharmacies.update_one(
        {"id": current_user.pharmacy_id},
        {"$set": {"stock": [item.dict() for item in stock]}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    
    return {"message": "Stock updated successfully"}

@app.post("/api/pharmacy/stock/upload-excel")
async def upload_stock_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload stock from Excel file"""
    if current_user.role != "pharmacy" or not current_user.pharmacy_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be Excel format")
    
    try:
        # Read Excel file
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Expected columns: medication_name, quantity, price, available (optional)
        required_columns = ['medication_name', 'quantity', 'price']
        if not all(col in df.columns for col in required_columns):
            raise HTTPException(
                status_code=400, 
                detail=f"Excel must contain columns: {', '.join(required_columns)}"
            )
        
        # Convert to stock items
        stock_items = []
        for _, row in df.iterrows():
            available = row.get('available', True)
            if pd.isna(available):
                available = True
            elif isinstance(available, str):
                available = available.lower() in ['true', '1', 'yes', 'oui', 'disponible']
            
            stock_item = PharmacyStock(
                medication_name=str(row['medication_name']),
                quantity=int(row['quantity']) if pd.notna(row['quantity']) else 0,
                price=float(row['price']) if pd.notna(row['price']) else 0.0,
                available=bool(available)
            )
            stock_items.append(stock_item)
        
        # Update pharmacy stock
        result = await db.pharmacies.update_one(
            {"id": current_user.pharmacy_id},
            {"$set": {"stock": [item.dict() for item in stock_items]}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Pharmacy not found")
        
        return {
            "message": f"Stock updated successfully with {len(stock_items)} items",
            "items_count": len(stock_items)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing Excel file: {str(e)}")

# Continue with existing routes...
@app.get("/api/pharmacies/{pharmacy_id}", response_model=Pharmacy)
async def get_pharmacy(pharmacy_id: str):
    """Get specific pharmacy details"""
    pharmacy = await db.pharmacies.find_one({"id": pharmacy_id})
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    return Pharmacy(**pharmacy)

@app.post("/api/pharmacies/{pharmacy_id}/stock")
async def update_pharmacy_stock_public(pharmacy_id: str, stock: List[PharmacyStock]):
    """Update pharmacy stock (public endpoint - deprecated, use authenticated version)"""
    result = await db.pharmacies.update_one(
        {"id": pharmacy_id},
        {"$set": {"stock": [item.dict() for item in stock]}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    return {"message": "Stock updated successfully"}

@app.post("/api/search-medication")
async def search_medication(query: UserQuery):
    """Search for medication availability across pharmacies"""
    search_query = {"subscription_active": True}
    
    if query.wilaya:
        search_query["location.wilaya"] = query.wilaya
    if query.commune:
        search_query["location.commune"] = query.commune
    if query.quartier:
        search_query["location.quartier"] = query.quartier
    
    pharmacies = await db.pharmacies.find(search_query).to_list(length=None)
    
    results = []
    for pharmacy in pharmacies:
        for stock_item in pharmacy.get("stock", []):
            if (query.medication_name.lower() in stock_item.get("medication_name", "").lower()
                and stock_item.get("available", False)):
                results.append({
                    "pharmacy": Pharmacy(**pharmacy),
                    "stock_item": PharmacyStock(**stock_item)
                })
    
    return {"results": results, "total_found": len(results)}

@app.post("/api/chat/{pharmacy_id}")
async def chat_with_pharmacy(pharmacy_id: str, message: str, user_id: str):
    """Chat with pharmacy AI agent"""
    try:
        # Check if OpenAI client is available
        if not openai_client:
            return {"response": "Désolé, le service de chat IA n'est pas disponible pour le moment. Veuillez contacter directement la pharmacie."}
        
        # Get pharmacy details
        pharmacy = await db.pharmacies.find_one({"id": pharmacy_id})
        if not pharmacy:
            raise HTTPException(status_code=404, detail="Pharmacy not found")
        
        # Create context for AI
        pharmacy_context = f"""
        Tu es l'assistant IA de la pharmacie {pharmacy['name']} située à {pharmacy['location']['address']}.
        
        Stock disponible:
        """
        
        for item in pharmacy.get("stock", []):
            status = "Disponible" if item.get("available") else "Rupture de stock"
            pharmacy_context += f"- {item.get('medication_name')}: {item.get('quantity')} unités, {item.get('price')} DA ({status})\n"
        
        pharmacy_context += """
        
        Réponds en français. Tu peux:
        1. Confirmer la disponibilité des médicaments
        2. Proposer des alternatives si en rupture
        3. Donner les prix
        4. Orienter vers la livraison ou retrait en magasin
        
        Sois professionnel et utile.
        """
        
        # Call OpenAI API
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": pharmacy_context},
                {"role": "user", "content": message}
            ],
            max_tokens=300,
            temperature=0.7
        )
        
        ai_response = response.choices[0].message.content
        
        # Save chat message
        chat_message = ChatMessage(
            pharmacy_id=pharmacy_id,
            user_id=user_id,
            message=message,
            response=ai_response
        )
        
        await db.chat_messages.insert_one(chat_message.dict())
        
        return {"response": ai_response}
        
    except Exception as e:
        return {"response": f"Désolé, une erreur est survenue: {str(e)}. Veuillez contacter directement la pharmacie."}

@app.post("/api/prescriptions")
async def submit_prescription(prescription: Prescription):
    """Submit a prescription to a pharmacy"""
    await db.prescriptions.insert_one(prescription.dict())
    return {"message": "Prescription submitted successfully", "prescription_id": prescription.id}

@app.get("/api/prescriptions/{user_id}")
async def get_user_prescriptions(user_id: str):
    """Get user's prescriptions"""
    prescriptions = await db.prescriptions.find({"user_id": user_id}).to_list(length=None)
    return [Prescription(**prescription) for prescription in prescriptions]

# Admin API Routes (Protected)
@app.get("/api/admin/stats")
async def get_admin_stats(current_user: User = Depends(get_current_user)):
    """Get admin dashboard statistics"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        total_pharmacies = await db.pharmacies.count_documents({})
        active_subscriptions = await db.pharmacies.count_documents({"subscription_active": True})
        guard_pharmacies = await db.pharmacies.count_documents({"is_guard": True})
        
        # Count total medications in stock
        pharmacies = await db.pharmacies.find().to_list(length=None)
        total_medications = sum(len(pharmacy.get("stock", [])) for pharmacy in pharmacies)
        
        return {
            "total_pharmacies": total_pharmacies,
            "active_subscriptions": active_subscriptions,
            "total_medications": total_medications,
            "guard_pharmacies": guard_pharmacies
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")

@app.post("/api/admin/pharmacies", response_model=Pharmacy)
async def add_pharmacy(pharmacy: Pharmacy, current_user: User = Depends(get_current_user)):
    """Add a new pharmacy"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        pharmacy_dict = pharmacy.dict()
        result = await db.pharmacies.insert_one(pharmacy_dict)
        if result.inserted_id:
            return pharmacy
        else:
            raise HTTPException(status_code=500, detail="Failed to insert pharmacy")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding pharmacy: {str(e)}")

@app.put("/api/admin/pharmacies/{pharmacy_id}", response_model=Pharmacy)
async def update_pharmacy(
    pharmacy_id: str, 
    updates: Dict[str, Any], 
    current_user: User = Depends(get_current_user)
):
    """Update pharmacy information"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        result = await db.pharmacies.update_one(
            {"id": pharmacy_id},
            {"$set": updates}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Pharmacy not found")
        
        updated_pharmacy = await db.pharmacies.find_one({"id": pharmacy_id})
        return Pharmacy(**updated_pharmacy)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating pharmacy: {str(e)}")

@app.delete("/api/admin/pharmacies/{pharmacy_id}")
async def delete_pharmacy(pharmacy_id: str, current_user: User = Depends(get_current_user)):
    """Delete a pharmacy"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        result = await db.pharmacies.delete_one({"id": pharmacy_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Pharmacy not found")
        return {"message": "Pharmacy deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting pharmacy: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)