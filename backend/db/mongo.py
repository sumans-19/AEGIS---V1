import logging
import os
from datetime import datetime, timezone
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError

logger = logging.getLogger("aegis_mongo")
logging.basicConfig(level=logging.INFO)

# Default to Atlas credentials provided by user or environment variable
DEFAULT_MONGO_URI = (
    "mongodb://sumanshanthakumar_db_user:vs10njPvjLravFwb@ac-3qkzbbb-shard-00-00.xradsoo.mongodb.net:27017,ac-3qkzbbb-shard-00-01.xradsoo.mongodb.net:27017,ac-3qkzbbb-shard-00-02.xradsoo.mongodb.net:27017/aegis_ai?ssl=true&replicaSet=atlas-1cjllf-shard-0&authSource=admin&appName=Cluster0"
)
MONGO_URI = DEFAULT_MONGO_URI
DB_NAME = os.getenv("MONGO_DB_NAME", "aegis_ai")

client = None
db = None
MONGO_AVAILABLE = False

# In-memory storage fallback for offline resilience
_in_memory_db = {
    "sensors": {},
    "sensor_raw_readings": [],
    "sensor_windows": [],
    "sensor_snapshots": [],
    "drone_experiences": []
}


# ==============================================================================
# 1. PERMANENT SENSOR REGISTRY DEFINITIONS (4 SENSORS)
# ==============================================================================
DEFAULT_SENSOR_REGISTRY = [
    {
        "sensor_id": "SENSOR-DHT11-01",
        "unit_id": "UAV-01",
        "sensor_type": "environmental",
        "sensor_model": "DHT11",
        "display_name": "Environmental Sensor",
        "description": "Ambient temperature and relative humidity monitoring",
        "interface": "GPIO",
        "communication_protocol": "DIGITAL",
        "status": "ACTIVE",
        "capabilities": ["temperature", "humidity"],
        "measurement_units": {
            "temperature": "°C",
            "humidity": "%"
        },
        "sampling_interval_ms": 1000,
        "aggregation": {
            "window_duration_seconds": 120,
            "method": "AVERAGE"
        },
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    },
    {
        "sensor_id": "SENSOR-INA219-01",
        "unit_id": "UAV-01",
        "sensor_type": "power_monitor",
        "sensor_model": "INA219",
        "display_name": "Power Monitor",
        "description": "Zero-drift bi-directional DC current, bus voltage, and total power draw telemetry module",
        "interface": "I2C",
        "communication_protocol": "I2C",
        "status": "ACTIVE",
        "capabilities": ["bus_voltage", "current", "power"],
        "measurement_units": {
            "bus_voltage": "V",
            "current": "mA",
            "power": "mW"
        },
        "sampling_interval_ms": 1000,
        "aggregation": {
            "window_duration_seconds": 120,
            "method": "AVERAGE"
        },
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    },
    {
        "sensor_id": "SENSOR-HCSR04-01",
        "unit_id": "UAV-01",
        "sensor_type": "proximity",
        "sensor_model": "HC-SR04",
        "display_name": "Proximity Radar",
        "description": "High-precision ultrasonic obstacle detection and real-time shape fusion",
        "interface": "GPIO",
        "communication_protocol": "DIGITAL_PULSE",
        "status": "ACTIVE",
        "capabilities": ["distance", "obstacle_detection"],
        "measurement_units": {
            "distance": "cm"
        },
        "sampling_interval_ms": 200,
        "thresholds": {
            "critical_cm": 50.0,
            "warning_cm": 120.0,
            "caution_cm": 200.0,
            "safe_cm": 450.0
        },
        "aggregation": {
            "window_duration_seconds": 120,
            "method": "AVERAGE"
        },
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    },
    {
        "sensor_id": "SENSOR-CAM-01",
        "unit_id": "UAV-01",
        "sensor_type": "reconnaissance_camera",
        "sensor_model": "ESP32-CAM",
        "display_name": "Reconnaissance Camera",
        "description": "Optical reconnaissance with real-time target detection and thermal-style overlay",
        "camera_type": "OPTICAL",  # OPTICAL, THERMAL, FUSED
        "status": "ACTIVE",
        "capabilities": ["live_video", "image_capture", "object_detection"],
        "resolution": {
            "width": 640,
            "height": 512
        },
        "frame_rate": 30,
        "aggregation": {
            "window_duration_seconds": 120,
            "method": "DETECTION_CONSOLIDATION"
        },
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
]


def init_mongo():
    global client, db, MONGO_AVAILABLE

    # Initialize in-memory seed first
    for s in DEFAULT_SENSOR_REGISTRY:
        _in_memory_db["sensors"][s["sensor_id"]] = dict(s)

    try:
        client = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=3000,
            connectTimeoutMS=3000
        )
        # Verify connection
        client.admin.command("ping")
        db = client[DB_NAME]
        MONGO_AVAILABLE = True
        logger.info(f"✅ MongoDB Atlas Connected successfully: Database='{DB_NAME}'")

        # Setup indexes and seed registry
        setup_indexes_and_seeds()

    except Exception as e:
        MONGO_AVAILABLE = False
        logger.warning(f"⚠️ MongoDB Atlas connection notice: {e}. Operating with localized resilient in-memory storage.")
        client = None
        db = None


