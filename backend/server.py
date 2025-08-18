from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import os
import uuid
from datetime import datetime
import json
from openai import OpenAI

# Environment variables
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "pharmacy_platform")
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

# Initialize OpenAI client
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

class Pharmacy(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    email: Optional[str] = None
    location: Location
    is_guard: bool = False  # Pharmacie de garde
    stock: List[PharmacyStock] = []
    subscription_active: bool = False
    created_at: datetime = Field(default_factory=datetime.now)

class Prescription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    pharmacy_id: str
    medications: List[str]
    image_url: Optional[str] = None
    status: str = "pending"  # pending, processed, ready, delivered
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
    except Exception as e:
        print(f"Error initializing database: {e}")

# API Routes
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

@app.get("/api/pharmacies/{pharmacy_id}", response_model=Pharmacy)
async def get_pharmacy(pharmacy_id: str):
    """Get specific pharmacy details"""
    pharmacy = await db.pharmacies.find_one({"id": pharmacy_id})
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    return Pharmacy(**pharmacy)

@app.post("/api/pharmacies/{pharmacy_id}/stock")
async def update_pharmacy_stock(pharmacy_id: str, stock: List[PharmacyStock]):
    """Update pharmacy stock"""
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
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)