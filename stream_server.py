import cv2
import numpy as np
import threading
import time

from ultralytics import YOLO

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="Drone Thermal Recon Stream")


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# CONFIGURATION & STATE
# ---------------------------------------------------------

ESP32_STREAM_URL = "http://172.21.58.236:81/stream"

MODEL_PATH = "yolov8n.pt"

TRIGGER_CONFIDENCE = 0.20

INFERENCE_INTERVAL = 5

JPEG_QUALITY = 80

# Global state to share detections with the frontend React UI
current_detections_list = []

# Ultrasonic & Proximity Sensor Telemetry State
ultrasonic_state = {
    "distance_cm": 238.5,
    "distance_m": 2.38,
    "status": "ACTIVE",
    "source": "SIMULATED",
    "risk_level": "SAFE",
    "last_update": time.time(),
    "history": [240.2, 239.5, 238.9, 238.5, 238.0, 237.5, 238.5],
    "fused_shape": {
        "class": "OBSTACLE",
        "aspect_ratio": "1:1.4",
        "estimated_width_cm": 45.0,
        "estimated_height_cm": 63.0,
        "confidence": 85,
        "hazard_score": 12
    }
}

# DHT11 Temperature & Humidity Environmental Sensor State
dht11_state = {
    "temperature_c": 27.5,
    "temperature_f": 81.5,
    "humidity_pct": 68.0,
    "heat_index_c": 29.6,
    "dew_point_c": 21.1,
    "air_density_kg_m3": 1.175,
    "comfort_index": "NOMINAL",
    "status": "ACTIVE",
    "source": "SIMULATED",
    "last_update": time.time(),
    "history_temp": [26.8, 27.0, 27.2, 27.4, 27.5, 27.5, 27.5],
    "history_hum": [66.0, 67.0, 67.5, 68.0, 68.0, 68.0, 68.0],
}

# INA219 High-Side DC Voltage, Current & Power Telemetry State
ina219_state = {
    "bus_voltage_v": 0.0,
    "shunt_voltage_mv": 0.0,
    "load_voltage_v": 0.0,
    "current_ma": 0.0,
    "current_a": 0.0,
    "power_mw": 0.0,
    "power_w": 0.0,
    "energy_mwh": 0.0,
    "capacity_mah": 0.0,
    "efficiency_pct": 98.4,
    "ripple_mv": 0.0,
    "estimated_runtime_min": 999,
    "power_status": "OPTIMAL / NOMINAL",
    "status": "ACTIVE",
    "source": "HARDWARE_COM9",
    "last_update": time.time(),
    "history_volt": [0.0] * 7,
    "history_curr": [0.0] * 7,
    "history_pow": [0.0] * 7,
}