def setup_indexes_and_seeds():
    """Configures indexes and registers the 4 physical sensors in MongoDB."""
    if not MONGO_AVAILABLE or db is None:
        return

    try:
        # 1. sensors
        db.sensors.create_index([("sensor_id", ASCENDING)], unique=True)
        db.sensors.create_index([("unit_id", ASCENDING)])

        # 2. sensor_raw_readings
        db.sensor_raw_readings.create_index([("sensor_id", ASCENDING), ("timestamp", DESCENDING)])
        db.sensor_raw_readings.create_index([("unit_id", ASCENDING), ("timestamp", DESCENDING)])

        # 3. sensor_windows
        db.sensor_windows.create_index([("window_id", ASCENDING)], unique=True)
        db.sensor_windows.create_index([("sensor_id", ASCENDING), ("window_start", DESCENDING)])
        db.sensor_windows.create_index([("unit_id", ASCENDING), ("window_start", DESCENDING)])

        # 4. sensor_snapshots
        db.sensor_snapshots.create_index([("snapshot_id", ASCENDING)], unique=True)
        db.sensor_snapshots.create_index([("sensor_id", ASCENDING), ("captured_at", DESCENDING)])
        db.sensor_snapshots.create_index([("unit_id", ASCENDING), ("captured_at", DESCENDING)])

        # Seed sensor registry if missing
        for s in DEFAULT_SENSOR_REGISTRY:
            db.sensors.update_one(
                {"sensor_id": s["sensor_id"]},
                {"$setOnInsert": s},
                upsert=True
            )
        logger.info("✅ MongoDB Indexes and Sensor Registry initialized.")

    except Exception as e:
        logger.error(f"Failed to setup Mongo indexes/seeds: {e}")


# Initialize on import
init_mongo()


# ==============================================================================
# SENSOR REGISTRY OPERATIONS
# ==============================================================================
def get_sensor_registry():
    """Returns list of registered sensors."""
    if MONGO_AVAILABLE and db is not None:
        try:
            sensors = list(db.sensors.find({}, {"_id": 0}))
            if sensors:
                return sensors
        except Exception as e:
            logger.error(f"Error reading sensors: {e}")

    return list(_in_memory_db["sensors"].values())


def get_sensor(sensor_id: str):
    """Fetch single sensor definition."""
    if MONGO_AVAILABLE and db is not None:
        try:
            s = db.sensors.find_one({"sensor_id": sensor_id}, {"_id": 0})
            if s:
                return s
        except Exception as e:
            logger.error(f"Error reading sensor {sensor_id}: {e}")

    return _in_memory_db["sensors"].get(sensor_id)


# ==============================================================================
# RAW READINGS OPERATIONS
# ==============================================================================
def insert_raw_reading(doc: dict):
    """Inserts a single raw sensor observation for full auditability."""
    doc_copy = dict(doc)
    if "timestamp" not in doc_copy:
        doc_copy["timestamp"] = datetime.now(timezone.utc)

    # In-memory buffer (keep last 500)
    _in_memory_db["sensor_raw_readings"].append(doc_copy)
    if len(_in_memory_db["sensor_raw_readings"]) > 500:
        _in_memory_db["sensor_raw_readings"] = _in_memory_db["sensor_raw_readings"][-500:]

    if MONGO_AVAILABLE and db is not None:
        try:
            db.sensor_raw_readings.insert_one(dict(doc_copy))
            return True
        except Exception as e:
            logger.error(f"Failed to insert raw reading: {e}")

    return True


