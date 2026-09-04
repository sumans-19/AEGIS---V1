from pymongo import MongoClient
import logging
import os

logger = logging.getLogger("aegis_mongo")

# Use ENV for flexibility (local + Atlas)
MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb+srv://richa:Exam%407890@cluster0.r1u15je.mongodb.net/aegis_ai?retryWrites=true&w=majority",
)
DB_NAME = "aegis_ai"
COLLECTION_NAME = "drone_experiences"

client = None
db = None
collection = None
MONGO_AVAILABLE = False


def init_mongo():
    global client, db, collection, MONGO_AVAILABLE

    try:
        client = MongoClient(
            MONGO_URI, serverSelectionTimeoutMS=2000, connectTimeoutMS=2000  # fast fail
        )

        # Force connection check
        client.server_info()

        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]

        MONGO_AVAILABLE = True
        logger.info(f"✅ MongoDB connected: {MONGO_URI}")

    except Exception as e:
        MONGO_AVAILABLE = False
        logger.error(f"❌ MongoDB connection failed: {e}")
        client = None
        db = None
        collection = None


# Initialize on import
init_mongo()


# -------------------------------
# SAFE INSERT FUNCTION
# -------------------------------
def insert_experience(doc: dict):
    if not MONGO_AVAILABLE or collection is None:
        return False

    try:
        collection.insert_one(doc)
        return True
    except Exception as e:
        logger.error(f"Mongo insert failed: {e}")
        return False


# -------------------------------
# FETCH DATA (FOR RL TRAINING)
# -------------------------------
def fetch_experiences(limit=1000):
    if not MONGO_AVAILABLE or collection is None:
        return []

    try:
        return list(collection.find().limit(limit))
    except Exception as e:
        logger.error(f"Mongo fetch failed: {e}")
        return []


# -------------------------------
# OPTIONAL: CLEAR DATA (FOR TESTING)
# -------------------------------
def clear_experiences():
    if not MONGO_AVAILABLE or collection is None:
        return

    try:
        collection.delete_many({})
        logger.warning("⚠️ Cleared all experiences")
    except Exception as e:
        logger.error(f"Mongo clear failed: {e}")