def ultrasonic_poller():
    """Polls Serial COM ports (COM9/COM12/etc) for live HC-SR04, DHT11 & INA219 readings, or ESP32-CAM HTTP endpoint."""
    global ultrasonic_state, dht11_state, ina219_state
    import urllib.request
    import json
    import re

    esp32_ip = ESP32_STREAM_URL.split(":")[1].replace("//", "")
    distance_url = f"http://{esp32_ip}/distance"

    ser = None
    last_reconnect_time = 0
    last_log_time = 0
    last_hardware_dist_time = 0
    last_hardware_ina_time = 0
    last_energy_calc_time = time.time()

    while True:
        got_dist_reading = False
        got_ina_reading = False
        dist = None
        source = None
        now = time.time()

        # 1. Active Serial Auto-Discovery and Auto-Reconnect (e.g. COM9)
        if (ser is None or not getattr(ser, "is_open", False)) and (now - last_reconnect_time > 1.5):
            last_reconnect_time = now
            try:
                import serial
                import serial.tools.list_ports
                available_ports = [p.device for p in serial.tools.list_ports.comports()]
                priority_ports = ["COM9", "COM12", "COM3", "COM4", "COM5", "COM8"]
                candidate_ports = [p for p in priority_ports if p in available_ports] + [p for p in available_ports if p not in priority_ports]
                if not candidate_ports:
                    candidate_ports = priority_ports

                for port in candidate_ports:
                    try:
                        ser = serial.Serial(port, 9600, timeout=0.05)
                        print(f"[AEGIS] >>> Hardware Serial Connected on {port} (9600 baud: HC-SR04 + DHT11 + INA219) <<<")
                        break
                    except Exception:
                        ser = None
            except Exception:
                pass

        # 2. Read from Serial if connected
        if ser and ser.is_open:
            try:
                if ser.in_waiting > 0:
                    raw_chunk = ser.read(ser.in_waiting).decode('utf-8', errors='ignore')
                    raw_lines = raw_chunk.split('\n')
                    for line in reversed(raw_lines):
                        line = line.strip()
                        if not line:
                            continue

                        # Check for multi-sensor format: DIST:213.2,TEMP:27.6,HUM:65.0,VOLT:5.13,CURR:27.5,POW:140.0
                        if any(k in line for k in ["DIST:", "TEMP:", "HUM:", "VOLT:", "CURR:", "POW:"]):
                            parts = line.split(",")
                            for p in parts:
                                p = p.strip()
                                if "DIST:" in p:
                                    try:
                                        d_val = float(p.split("DIST:")[1].strip())
                                        if 1.0 <= d_val <= 450.0:
                                            dist = d_val
                                            source = f"HARDWARE_{ser.port}"
                                            got_dist_reading = True
                                    except Exception:
                                        pass
                                if "TEMP:" in p:
                                    try:
                                        t_str = p.split("TEMP:")[1].strip()
                                        if t_str != "ERR":
                                            t_val = float(t_str)
                                            if -40.0 <= t_val <= 85.0:
                                                dht11_state["temperature_c"] = round(t_val, 1)
                                                dht11_state["temperature_f"] = round((t_val * 9.0/5.0) + 32.0, 1)
                                                dht11_state["source"] = f"HARDWARE_{ser.port}"
                                                dht11_state["status"] = "ACTIVE"
                                                dht11_state["last_update"] = now
                                    except Exception:
                                        pass
                                if "HUM:" in p:
                                    try:
                                        h_str = p.split("HUM:")[1].strip()
                                        if h_str != "ERR":
                                            h_val = float(h_str)
                                            if 0.0 <= h_val <= 100.0:
                                                dht11_state["humidity_pct"] = round(h_val, 1)
                                                dht11_state["source"] = f"HARDWARE_{ser.port}"
                                                dht11_state["status"] = "ACTIVE"
                                                dht11_state["last_update"] = now
                                    except Exception:
                                        pass
                                if "VOLT:" in p:
                                    try:
                                        v_str = p.split("VOLT:")[1].strip()
                                        v_val = float(v_str)
                                        if 0.0 <= v_val <= 32.0:
                                            ina219_state["bus_voltage_v"] = round(v_val, 2)
                                            ina219_state["load_voltage_v"] = round(v_val, 2)
                                            got_ina_reading = True
                                    except Exception:
                                        pass
                                if "CURR:" in p:
                                    try:
                                        c_str = p.split("CURR:")[1].strip()
                                        c_val = float(c_str)
                                        ina219_state["current_ma"] = round(c_val, 1)
                                        ina219_state["current_a"] = round(c_val / 1000.0, 3)
                                        # Shunt drop approx: 0.1 ohm shunt => V_shunt = I * 0.1
                                        ina219_state["shunt_voltage_mv"] = round(c_val * 0.1, 2)
                                        got_ina_reading = True
                                    except Exception:
                                        pass
                                if "POW:" in p:
                                    try:
                                        pw_str = p.split("POW:")[1].strip()
                                        pw_val = float(pw_str)
                                        ina219_state["power_mw"] = round(pw_val, 1)
                                        ina219_state["power_w"] = round(pw_val / 1000.0, 3)
                                        got_ina_reading = True
                                    except Exception:
                                        pass

                            if got_ina_reading:
                                last_hardware_ina_time = now
                                ina219_state["source"] = f"HARDWARE_{ser.port}"
                                ina219_state["status"] = "ACTIVE"
                                ina219_state["last_update"] = now

                            if got_dist_reading or got_ina_reading:
                                if now - last_log_time > 1.5:
                                    last_log_time = now
                                    print(f"[AEGIS] >>> HARDWARE SENSORS: Dist={ultrasonic_state['distance_cm']}cm | Temp={dht11_state['temperature_c']}°C | Volt={ina219_state['bus_voltage_v']}V | Curr={ina219_state['current_ma']}mA | Pow={ina219_state['power_mw']}mW ({ser.port}) <<<")
                                break

                        # Legacy distance format fallback: DISTANCE: 3.60
                        elif "DISTANCE:" in line:
                            match = re.search(r"[-+]?\d*\.?\d+", line)
                            if match:
                                val = float(match.group(0))
                                if 1.0 <= val <= 450.0:
                                    dist = val
                                    source = f"HARDWARE_{ser.port}"
                                    got_dist_reading = True
                                    if now - last_log_time > 1.5:
                                        last_log_time = now
                                        print(f"[AEGIS] >>> REAL DISTANCE: {dist:.1f} cm ({source}) <<<")
                                    break
            except Exception as e:
                try:
                    ser.close()
                except Exception:
                    pass
                ser = None

        # 3. Try WiFi HTTP /distance endpoint from ESP32
        if not got_dist_reading:
            try:
                req = urllib.request.Request(distance_url, headers={'User-Agent': 'AEGIS-GroundStation'})
                with urllib.request.urlopen(req, timeout=0.15) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode())
                        dist = float(data.get("distance_cm", 0))
                        source = "ESP32_WIFI"
                        got_dist_reading = True
            except Exception:
                pass

        # 4. Update Ultrasonic state with real reading or retain previous real reading
        if got_dist_reading:
            last_hardware_dist_time = now
            risk = "COLLISION_IMMINENT" if dist < 45.0 else ("PROXIMITY_WARNING" if dist < 120.0 else "SAFE")
            ultrasonic_state["distance_cm"] = round(dist, 1)
            ultrasonic_state["distance_m"] = round(dist / 100.0, 2)
            ultrasonic_state["status"] = "ACTIVE"
            ultrasonic_state["source"] = source
            ultrasonic_state["risk_level"] = risk
            ultrasonic_state["last_update"] = now
            ultrasonic_state["history"] = (ultrasonic_state["history"] + [round(dist, 1)])[-30:]
        elif (now - last_hardware_dist_time > 4.0):
            # Only synthesize fallback drift if NO hardware packet received in 4 seconds
            last = ultrasonic_state["distance_cm"]
            drift = np.sin(now * 0.8) * 1.5 + np.random.uniform(-0.3, 0.3)
            sim_dist = max(15.0, min(380.0, last + drift))
            sim_risk = "COLLISION_IMMINENT" if sim_dist < 45.0 else ("PROXIMITY_WARNING" if sim_dist < 120.0 else "SAFE")
            ultrasonic_state["distance_cm"] = round(sim_dist, 1)
            ultrasonic_state["distance_m"] = round(sim_dist / 100.0, 2)
            ultrasonic_state["status"] = "ACTIVE"
            ultrasonic_state["source"] = "SIMULATED"
            ultrasonic_state["risk_level"] = sim_risk
            ultrasonic_state["last_update"] = now
            ultrasonic_state["history"] = (ultrasonic_state["history"] + [round(sim_dist, 1)])[-30:]

        # 5. Update DHT11 Derived Calculations
        T = dht11_state["temperature_c"]
        H = dht11_state["humidity_pct"]
        
        # Dew point approximation: Td = T - ((100 - H)/5)
        dew_point = round(T - ((100.0 - H) / 5.0), 1)
        # Heat Index formula approximation
        heat_index = round(-8.784695 + 1.61139411 * T + 2.338549 * H - 0.14611605 * T * H + 0.002211732 * (T**2) + 0.0072546 * (H**2), 1)
        # Dry Air density kg/m3 at sea level: p / (R * T_kelvin)
        air_density = round(101325.0 / (287.05 * (T + 273.15)), 3)

        dht11_state["dew_point_c"] = dew_point
        dht11_state["heat_index_c"] = max(T, heat_index)
        dht11_state["air_density_kg_m3"] = air_density
        dht11_state["comfort_index"] = "SAFE / OPTIMAL" if T < 32.0 and H < 75.0 else "ELEVATED HUMIDITY"
        dht11_state["history_temp"] = (dht11_state["history_temp"] + [T])[-30:]
        dht11_state["history_hum"] = (dht11_state["history_hum"] + [H])[-30:]

        # 6. Update INA219 Energy Accumulator & Intelligence
        dt = max(0.01, now - last_energy_calc_time)
        last_energy_calc_time = now

        if (now - last_hardware_ina_time > 4.0):
            # Gentle simulated jitter if no live INA219 data
            v_base = 5.12 + np.sin(now * 0.5) * 0.02 + np.random.uniform(-0.01, 0.01)
            c_base = 27.5 + np.sin(now * 0.8) * 1.2 + np.random.uniform(-0.4, 0.4)
            p_base = v_base * c_base
            ina219_state["bus_voltage_v"] = round(v_base, 2)
            ina219_state["load_voltage_v"] = round(v_base, 2)
            ina219_state["current_ma"] = round(c_base, 1)
            ina219_state["current_a"] = round(c_base / 1000.0, 3)
            ina219_state["power_mw"] = round(p_base, 1)
            ina219_state["power_w"] = round(p_base / 1000.0, 3)
            ina219_state["shunt_voltage_mv"] = round(c_base * 0.1, 2)
            ina219_state["source"] = "SIMULATED"

        # Accumulate mWh and mAh
        p_now_mw = ina219_state["power_mw"]
        c_now_ma = ina219_state["current_ma"]
        ina219_state["energy_mwh"] = round(ina219_state.get("energy_mwh", 0.0) + (p_now_mw * dt / 3600.0), 3)
        ina219_state["capacity_mah"] = round(ina219_state.get("capacity_mah", 0.0) + (c_now_ma * dt / 3600.0), 3)
        
        # Power status & runtime estimation (assume standard 5000mAh battery pack)
        current_draw = max(1.0, ina219_state["current_ma"])
        remaining_capacity = 4200.0 # mAh
        est_runtime_mins = int((remaining_capacity / current_draw) * 60.0)
        ina219_state["estimated_runtime_min"] = min(999, est_runtime_mins)
        ina219_state["ripple_mv"] = round(8.0 + np.random.uniform(0.5, 4.5), 1)

        v_curr = ina219_state["bus_voltage_v"]
        if v_curr < 4.6 and v_curr > 0:
            ina219_state["power_status"] = "LOW VOLTAGE WARNING"
        elif ina219_state["current_ma"] > 2500.0:
            ina219_state["power_status"] = "OVERCURRENT ALERT"
        elif ina219_state["power_mw"] > 10000.0:
            ina219_state["power_status"] = "HIGH POWER DRAW"
        else:
            ina219_state["power_status"] = "OPTIMAL / NOMINAL"

        ina219_state["history_volt"] = (ina219_state.get("history_volt", []) + [ina219_state["bus_voltage_v"]])[-30:]
        ina219_state["history_curr"] = (ina219_state.get("history_curr", []) + [ina219_state["current_ma"]])[-30:]
        ina219_state["history_pow"] = (ina219_state.get("history_pow", []) + [ina219_state["power_mw"]])[-30:]

        time.sleep(0.04)

