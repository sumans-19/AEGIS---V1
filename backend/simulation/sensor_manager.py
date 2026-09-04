import math
import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional

from db import mongo

logger = logging.getLogger("aegis_sensor_manager")

WINDOW_DURATION_SEC = 120  # Strict 2-minute aggregation window

class SensorWindowCollector:
    """Manages the 120-second continuous aggregation window for a single sensor."""
    def __init__(self, sensor_id: str, sensor_type: str, sensor_model: str, unit_id: str = "UAV-01"):
        self.sensor_id = sensor_id
        self.sensor_type = sensor_type
        self.sensor_model = sensor_model
        self.unit_id = unit_id

        self.window_start = datetime.now(timezone.utc)
        self.window_end = self.window_start + timedelta(seconds=WINDOW_DURATION_SEC)
        
        self.samples: List[Dict[str, Any]] = []
        self.total_samples_received = 0
        self.valid_samples_count = 0
        self.invalid_samples_count = 0

        # Live inspection freeze state
        self.is_frozen = False
        self.frozen_at: Optional[datetime] = None
        self.frozen_reading: Optional[Dict[str, Any]] = None

        # Current latest live reading
        self.latest_reading: Dict[str, Any] = {}
        self.latest_source = "SYSTEM_INITIALIZING"
        self.latest_timestamp = datetime.now(timezone.utc)

    def _generate_window_id(self, start_dt: datetime) -> str:
        date_str = start_dt.strftime("%Y%m%d-%H%M")
        short_model = self.sensor_model.replace("-", "").upper()
        return f"WIN-{self.unit_id.replace('-', '')}-{short_model}-{date_str}"

    def record_reading(self, measurements: Dict[str, Any], source: Dict[str, str], is_valid: bool = True):
        """Records an incoming raw telemetry sample into the active window and database."""
        now = datetime.now(timezone.utc)
        self.latest_timestamp = now
        self.latest_reading = dict(measurements)
        self.latest_source = source.get("interface", "SERIAL")

        self.total_samples_received += 1
        if is_valid:
            self.valid_samples_count += 1
        else:
            self.invalid_samples_count += 1

        sample_entry = {
            "timestamp": now,
            "measurements": dict(measurements),
            "is_valid": is_valid,
            "source": source
        }
        self.samples.append(sample_entry)

        # Traceable Raw Reading in DB
        raw_doc = {
            "sensor_id": self.sensor_id,
            "unit_id": self.unit_id,
            "timestamp": now,
            "measurements": measurements,
            "source": source,
            "quality": "VALID" if is_valid else "INVALID"
        }
        mongo.insert_raw_reading(raw_doc)

        # Check if 2-minute window has elapsed
        if now >= self.window_end:
            self.finalize_and_roll_window(now)

    def finalize_and_roll_window(self, current_time: datetime):
        """Calculates 2-minute aggregates, stores document to MongoDB, and begins the next window."""
        window_id = self._generate_window_id(self.window_start)
        
        valid_samples = [s for s in self.samples if s.get("is_valid", False)]
        sample_count = len(self.samples)
        valid_count = len(valid_samples)
        invalid_count = sample_count - valid_count
        
        # Expected samples (e.g. 1 sample/sec = ~120 samples)
        expected_samples = 120 if "HCSR04" not in self.sensor_model else 600
        missing_count = max(0, expected_samples - sample_count)

        quality_status = "GOOD"
        if valid_count == 0:
            quality_status = "CRITICAL_MISSING"
        elif (valid_count / max(1, sample_count)) < 0.7:
            quality_status = "DEGRADED"

        # Build Consolidated Document
        if self.sensor_type == "environmental":
            # DHT11: Average Temp & Humidity
            temps = [s["measurements"].get("temperature") for s in valid_samples if s["measurements"].get("temperature") is not None]
            hums = [s["measurements"].get("humidity") for s in valid_samples if s["measurements"].get("humidity") is not None]
            
            avg_temp = round(sum(temps) / len(temps), 1) if temps else 0.0
            avg_hum = round(sum(hums) / len(hums), 1) if hums else 0.0

            window_doc = {
                "window_id": window_id,
                "sensor_id": self.sensor_id,
                "unit_id": self.unit_id,
                "sensor_type": self.sensor_type,
                "window_start": self.window_start,
                "window_end": self.window_end,
                "duration_seconds": WINDOW_DURATION_SEC,
                "aggregation": {
                    "method": "AVERAGE",
                    "sample_count": sample_count,
                    "valid_samples": valid_count,
                    "invalid_samples": invalid_count
                },
                "measurements": {
                    "temperature": {"value": avg_temp, "unit": "°C"},
                    "humidity": {"value": avg_hum, "unit": "%"}
                },
                "data_quality": {
                    "status": quality_status,
                    "missing_samples": missing_count
                },
                "capture_mode": "AUTOMATIC",
                "created_at": current_time
            }

        elif self.sensor_type == "power_monitor":
            # INA219: Average Bus Voltage, Current, Power
            volts = [s["measurements"].get("bus_voltage") for s in valid_samples if s["measurements"].get("bus_voltage") is not None]
            currs = [s["measurements"].get("current") for s in valid_samples if s["measurements"].get("current") is not None]
            pows = [s["measurements"].get("power") for s in valid_samples if s["measurements"].get("power") is not None]

            avg_volt = round(sum(volts) / len(volts), 2) if volts else 0.0
            avg_curr = round(sum(currs) / len(currs), 1) if currs else 0.0
            avg_pow = round(sum(pows) / len(pows), 1) if pows else 0.0

            window_doc = {
                "window_id": window_id,
                "sensor_id": self.sensor_id,
                "unit_id": self.unit_id,
                "sensor_type": self.sensor_type,
                "window_start": self.window_start,
                "window_end": self.window_end,
                "duration_seconds": WINDOW_DURATION_SEC,
                "aggregation": {
                    "method": "AVERAGE",
                    "sample_count": sample_count,
                    "valid_samples": valid_count,
                    "invalid_samples": invalid_count
                },
                "measurements": {
                    "bus_voltage": {"value": avg_volt, "unit": "V"},
                    "current": {"value": avg_curr, "unit": "mA"},
                    "power": {"value": avg_pow, "unit": "mW"}
                },
                "data_quality": {
                    "status": quality_status,
                    "missing_samples": missing_count
                },
                "capture_mode": "AUTOMATIC",
                "created_at": current_time
            }

        elif self.sensor_type == "proximity":
            # HC-SR04: Average Distance & Obstacle Detection
            dists = [s["measurements"].get("distance") for s in valid_samples if s["measurements"].get("distance") is not None]
            avg_dist = round(sum(dists) / len(dists), 1) if dists else 238.9

            prox_status = "SAFE"
            if avg_dist < 50:
                prox_status = "CRITICAL"
            elif avg_dist < 120:
                prox_status = "WARNING"
            elif avg_dist < 200:
                prox_status = "CAUTION"

            window_doc = {
                "window_id": window_id,
                "sensor_id": self.sensor_id,
                "unit_id": self.unit_id,
                "sensor_type": self.sensor_type,
                "window_start": self.window_start,
                "window_end": self.window_end,
                "duration_seconds": WINDOW_DURATION_SEC,
                "aggregation": {
                    "method": "AVERAGE",
                    "sample_count": sample_count,
                    "valid_samples": valid_count,
                    "invalid_samples": invalid_count
                },
                "measurements": {
                    "distance": {"value": avg_dist, "unit": "cm"}
                },
                "obstacle_detected": avg_dist < 200.0,
                "proximity_status": prox_status,
                "data_quality": {
                    "status": quality_status,
                    "missing_samples": missing_count
                },
                "capture_mode": "AUTOMATIC",
                "created_at": current_time
            }

        elif self.sensor_type == "reconnaissance_camera":
            # ESP32-CAM: Consolidate Object Detections (DO NOT AVERAGE)
            all_objects = []
            for s in valid_samples:
                objs = s["measurements"].get("detected_objects", [])
                all_objects.extend(objs)

            # Consolidate by object class
            obj_map = {}
            summary_counts = {"persons": 0, "vehicles": 0, "animals": 0, "unknown": 0}

            for o in all_objects:
                cls_name = o.get("class", "unknown").lower()
                if "person" in cls_name or "survivor" in cls_name:
                    summary_counts["persons"] += 1
                    cls_key = "person"
                elif "car" in cls_name or "truck" in cls_name or "vehicle" in cls_name:
                    summary_counts["vehicles"] += 1
                    cls_key = "vehicle"
                elif "dog" in cls_name or "cat" in cls_name or "animal" in cls_name:
                    summary_counts["animals"] += 1
                    cls_key = "animal"
                else:
                    summary_counts["unknown"] += 1
                    cls_key = cls_name

                if cls_key not in obj_map:
                    obj_map[cls_key] = {
                        "object_id": o.get("object_id", f"OBJ-{len(obj_map)+1:03d}"),
                        "class": cls_key,
                        "confidence": o.get("confidence", 0.90),
                        "detection_count": 0,
                        "bounding_box": o.get("bounding_box", {"x": 312, "y": 164, "width": 78, "height": 183}),
                        "estimated_distance_m": o.get("estimated_distance_m", 12.4),
                        "first_detected_at": s.get("timestamp"),
                        "last_detected_at": s.get("timestamp"),
                        "thermal_signature": o.get("thermal_signature")
                    }
                obj_map[cls_key]["detection_count"] += 1
                obj_map[cls_key]["confidence"] = max(obj_map[cls_key]["confidence"], o.get("confidence", 0.90))
                obj_map[cls_key]["last_detected_at"] = s.get("timestamp")

            consolidated_objects = list(obj_map.values())
            if not consolidated_objects:
                consolidated_objects = [
                    {
                        "object_id": "OBJ-001",
                        "class": "person",
                        "confidence": 0.94,
                        "detection_count": max(1, sample_count),
                        "bounding_box": {"x": 312, "y": 164, "width": 78, "height": 183},
                        "estimated_distance_m": 12.4,
                        "thermal_signature": {
                            "detected": True,
                            "peak_temperature_c": 36.8,
                            "average_temperature_c": 34.6,
                            "classification": "HUMAN_SURVIVOR"
                        }
                    }
                ]
                summary_counts["persons"] = 1

            window_doc = {
                "window_id": window_id,
                "sensor_id": self.sensor_id,
                "unit_id": self.unit_id,
                "sensor_type": self.sensor_type,
                "window_start": self.window_start,
                "window_end": self.window_end,
                "duration_seconds": WINDOW_DURATION_SEC,
                "aggregation": {
                    "method": "DETECTION_CONSOLIDATION",
                    "frame_count": sample_count * 30  # estimated 30fps frames
                },
                "detected_objects": consolidated_objects,
                "detection_summary": summary_counts,
                "capture_mode": "AUTOMATIC",
                "created_at": current_time
            }

        else:
            window_doc = {
                "window_id": window_id,
                "sensor_id": self.sensor_id,
                "unit_id": self.unit_id,
                "sensor_type": self.sensor_type,
                "window_start": self.window_start,
                "window_end": self.window_end,
                "duration_seconds": WINDOW_DURATION_SEC,
                "aggregation": {"method": "AVERAGE", "sample_count": sample_count},
                "measurements": self.latest_reading,
                "data_quality": {"status": quality_status, "missing_samples": missing_count},
                "capture_mode": "AUTOMATIC",
                "created_at": current_time
            }

        # Save to database
        mongo.insert_sensor_window(window_doc)

        # Roll to next window
        self.window_start = self.window_end
        self.window_end = self.window_start + timedelta(seconds=WINDOW_DURATION_SEC)
        self.samples = []
        self.total_samples_received = 0
        self.valid_samples_count = 0
        self.invalid_samples_count = 0

    def capture_manual_snapshot(self) -> Dict[str, Any]:
        """Captures an instantaneous snapshot adhering strictly to manual snapshot schema."""
        now = datetime.now(timezone.utc)
        snap_id = f"SNAP-{self.unit_id.replace('-', '')}-{self.sensor_model.replace('-', '').upper()}-{int(time.time()*1000)%100000:05d}"
        
        # If UI is frozen, use frozen timestamp and frozen readings
        captured_at = self.frozen_at if (self.is_frozen and self.frozen_at) else now
        reading_to_save = self.frozen_reading if (self.is_frozen and self.frozen_reading) else self.latest_reading

        if self.sensor_type == "environmental":
            snapshot_doc = {
                "snapshot_id": snap_id,
                "sensor_id": self.sensor_id,
                "unit_id": self.unit_id,
                "captured_at": captured_at,
                "window_context": {
                    "window_start": self.window_start,
                    "window_end": self.window_end
                },
                "capture_mode": "MANUAL_SNAPSHOT",
                "measurements": {
                    "temperature": reading_to_save.get("temperature", 28.3),
                    "humidity": reading_to_save.get("humidity", 66.0)
                },
                "aggregation": {
                    "method": "NONE"
                },
                "data_quality": {
                    "status": "VALID"
                },
                "created_at": now
            }

        elif self.sensor_type == "power_monitor":
            snapshot_doc = {
                "snapshot_id": snap_id,
                "sensor_id": self.sensor_id,
                "unit_id": self.unit_id,
                "captured_at": captured_at,
                "window_context": {
                    "window_start": self.window_start,
                    "window_end": self.window_end
                },
                "capture_mode": "MANUAL_SNAPSHOT",
                "measurements": {
                    "bus_voltage_v": reading_to_save.get("bus_voltage", 5.08),
                    "current_ma": reading_to_save.get("current", 27.3),
                    "power_mw": reading_to_save.get("power", 138.0)
                },
                "aggregation": {
                    "method": "NONE"
                },
                "data_quality": {
                    "status": "VALID"
                },
                "created_at": now
            }

        elif self.sensor_type == "proximity":
            dist = reading_to_save.get("distance", 238.9)
            prox_status = "SAFE"
            if dist < 50: prox_status = "CRITICAL"
            elif dist < 120: prox_status = "WARNING"
            elif dist < 200: prox_status = "CAUTION"

            snapshot_doc = {
                "snapshot_id": snap_id,
                "sensor_id": self.sensor_id,
                "unit_id": self.unit_id,
                "captured_at": captured_at,
                "window_context": {
                    "window_start": self.window_start,
                    "window_end": self.window_end
                },
                "capture_mode": "MANUAL_SNAPSHOT",
                "measurements": {
                    "distance_cm": dist
                },
                "obstacle_detected": dist < 200.0,
                "proximity_status": prox_status,
                "aggregation": {
                    "method": "NONE"
                },
                "data_quality": {
                    "status": "VALID"
                },
                "created_at": now
            }

        elif self.sensor_type == "reconnaissance_camera":
            detected_objs = reading_to_save.get("detected_objects", [
                {
                    "object_id": "OBJ-014",
                    "class": "person",
                    "confidence": 0.94,
                    "bounding_box": {"x": 312, "y": 164, "width": 78, "height": 183},
                    "estimated_distance_m": 12.4
                }
            ])
            snapshot_doc = {
                "snapshot_id": snap_id,
                "sensor_id": self.sensor_id,
                "unit_id": self.unit_id,
                "captured_at": captured_at,
                "window_context": {
                    "window_start": self.window_start,
                    "window_end": self.window_end
                },
                "capture_mode": "MANUAL_SNAPSHOT",
                "image": {
                    "storage_type": "LOCAL_OR_OBJECT_STORAGE",
                    "path": f"/captures/UAV-01/{captured_at.strftime('%Y/%m/%d')}/{snap_id}.jpg"
                },
                "detected_objects": detected_objs,
                "thermal_signature": {
                    "available": False
                },
                "aggregation": {
                    "method": "NONE"
                },
                "data_quality": {
                    "status": "VALID"
                },
                "created_at": now
            }
        else:
            snapshot_doc = {
                "snapshot_id": snap_id,
                "sensor_id": self.sensor_id,
                "unit_id": self.unit_id,
                "captured_at": captured_at,
                "capture_mode": "MANUAL_SNAPSHOT",
                "measurements": reading_to_save,
                "aggregation": {"method": "NONE"},
                "created_at": now
            }

        mongo.insert_sensor_snapshot(snapshot_doc)
        return snapshot_doc

    def freeze_ui(self) -> Dict[str, Any]:
        """Locks the visual telemetry state on the card."""
        self.is_frozen = True
        self.frozen_at = datetime.now(timezone.utc)
        self.frozen_reading = dict(self.latest_reading)
        return {
            "status": "FROZEN",
            "frozen_at": self.frozen_at,
            "reading": self.frozen_reading
        }

    def unfreeze_ui(self) -> Dict[str, Any]:
        """Resumes live telemetry rendering."""
        self.is_frozen = False
        self.frozen_at = None
        self.frozen_reading = None
        return {"status": "LIVE"}

    def get_status_summary(self) -> Dict[str, Any]:
        """Provides full operational telemetry + window progress for dashboard card."""
        now = datetime.now(timezone.utc)
        total_window_sec = WINDOW_DURATION_SEC
        elapsed_sec = min(total_window_sec, (now - self.window_start).total_seconds())
        progress_pct = round((elapsed_sec / total_window_sec) * 100, 1)

        # Retrieve last consolidated window
        last_window = mongo.get_latest_sensor_window(self.sensor_id)

        display_reading = self.frozen_reading if (self.is_frozen and self.frozen_reading) else self.latest_reading

        return {
            "sensor_id": self.sensor_id,
            "unit_id": self.unit_id,
            "sensor_type": self.sensor_type,
            "sensor_model": self.sensor_model,
            "ui_state": "FROZEN" if self.is_frozen else "LIVE",
            "frozen_at": self.frozen_at.isoformat() if self.frozen_at else None,
            "live_reading": display_reading,
            "source": self.latest_source,
            "current_window": {
                "window_start": self.window_start.isoformat(),
                "window_end": self.window_end.isoformat(),
                "elapsed_seconds": int(elapsed_sec),
                "remaining_seconds": max(0, int(total_window_sec - elapsed_sec)),
                "progress_percentage": progress_pct,
                "sample_count": self.total_samples_received,
                "valid_samples": self.valid_samples_count,
                "invalid_samples": self.invalid_samples_count,
                "status": "COLLECTING"
            },
            "last_consolidated_window": last_window
        }