# ==============================================================================
# 2-MINUTE CONSOLIDATED WINDOW OPERATIONS
# ==============================================================================
def insert_sensor_window(doc: dict):
    """Inserts a 2-minute consolidated aggregation document into the legacy collection."""
    doc_copy = dict(doc)
    if "created_at" not in doc_copy:
        doc_copy["created_at"] = datetime.now(timezone.utc)

    _in_memory_db["sensor_windows"].append(doc_copy)

    if MONGO_AVAILABLE and db is not None:
        try:
            db.sensor_windows.insert_one(dict(doc_copy))
            logger.info(f"💾 Stored 2-Min Window '{doc.get('window_id')}' in MongoDB collection 'sensor_windows'")
            return True
        except Exception as e:
            logger.error(f"Failed to store sensor window: {e}")

    return True

def insert_split_sensor_docs(collection_map: dict):
    """
    Inserts multiple documents into their respective dedicated collections.
    collection_map format: { "collection_name": doc_dict }
    """
    now = datetime.now(timezone.utc)
    for col_name, doc in collection_map.items():
        doc_copy = dict(doc)
        if "created_at" not in doc_copy:
            doc_copy["created_at"] = now
            
        # In-memory fallback support
        if col_name not in _in_memory_db:
            _in_memory_db[col_name] = []
        _in_memory_db[col_name].append(doc_copy)
        
        if MONGO_AVAILABLE and db is not None:
            try:
                db[col_name].insert_one(dict(doc_copy))
                logger.info(f"💾 Stored data in dedicated collection '{col_name}'")
            except Exception as e:
                logger.error(f"Failed to store in {col_name}: {e}")
                
    return True


def get_sensor_windows(sensor_id: str, limit: int = 20):
    """Returns recent 2-minute consolidated windows for a sensor."""
    if MONGO_AVAILABLE and db is not None:
        try:
            query = {"sensor_id": sensor_id} if sensor_id else {}
            windows = list(db.sensor_windows.find(query, {"_id": 0}).sort("window_start", DESCENDING).limit(limit))
            if windows:
                return windows
        except Exception as e:
            logger.error(f"Failed to query sensor windows: {e}")

    # In-memory fallback
    matches = [
        w for w in _in_memory_db["sensor_windows"]
        if not sensor_id or w.get("sensor_id") == sensor_id
    ]
    matches.sort(key=lambda x: str(x.get("window_start", "")), reverse=True)
    return matches[:limit]


def get_latest_sensor_window(sensor_id: str):
    """Returns the most recent consolidated window for a sensor."""
    windows = get_sensor_windows(sensor_id, limit=1)
    return windows[0] if windows else None


# ==============================================================================
# MANUAL SNAPSHOT OPERATIONS
# ==============================================================================
def insert_sensor_snapshot(doc: dict):
    """Inserts an instantaneous manual snapshot captured by operator."""
    doc_copy = dict(doc)
    if "created_at" not in doc_copy:
        doc_copy["created_at"] = datetime.now(timezone.utc)

    _in_memory_db["sensor_snapshots"].append(doc_copy)

    if MONGO_AVAILABLE and db is not None:
        try:
            db.sensor_snapshots.insert_one(dict(doc_copy))
            logger.info(f"📸 Saved Manual Snapshot '{doc.get('snapshot_id')}' in MongoDB collection 'sensor_snapshots'")
            return True
        except Exception as e:
            logger.error(f"Failed to insert snapshot: {e}")

    return True


def get_sensor_snapshots(sensor_id: str = None, limit: int = 20):
    """Returns recent manual snapshots."""
    if MONGO_AVAILABLE and db is not None:
        try:
            query = {"sensor_id": sensor_id} if sensor_id else {}
            snaps = list(db.sensor_snapshots.find(query, {"_id": 0}).sort("captured_at", DESCENDING).limit(limit))
            if snaps:
                return snaps
        except Exception as e:
            logger.error(f"Failed to query snapshots: {e}")

    matches = [
        s for s in _in_memory_db["sensor_snapshots"]
        if not sensor_id or s.get("sensor_id") == sensor_id
    ]
    matches.sort(key=lambda x: str(x.get("captured_at", "")), reverse=True)
    return matches[:limit]


# ==============================================================================
# DRONE EXPERIENCES (EXISTING RL REPOSITORY)
# ==============================================================================
def insert_experience(doc: dict):
    if not MONGO_AVAILABLE or db is None:
        return False
    try:
        db.drone_experiences.insert_one(doc)
        return True
    except Exception as e:
        logger.error(f"Mongo insert failed: {e}")
        return False


def fetch_experiences(limit=1000):
    if not MONGO_AVAILABLE or db is None:
        return []
    try:
        return list(db.drone_experiences.find({}, {"_id": 0}).limit(limit))
    except Exception as e:
        logger.error(f"Mongo fetch failed: {e}")
        return []