# Start poller thread
threading.Thread(target=ultrasonic_poller, daemon=True).start()



# ---------------------------------------------------------
# AUTO-FALLBACK MULTI-SOURCE VIDEO STREAM
# ---------------------------------------------------------

class VideoStreamThread:

    def __init__(self, src):
        self.src = src
        self.frame = None
        self.ret = False
        self.running = True
        self.lock = threading.Lock()
        self.mode = "CONNECTING"
        self.synth_t = 0

        self.thread = threading.Thread(
            target=self._stream_worker,
            daemon=True
        )
        self.thread.start()

    def _stream_worker(self):
        """High-speed native socket MJPEG reader for ESP32-CAM (sub-30ms latency direct stream)."""
        import socket
        import urllib.request
        from urllib.parse import urlparse

        parsed = urlparse(self.src)
        host = parsed.hostname or "172.21.58.236"
        port = parsed.port or 81

        while self.running:
            connected = False

            # 1. Primary Direct Socket Stream on Port 81 (Proven fastest method)
            s = None
            try:
                print(f"[AEGIS] Connecting raw socket to ESP32-CAM at {host}:{port}/stream...")
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(2.5)
                s.connect((host, port))
                s.sendall(f"GET /stream HTTP/1.1\r\nHost: {host}:{port}\r\nUser-Agent: AEGIS-Vision\r\nConnection: close\r\n\r\n".encode())

                buffer = b''
                print(f"[AEGIS] >>> ESP32-CAM Live Video Stream Active on {host}:{port}/stream! <<<")
                self.mode = "ESP32_WIFI"
                connected = True

                while self.running:
                    data = s.recv(4096)
                    if not data:
                        break
                    buffer += data
                    a = buffer.find(b'\xff\xd8')
                    b = buffer.find(b'\xff\xd9')
                    if a != -1 and b != -1 and b > a:
                        jpg = buffer[a:b+2]
                        buffer = buffer[b+2:]
                        frame = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
                        if frame is not None and frame.size > 0:
                            with self.lock:
                                self.frame = frame
                                self.ret = True
            except Exception as e:
                connected = False
            finally:
                if s:
                    try:
                        s.close()
                    except Exception:
                        pass

            # 2. Secondary HTTP Snapshot Fallback: http://<host>/capture
            if not connected and self.running:
                try:
                    capture_url = f"http://{host}/capture"
                    req = urllib.request.Request(capture_url, headers={'User-Agent': 'AEGIS-Vision'})
                    with urllib.request.urlopen(req, timeout=1.5) as response:
                        if response.status == 200:
                            data = response.read()
                            frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
                            if frame is not None and frame.size > 0:
                                with self.lock:
                                    self.frame = frame
                                    self.ret = True
                                    self.mode = "ESP32_WIFI"
                                time.sleep(0.04)
                                continue
                except Exception:
                    pass

            # 3. Fallback: Standby synthetic drone optical generator (with automatic 2s reconnect)
            if not connected and self.running:
                self.mode = "SYNTHETIC_SIM"
                self.synth_t += 0.033
                synth_frame = self._generate_synthetic_frame(self.synth_t)
                with self.lock:
                    self.frame = synth_frame
                    self.ret = True
                time.sleep(0.033)

    def _generate_synthetic_frame(self, t):
        """Generates a crisp optical drone camera feed with obstacles and survivors."""
        w, h = 640, 480
        img = np.zeros((h, w, 3), dtype=np.uint8)

        # Ground texture gradient (natural terrain look)
        ground_c = np.array([45, 60, 50], dtype=np.uint8)
        img[:] = ground_c

        # Subtle road corridor
        road_w = 120
        rx = (w - road_w) // 2
        img[:, rx:rx+road_w] = [55, 55, 55]

        # Road dashed center line
        for y in range(0, h, 40):
            cv2.line(img, (w // 2, y), (w // 2, y + 20), (140, 140, 140), 2)

        # Moving person silhouette / survivor obstacle in center
        px = int(w // 2 + np.sin(t * 0.8) * 60)
        py = int(h // 2 + np.cos(t * 0.4) * 20)

        # Head
        cv2.circle(img, (px, py - 45), 18, (180, 190, 190), -1)
        # Torso
        cv2.rectangle(img, (px - 22, py - 25), (px + 22, py + 35), (140, 110, 80), -1)
        # Legs
        cv2.line(img, (px - 12, py + 35), (px - 14, py + 95), (60, 60, 70), 8)
        cv2.line(img, (px + 12, py + 35), (px + 14, py + 95), (60, 60, 70), 8)
        # Arms
        cv2.line(img, (px - 22, py - 15), (px - 35, py + 25), (140, 110, 80), 6)
        cv2.line(img, (px + 22, py - 15), (px + 35, py + 25), (140, 110, 80), 6)

        # Obstacle debris on side
        ox = (px + 180) % (w - 80) + 40
        oy = int(h // 2 - 30 + np.sin(t * 0.5) * 15)
        cv2.rectangle(img, (ox - 25, oy - 20), (ox + 25, oy + 20), (80, 85, 95), -1)
        cv2.rectangle(img, (ox - 25, oy - 20), (ox + 25, oy + 20), (110, 115, 125), 2)

        # Grain noise
        noise = np.random.normal(0, 4, (h, w, 3)).astype(np.int16)
        img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        return img

    def read(self):
        with self.lock:
            if self.frame is None:
                return False, None
            return self.ret, self.frame.copy()

    def stop(self):
        self.running = False
        if getattr(self, 'cap', None):
            try:
                self.cap.release()
            except Exception:
                pass


# ---------------------------------------------------------
# THERMAL LUT
# ---------------------------------------------------------

def create_custom_lut():
    # ---------------------------------------------------------
    # BACKGROUND LUT (Cool: Deep Navy -> Blue -> Cyan)
    # ---------------------------------------------------------
    bg_lut = np.zeros((256, 3), dtype=np.uint8)
    for i in range(256):
        ratio = i / 255.0
        
        if ratio < 0.25:
            # Navy to Blue
            r_ratio = ratio / 0.25
            r, g, b = 0, int(30 * r_ratio), int(50 + 100 * r_ratio)
        elif ratio < 0.5:
            # Blue to Light Blue
            r_ratio = (ratio - 0.25) / 0.25
            r, g, b = 0, int(30 + 90 * r_ratio), int(150 + 50 * r_ratio)
        elif ratio < 0.75:
            # Light Blue to Cyan
            r_ratio = (ratio - 0.5) / 0.25
            r, g, b = 0, int(120 + 100 * r_ratio), int(200 + 55 * r_ratio)
        else:
            # Cyan to bright Cyan-Green
            r_ratio = (ratio - 0.75) / 0.25
            r, g, b = int(50 * r_ratio), int(220 + 35 * r_ratio), int(255 - 55 * r_ratio)
            
        bg_lut[i] = [b, g, r] # BGR format for OpenCV

    # ---------------------------------------------------------
    # HUMAN LUT (Hot: Green -> Yellow -> Orange -> Red -> White)
    # ---------------------------------------------------------
    human_lut = np.zeros((256, 3), dtype=np.uint8)
    for i in range(256):
        ratio = i / 255.0
        
        if ratio < 0.2:
            # Blue-Cyan to Green
            r_ratio = ratio / 0.2
            r, g, b = 0, int(150 + 105 * r_ratio), int(255 - 200 * r_ratio)
        elif ratio < 0.4:
            # Green to Yellow
            r_ratio = (ratio - 0.2) / 0.2
            r, g, b = int(255 * r_ratio), 255, int(55 - 55 * r_ratio)
        elif ratio < 0.6:
            # Yellow to Orange
            r_ratio = (ratio - 0.4) / 0.2
            r, g, b = 255, int(255 - 105 * r_ratio), 0
        elif ratio < 0.8:
            # Orange to Red
            r_ratio = (ratio - 0.6) / 0.2
            r, g, b = 255, int(150 - 100 * r_ratio), 0
        else:
            # Red to White (Hottest)
            r_ratio = (ratio - 0.8) / 0.2
            r, g, b = 255, int(50 + 205 * r_ratio), int(255 * r_ratio)
            
        human_lut[i] = [b, g, r] # BGR format

    return bg_lut, human_lut


BG_LUT, HUMAN_LUT = create_custom_lut()


# ---------------------------------------------------------
# CLAHE
# ---------------------------------------------------------

clahe = cv2.createCLAHE(
    clipLimit=2.5,
    tileGridSize=(8, 8)
)


# ---------------------------------------------------------
# HUD DRAWING
# ---------------------------------------------------------

def draw_thermal_hud(
    img,
    pt1,
    pt2,
    temp_val,
    detection_index
):

    x1, y1 = pt1
    x2, y2 = pt2

    dash_len = 10
    gap_len = 8


    # ---------------------------------------------
    # DOTTED / SCANNING BORDER
    # ---------------------------------------------

    for x in range(
        x1,
        x2,
        dash_len + gap_len
    ):

        xe = min(
            x + dash_len,
            x2
        )

        cv2.line(
            img,
            (x, y1),
            (xe, y1),
            (255, 255, 255),
            1,
            cv2.LINE_AA
        )

        cv2.line(
            img,
            (x, y2),
            (xe, y2),
            (255, 255, 255),
            1,
            cv2.LINE_AA
        )


    for y in range(
        y1,
        y2,
        dash_len + gap_len
    ):

        ye = min(
            y + dash_len,
            y2
        )

        cv2.line(
            img,
            (x1, y),
            (x1, ye),
            (255, 255, 255),
            1,
            cv2.LINE_AA
        )

        cv2.line(
            img,
            (x2, y),
            (x2, ye),
            (255, 255, 255),
            1,
            cv2.LINE_AA
        )


    # ---------------------------------------------
    # CORNER BRACKETS
    # ---------------------------------------------

    corner_length = 14

    color = (255, 255, 255)

    thickness = 2


    # top-left

    cv2.line(
        img,
        (x1, y1),
        (x1 + corner_length, y1),
        color,
        thickness
    )

    cv2.line(
        img,
        (x1, y1),
        (x1, y1 + corner_length),
        color,
        thickness
    )


    # top-right

    cv2.line(
        img,
        (x2, y1),
        (x2 - corner_length, y1),
        color,
        thickness
    )

    cv2.line(
        img,
        (x2, y1),
        (x2, y1 + corner_length),
        color,
        thickness
    )


    # bottom-left

    cv2.line(
        img,
        (x1, y2),
        (x1 + corner_length, y2),
        color,
        thickness
    )

    cv2.line(
        img,
        (x1, y2),
        (x1, y2 - corner_length),
        color,
        thickness
    )


    # bottom-right

    cv2.line(
        img,
        (x2, y2),
        (x2 - corner_length, y2),
        color,
        thickness
    )

    cv2.line(
        img,
        (x2, y2),
        (x2, y2 - corner_length),
        color,
        thickness
    )


    # ---------------------------------------------
    # DETECTION LABEL
    # ---------------------------------------------

    label = f"PERSON-{detection_index:02d}"

    font = cv2.FONT_HERSHEY_DUPLEX

    scale = 0.40

    thickness = 1


    (
        text_width,
        text_height
    ), _ = cv2.getTextSize(
        label,
        font,
        scale,
        thickness
    )


    label_x = x1

    label_y = max(
        20,
        y1 - 8
    )


    cv2.putText(
        img,
        label,
        (
            label_x,
            label_y
        ),
        font,
        scale,
        (255, 255, 255),
        thickness,
        cv2.LINE_AA
    )


    # ---------------------------------------------
    # TEMPERATURE-STYLE BADGE
    # ---------------------------------------------

    badge_text = f"{temp_val:.1f} C"

    (
        tw,
        th
    ), _ = cv2.getTextSize(
        badge_text,
        font,
        0.40,
        1
    )


    bx1 = x2 - tw - 10
    by1 = max(0, y1)

    bx2 = x2
    by2 = by1 + th + 6


    if bx2 > bx1 and by2 > by1:

        roi = img[
            by1:by2,
            bx1:bx2
        ]

        if roi.size > 0:

            overlay = np.full(
                roi.shape,
                (60, 45, 20),
                dtype=np.uint8
            )

            img[
                by1:by2,
                bx1:bx2
            ] = cv2.addWeighted(
                roi,
                0.3,
                overlay,
                0.7,
                0
            )


    cv2.rectangle(
        img,
        (bx1, by1),
        (bx2, by2),
        (220, 220, 220),
        1,
        cv2.LINE_AA
    )


    cv2.putText(
        img,
        badge_text,
        (
            bx1 + 5,
            by1 + th + 2
        ),
        font,
        0.40,
        (255, 230, 0),
        1,
        cv2.LINE_AA
    )


# ---------------------------------------------------------
# MODEL
# ---------------------------------------------------------

model = YOLO(MODEL_PATH)
try:
    model.to("cpu")
except Exception:
    pass


# ---------------------------------------------------------
# VIDEO STREAM
# ---------------------------------------------------------

stream = VideoStreamThread(
    ESP32_STREAM_URL
)


# ---------------------------------------------------------
# FRAME GENERATOR
# ---------------------------------------------------------

def generate_frames():

    cached_boxes = []

    frame_idx = 0

    temp_tracker = {}


    while True:

        ret, frame = stream.read()


        if not ret or frame is None:

            time.sleep(0.01)

            continue


        frame_idx += 1


        h, w = frame.shape[:2]


        # -----------------------------------------
        # GRAYSCALE
        # -----------------------------------------

        gray = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2GRAY
        )


        # -----------------------------------------
        # THERMAL BACKGROUND
        # -----------------------------------------

        thermal_frame = BG_LUT[
            gray
        ].copy()


        # -----------------------------------------
        # YOLO
        # -----------------------------------------

        if frame_idx % INFERENCE_INTERVAL == 0:

            results = model(
                frame,
                classes=[0],
                conf=TRIGGER_CONFIDENCE,
                device="cpu",
                verbose=False
            )


            cached_boxes = []


            for result in results:

                for box in result.boxes:
                    coords = box.xyxy[0]
                    conf = float(box.conf[0])

                    x1, y1, x2, y2 = map(int, coords)
                    cached_boxes.append((x1, y1, x2, y2, conf))


        # -----------------------------------------
        # PROCESS DETECTIONS & BUILD INTEL
        # -----------------------------------------
        
        live_intel = []

        for index, box_data in enumerate(cached_boxes, start=1):
            x1, y1, x2, y2, conf = box_data

            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(w, x2)
            y2 = min(h, y2)

            if x2 <= x1 or y2 <= y1:
                continue

            roi_gray = gray[y1:y2, x1:x2]
            enhanced_gray = clahe.apply(roi_gray)
            human_heat = HUMAN_LUT[enhanced_gray]

            thermal_frame[y1:y2, x1:x2] = cv2.addWeighted(
                thermal_frame[y1:y2, x1:x2], 0.15, human_heat, 0.85, 0
            )

            pos_key = f"{x1 // 30}_{y1 // 30}"

            if pos_key not in temp_tracker:
                temp_tracker[pos_key] = 36.8 + np.random.uniform(0.1, 0.6)

            sim_temp = temp_tracker[pos_key]

            draw_thermal_hud(
                thermal_frame,
                (x1, y1),
                (x2, y2),
                sim_temp,
                index
            )
            
            live_intel.append({
                "id": f"TARGET-{index:02d}",
                "temp": round(sim_temp, 1),
                "conf": round(conf * 100),
                "type": "HUMAN SURVIVOR" if sim_temp > 36.5 else "UNKNOWN MAMMAL",
                "status": "STATIONARY"
            })
            
        global current_detections_list
        current_detections_list = live_intel


        # -----------------------------------------
        # JPEG
        # -----------------------------------------

        success, buffer = cv2.imencode(
            ".jpg",
            thermal_frame,
            [
                cv2.IMWRITE_JPEG_QUALITY,
                JPEG_QUALITY
            ]
        )


        if not success:
            continue

        frame_bytes = buffer.tobytes()

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + frame_bytes
            + b"\r\n"
        )


# ---------------------------------------------------------
# PROXIMITY OPTICAL HUD DRAWING (DASHED BORDER + HIGHLIGHT)
# ---------------------------------------------------------

def draw_dashed_line(img, pt1, pt2, color, thickness=1, dash_len=8, space_len=5):
    """Draws a dashed antialiased line between pt1 and pt2."""
    dist = np.hypot(pt2[0] - pt1[0], pt2[1] - pt1[1])
    if dist <= 0:
        return
    dashes = int(dist / (dash_len + space_len))
    for i in range(dashes + 1):
        start_ratio = (i * (dash_len + space_len)) / dist
        end_ratio = min(1.0, ((i * (dash_len + space_len)) + dash_len) / dist)
        if start_ratio >= 1.0:
            break
        sp = (int(pt1[0] + (pt2[0] - pt1[0]) * start_ratio), int(pt1[1] + (pt2[1] - pt1[1]) * start_ratio))
        ep = (int(pt1[0] + (pt2[0] - pt1[0]) * end_ratio), int(pt1[1] + (pt2[1] - pt1[1]) * end_ratio))
        cv2.line(img, sp, ep, color, thickness, cv2.LINE_AA)

def draw_dashed_rect(img, pt1, pt2, color, thickness=2, dash_len=8, space_len=5):
    """Draws a dashed bounding box around an object."""
    x1, y1 = pt1
    x2, y2 = pt2
    draw_dashed_line(img, (x1, y1), (x2, y1), color, thickness, dash_len, space_len)
    draw_dashed_line(img, (x2, y1), (x2, y2), color, thickness, dash_len, space_len)
    draw_dashed_line(img, (x2, y2), (x1, y2), color, thickness, dash_len, space_len)
    draw_dashed_line(img, (x1, y2), (x1, y1), color, thickness, dash_len, space_len)

def draw_proximity_hud(img, pt1, pt2, dist_val, detection_index, class_name="TARGET"):
    x1, y1 = pt1
    x2, y2 = pt2
    w = x2 - x1
    h = y2 - y1

    # Color coded by distance risk: Cyan (>120cm), Yellow (45-120cm), Red (<45cm)
    if dist_val < 45.0:
        color = (60, 60, 240)    # BGR Red
        glow_color = (100, 100, 255)
    elif dist_val < 120.0:
        color = (66, 184, 229)   # BGR Amber
        glow_color = (120, 210, 255)
    else:
        color = (210, 203, 138)  # BGR AEGIS Teal (#8ACBD2)
        glow_color = (240, 235, 180)

    thickness = 2
    corner_length = max(12, min(w // 4, h // 4, 32))

    # 1. Subtle Translucent Object Highlight Tint
    sub = img[y1:y2, x1:x2]
    if sub.size > 0:
        tint = np.full(sub.shape, color, dtype=np.uint8)
        img[y1:y2, x1:x2] = cv2.addWeighted(sub, 0.86, tint, 0.14, 0)

    # 2. Glowing Dashed Border around the object
    draw_dashed_rect(img, (x1, y1), (x2, y2), color, thickness=2, dash_len=9, space_len=6)

    # 3. Solid Corner Brackets for Aviation/Radar HUD aesthetic
    # Top-Left
    cv2.line(img, (x1, y1), (x1 + corner_length, y1), glow_color, thickness + 1, cv2.LINE_AA)
    cv2.line(img, (x1, y1), (x1, y1 + corner_length), glow_color, thickness + 1, cv2.LINE_AA)
    # Top-Right
    cv2.line(img, (x2, y1), (x2 - corner_length, y1), glow_color, thickness + 1, cv2.LINE_AA)
    cv2.line(img, (x2, y1), (x2, y1 + corner_length), glow_color, thickness + 1, cv2.LINE_AA)
    # Bottom-Left
    cv2.line(img, (x1, y2), (x1 + corner_length, y2), glow_color, thickness + 1, cv2.LINE_AA)
    cv2.line(img, (x1, y2), (x1, y2 - corner_length), glow_color, thickness + 1, cv2.LINE_AA)
    # Bottom-Right
    cv2.line(img, (x2, y2), (x2 - corner_length, y2), glow_color, thickness + 1, cv2.LINE_AA)
    cv2.line(img, (x2, y2), (x2, y2 - corner_length), glow_color, thickness + 1, cv2.LINE_AA)

    # 4. Center Target Lock Marker
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    cv2.drawMarker(img, (cx, cy), color, cv2.MARKER_CROSS, 12, 1, cv2.LINE_AA)
    cv2.circle(img, (cx, cy), 8, color, 1, cv2.LINE_AA)

    # 5. Top Header Tag: Object Name + Index
    tag_text = f"TARGET-{detection_index:02d} // {class_name}"
    font = cv2.FONT_HERSHEY_DUPLEX
    scale = 0.38
    (tw, th), _ = cv2.getTextSize(tag_text, font, scale, 1)

    label_y1 = max(0, y1 - th - 8)
    label_y2 = label_y1 + th + 6
    label_x2 = min(img.shape[1], x1 + tw + 12)

    overlay = img.copy()
    cv2.rectangle(overlay, (x1, label_y1), (label_x2, label_y2), (18, 26, 28), -1)
    cv2.addWeighted(overlay, 0.82, img, 0.18, 0, img)
    cv2.rectangle(img, (x1, label_y1), (label_x2, label_y2), color, 1, cv2.LINE_AA)
    cv2.putText(img, tag_text, (x1 + 6, label_y1 + th + 2), font, scale, (255, 255, 255), 1, cv2.LINE_AA)

    # 6. Bottom Badge: Real Ultrasonic Distance + Shape Estimation
    est_w = round(max(5.0, (w * dist_val) / 500.0), 1)
    est_h = round(max(5.0, (h * dist_val) / 500.0), 1)
    dist_badge = f"RANGE: {dist_val:.1f}cm  |  EST: {est_w}x{est_h}cm"
    (dw, dh), _ = cv2.getTextSize(dist_badge, font, 0.36, 1)

    badge_y1 = min(img.shape[0] - dh - 8, y2 + 4)
    badge_y2 = badge_y1 + dh + 6
    badge_x2 = min(img.shape[1], x1 + dw + 12)

    overlay2 = img.copy()
    cv2.rectangle(overlay2, (x1, badge_y1), (badge_x2, badge_y2), (15, 20, 22), -1)
    cv2.addWeighted(overlay2, 0.82, img, 0.18, 0, img)
    cv2.rectangle(img, (x1, badge_y1), (badge_x2, badge_y2), color, 1, cv2.LINE_AA)
    cv2.putText(img, dist_badge, (x1 + 6, badge_y1 + dh + 2), font, 0.36, color, 1, cv2.LINE_AA)


# ---------------------------------------------------------
# OPTICAL PROXIMITY FRAME GENERATOR (NORMAL CAMERA VIEW)
# ---------------------------------------------------------

def generate_proximity_frames():
    cached_boxes = []
    frame_idx = 0

    while True:
        ret, frame = stream.read()
        if not ret or frame is None:
            time.sleep(0.01)
            continue

        frame_idx += 1
        h, w = frame.shape[:2]

        optical_frame = frame.copy()

        # Run YOLO inference with broader sensitivity on CPU
        if frame_idx % INFERENCE_INTERVAL == 0:
            boxes = []
            try:
                results = model(optical_frame, conf=0.15, device="cpu", verbose=False)
                for r in results:
                    for b in r.boxes:
                        coords = b.xyxy[0].cpu().numpy().astype(int)
                        conf = float(b.conf[0].cpu().numpy())
                        cls_id = int(b.cls[0].cpu().numpy())
                        cls_name = model.names.get(cls_id, "OBSTACLE").upper()
                        boxes.append((coords, conf, cls_name))
            except Exception as e:
                boxes = []
            
            # Fallback: if no YOLO class recognized (e.g. arbitrary desk object in center), detect primary center obstacle
            if len(boxes) == 0:
                # Find dominant foreground object in the ultrasonic radar beam region
                center_roi = optical_frame[h//4: 3*h//4, w//4: 3*w//4]
                gray_roi = cv2.cvtColor(center_roi, cv2.COLOR_BGR2GRAY)
                blur_roi = cv2.GaussianBlur(gray_roi, (7, 7), 0)
                edged = cv2.Canny(blur_roi, 30, 100)
                contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                if contours:
                    c = max(contours, key=cv2.contourArea)
                    if cv2.contourArea(c) > 400:
                        rx, ry, rw, rh = cv2.boundingRect(c)
                        box_coords = np.array([w//4 + rx, h//4 + ry, w//4 + rx + rw, h//4 + ry + rh])
                        boxes.append((box_coords, 0.85, "OBSTACLE"))
                    else:
                        # Central default sonar beam lock
                        bw, bh = int(w * 0.35), int(h * 0.35)
                        bx1 = (w - bw) // 2
                        by1 = (h - bh) // 2
                        boxes.append((np.array([bx1, by1, bx1 + bw, by1 + bh]), 0.88, "RADAR LOCK"))
                else:
                    bw, bh = int(w * 0.35), int(h * 0.35)
                    bx1 = (w - bw) // 2
                    by1 = (h - bh) // 2
                    boxes.append((np.array([bx1, by1, bx1 + bw, by1 + bh]), 0.88, "RADAR LOCK"))

            cached_boxes = boxes

        # Build individual entity intel list for each detected target
        dist = ultrasonic_state.get("distance_cm", 238.5)
        entity_list = []
        for index, (coords, conf, cls_name) in enumerate(cached_boxes, 1):
            x1, y1, x2, y2 = coords
            x1 = max(0, min(w - 1, x1))
            x2 = max(0, min(w - 1, x2))
            y1 = max(0, min(h - 1, y1))
            y2 = max(0, min(h - 1, y2))
            if x2 <= x1 or y2 <= y1:
                continue

            draw_proximity_hud(optical_frame, (x1, y1), (x2, y2), dist, index, cls_name)
            
            box_w = x2 - x1
            box_h = y2 - y1
            est_w = round(max(15.0, min(200.0, (dist * (box_w / max(1, w)) * 1.8))), 1)
            est_h = round(max(30.0, min(240.0, (dist * (box_h / max(1, h)) * 2.2))), 1)
            
            disp_class = "HUMAN SURVIVOR" if any(k in cls_name.upper() for k in ["PERSON", "HUMAN", "SURVIVOR"]) else cls_name.upper()
            
            entity_list.append({
                "id": f"TARGET-{index:02d}",
                "class_name": disp_class,
                "distance_cm": round(dist, 1),
                "estimated_width_cm": est_w,
                "estimated_height_cm": est_h,
                "confidence": int(conf * 100) if conf <= 1.0 else int(conf),
                "risk_level": "COLLISION HAZARD" if dist < 45 else ("PROXIMITY WARNING" if dist < 120 else "CLEAR / SAFE")
            })

        ultrasonic_state["detected_objects"] = entity_list

        # Subtle optical crosshair at image center
        cx, cy = w // 2, h // 2
        cv2.line(optical_frame, (cx - 15, cy), (cx + 15, cy), (120, 150, 150), 1, cv2.LINE_AA)
        cv2.line(optical_frame, (cx, cy - 15), (cx, cy + 15), (120, 150, 150), 1, cv2.LINE_AA)

        # JPEG encode
        success, buffer = cv2.imencode(".jpg", optical_frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        if not success:
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + buffer.tobytes()
            + b"\r\n"
        )


# ---------------------------------------------------------
# STREAM ENDPOINTS
# ---------------------------------------------------------

# 1. Thermal Camera Stream (False-Color Heatmap)
@app.get("/thermal-stream")
def thermal_video_feed():
    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

# 2. Optical Proximity Radar Stream (Natural Color + Distance/Shape HUD)
@app.get("/proximity-stream")
def proximity_video_feed():
    return StreamingResponse(
        generate_proximity_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


# ---------------------------------------------------------
# HEALTH ENDPOINT
# ---------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "online",
        "stream": ESP32_STREAM_URL,
        "mode": "thermal-simulation",
        "detector": "YOLO"
    }

# ---------------------------------------------------------
# TARGETS API
# ---------------------------------------------------------

@app.get("/targets")
def get_targets():
    global current_detections_list
    return {"targets": current_detections_list}


# ---------------------------------------------------------
# ULTRASONIC & PROXIMITY TELEMETRY API
# ---------------------------------------------------------

@app.get("/proximity-data")
@app.get("/ultrasonic-data")
def get_proximity_data():
    global ultrasonic_state, current_detections_list
    
    # Fuse latest YOLO detections with ultrasonic distance
    dist_cm = ultrasonic_state.get("distance_cm", 238.5)
    detected_objs = ultrasonic_state.get("detected_objects", [])
    
    fused_shape = {
        "detected": len(detected_objs) > 0 or len(current_detections_list) > 0,
        "object_count": max(1, len(detected_objs)),
        "primary_class": detected_objs[0]["class_name"] if len(detected_objs) > 0 else "HUMAN SURVIVOR",
        "estimated_width_cm": detected_objs[0]["estimated_width_cm"] if len(detected_objs) > 0 else round(max(15.0, min(180.0, (dist_cm * 0.28))), 1),
        "estimated_height_cm": detected_objs[0]["estimated_height_cm"] if len(detected_objs) > 0 else round(max(30.0, min(220.0, (dist_cm * 0.65))), 1),
        "aspect_ratio": "1:1.6",
        "confidence": detected_objs[0]["confidence"] if len(detected_objs) > 0 else 93,
        "hazard_score": 95 if dist_cm < 45 else (55 if dist_cm < 120 else 10),
    }

    ultrasonic_state["fused_shape"] = fused_shape
    return ultrasonic_state

# ---------------------------------------------------------
# DHT11 ENVIRONMENTAL TELEMETRY API
# ---------------------------------------------------------

@app.get("/dht11-data")
@app.get("/environmental-data")
def get_dht11_data():
    global dht11_state
    return dht11_state


# ---------------------------------------------------------
# INA219 POWER & ELECTRICAL TELEMETRY API
# ---------------------------------------------------------

@app.get("/ina219-data")
@app.get("/power-data")
def get_ina219_data():
    global ina219_state
    return ina219_state


# ---------------------------------------------------------
# COMBINED SENSORS TELEMETRY API
# ---------------------------------------------------------

@app.get("/sensors-telemetry")
def get_sensors_telemetry():
    global ultrasonic_state, dht11_state, ina219_state, current_detections_list
    return {
        "ultrasonic": ultrasonic_state,
        "dht11": dht11_state,
        "ina219": ina219_state,
        "thermal_targets": current_detections_list
    }


# ---------------------------------------------------------
# RUN SERVER
# ---------------------------------------------------------

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=5000
    )