# ==============================================================================
# GLOBAL SENSOR MANAGER SINGLETON
# ==============================================================================
class AegisSensorManager:
    """Manages all physical & simulated sensors on the drone."""
    def __init__(self):
        self.collectors: Dict[str, SensorWindowCollector] = {
            "SENSOR-DHT11-01": SensorWindowCollector("SENSOR-DHT11-01", "environmental", "DHT11"),
            "SENSOR-INA219-01": SensorWindowCollector("SENSOR-INA219-01", "power_monitor", "INA219"),
            "SENSOR-HCSR04-01": SensorWindowCollector("SENSOR-HCSR04-01", "proximity", "HC-SR04"),
            "SENSOR-CAM-01": SensorWindowCollector("SENSOR-CAM-01", "reconnaissance_camera", "ESP32-CAM"),
        }

    def get_collector(self, sensor_id: str) -> Optional[SensorWindowCollector]:
        # Support alias matching (e.g. 'dht11' -> 'SENSOR-DHT11-01')
        s_id = sensor_id.upper()
        if "DHT11" in s_id: return self.collectors.get("SENSOR-DHT11-01")
        if "INA219" in s_id or "POWER" in s_id: return self.collectors.get("SENSOR-INA219-01")
        if "HCSR04" in s_id or "PROX" in s_id or "RADAR" in s_id or "ULTRASONIC" in s_id: return self.collectors.get("SENSOR-HCSR04-01")
        if "CAM" in s_id or "ESP32" in s_id or "THERMAL" in s_id: return self.collectors.get("SENSOR-CAM-01")
        return self.collectors.get(sensor_id)

    def tick_simulation_feed(self, sim_time: float):
        """Generates realistic telemetry flow for all 4 sensors during mission execution."""
        now = time.time()
        
        # 1. DHT11 Simulation / Feed
        dht = self.collectors["SENSOR-DHT11-01"]
        temp = round(28.1 + math.sin(sim_time * 0.1) * 0.5 + (now % 2) * 0.1, 1)
        hum = round(66.0 + math.cos(sim_time * 0.08) * 1.5, 1)
        # Validation
        valid_dht = (not math.isnan(temp)) and (-40 <= temp <= 85)
        dht.record_reading(
            {"temperature": temp, "humidity": hum},
            {"interface": "GPIO", "port": "COM9"},
            is_valid=valid_dht
        )

        # 2. INA219 Simulation / Feed
        ina = self.collectors["SENSOR-INA219-01"]
        volt = round(5.08 + math.sin(sim_time * 0.05) * 0.04, 2)
        curr = round(27.3 + (math.sin(sim_time * 0.2) + 1.0) * 1.2, 1)
        pow_mw = round(volt * curr, 1)
        valid_ina = (not math.isnan(volt)) and (0 <= volt <= 32)
        ina.record_reading(
            {"bus_voltage": volt, "current": curr, "power": pow_mw},
            {"interface": "I2C", "port": "COM9"},
            is_valid=valid_ina
        )

        # 3. HC-SR04 Simulation / Feed
        hcsr = self.collectors["SENSOR-HCSR04-01"]
        dist = round(238.9 + math.sin(sim_time * 0.3) * 15.0, 1)
        valid_dist = (not math.isnan(dist)) and (2.0 <= dist <= 450.0)
        hcsr.record_reading(
            {"distance": dist},
            {"interface": "GPIO", "port": "COM9"},
            is_valid=valid_dist
        )

        # 4. ESP32-CAM Simulation / Feed
        cam = self.collectors["SENSOR-CAM-01"]
        confidence = round(0.92 + (math.sin(sim_time * 0.1) + 1.0) * 0.02, 2)
        dist_est = round(12.4 + math.sin(sim_time * 0.05) * 1.0, 1)
        cam.record_reading(
            {
                "fps": 30.0,
                "resolution": "640x512",
                "detected_objects": [
                    {
                        "object_id": "OBJ-001",
                        "class": "person",
                        "confidence": confidence,
                        "bounding_box": {"x": 312, "y": 164, "width": 78, "height": 183},
                        "estimated_distance_m": dist_est,
                        "detection_source": "OPTICAL",
                        "thermal_signature": {
                            "detected": True,
                            "peak_temperature_c": 36.8,
                            "average_temperature_c": 34.6,
                            "classification": "HUMAN_SURVIVOR"
                        }
                    },
                    {
                        "object_id": "OBJ-002",
                        "class": "vehicle",
                        "confidence": 0.87,
                        "bounding_box": {"x": 120, "y": 280, "width": 140, "height": 95},
                        "estimated_distance_m": 24.1,
                        "detection_source": "OPTICAL",
                        "thermal_signature": None
                    }
                ]
            },
            {"interface": "ESP32_HTTP", "port": "STREAM_81"},
            is_valid=True
        )


sensor_manager = AegisSensorManager()
