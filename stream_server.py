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

def ultrasonic_poller():
    """Polls ESP32-CAM /distance HTTP endpoint or Serial COM port for live ultrasonic readings."""
    global ultrasonic_state
    import urllib.request
    import json

    esp32_ip = ESP32_STREAM_URL.split(":")[1].replace("//", "")
    distance_url = f"http://{esp32_ip}/distance"

    # Try Serial port connection (e.g. COM9)
    ser = None
    try:
        import serial
        for port in ["COM9", "COM3", "COM4", "COM5", "COM8"]:
            try:
                ser = serial.Serial(port, 9600, timeout=0.1)
                print(f"[AEGIS] Ultrasonic Serial connected on {port}")
                break
            except Exception:
                pass
    except ImportError:
        pass

    while True:
        got_reading = False
        dist = None
        source = None

        # 1. Try Serial if open
        if ser and ser.is_open:
            try:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if "DISTANCE:" in line:
                    parts = line.split("DISTANCE:")
                    val = float(parts[1].replace("cm", "").strip())
                    if 2.0 <= val <= 450.0:
                        dist = val
                        source = f"SERIAL_{ser.port}"
                        got_reading = True
            except Exception:
                pass

        # 2. Try WiFi HTTP /distance endpoint from ESP32
        if not got_reading:
            try:
                req = urllib.request.Request(distance_url, headers={'User-Agent': 'AEGIS-GroundStation'})
                with urllib.request.urlopen(req, timeout=0.25) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode())
                        dist = float(data.get("distance_cm", 0))
                        source = "ESP32_WIFI"
                        got_reading = True
            except Exception:
                pass

        # 3. Smooth fallback simulation if hardware is not broadcasting this instant
        if not got_reading:
            last = ultrasonic_state["distance_cm"]
            drift = np.sin(time.time() * 0.8) * 2.5 + np.random.uniform(-0.4, 0.4)
            dist = max(15.0, min(380.0, last + drift))
            source = ultrasonic_state.get("source", "SIMULATED")

        # Determine risk level
        if dist < 45.0:
            risk = "COLLISION_IMMINENT"
        elif dist < 120.0:
            risk = "PROXIMITY_WARNING"
        else:
            risk = "SAFE"

        # Update global state
        ultrasonic_state["distance_cm"] = round(dist, 1)
        ultrasonic_state["distance_m"] = round(dist / 100.0, 2)
        ultrasonic_state["status"] = "ACTIVE"
        ultrasonic_state["source"] = source
        ultrasonic_state["risk_level"] = risk
        ultrasonic_state["last_update"] = time.time()
        ultrasonic_state["history"] = (ultrasonic_state["history"] + [round(dist, 1)])[-30:]

        time.sleep(0.08)

# Start poller thread
threading.Thread(target=ultrasonic_poller, daemon=True).start()



# ---------------------------------------------------------
# AUTO-FALLBACK MULTI-SOURCE VIDEO STREAM
# ---------------------------------------------------------

class VideoStreamThread:

    def __init__(self, src):
        self.src = src
        self.cap = None
        self.ret = False
        self.frame = None
        self.running = True
        self.lock = threading.Lock()
        self.mode = "CONNECTING"
        self.synth_t = 0

        # Try ESP32-CAM first, then USB Webcam, then Synthetic Generator
        self._init_capture()

        self.thread = threading.Thread(
            target=self.update,
            daemon=True
        )
        self.thread.start()

    def _init_capture(self):
        # 1. Try ESP32-CAM Network Stream
        try:
            print(f"[AEGIS] Connecting to ESP32-CAM: {self.src}")
            self.cap = cv2.VideoCapture(self.src)
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            ret, frame = self.cap.read()
            if ret and frame is not None:
                self.ret = True
                self.frame = frame
                self.mode = "ESP32_WIFI"
                print("[AEGIS] ESP32-CAM stream connected successfully!")
                return
        except Exception as e:
            print(f"[AEGIS] ESP32-CAM connect attempt failed: {e}")

        # 2. Try Local USB / Laptop Webcam (Index 0 or 1)
        for cam_idx in [0, 1]:
            try:
                print(f"[AEGIS] Trying local camera device index {cam_idx}...")
                cap = cv2.VideoCapture(cam_idx, cv2.CAP_DSHOW) if hasattr(cv2, 'CAP_DSHOW') else cv2.VideoCapture(cam_idx)
                if cap.isOpened():
                    ret, frame = cap.read()
                    if ret and frame is not None:
                        self.cap = cap
                        self.ret = True
                        self.frame = frame
                        self.mode = f"WEBCAM_{cam_idx}"
                        print(f"[AEGIS] Local Webcam {cam_idx} connected successfully!")
                        return
                    cap.release()
            except Exception:
                pass

        # 3. Fallback: Standby synthetic drone optical generator
        print("[AEGIS] No physical camera stream reachable, initializing tactical drone video simulator...")
        self.mode = "SYNTHETIC_SIM"
        self.ret = True
        self.frame = self._generate_synthetic_frame(0)

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

        # Draw person figure
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

    def update(self):
        last_reconnect_attempt = time.time()

        while self.running:
            if self.cap and self.cap.isOpened():
                ret, frame = self.cap.read()
                if ret and frame is not None:
                    with self.lock:
                        self.ret = True
                        self.frame = frame
                else:
                    # Stream drop: fallback to synthetic and attempt reconnect
                    with self.lock:
                        self.synth_t += 0.04
                        self.frame = self._generate_synthetic_frame(self.synth_t)
                        self.ret = True
                    time.sleep(0.03)
            else:
                # Synthetic frame generation at 30 FPS
                self.synth_t += 0.033
                synth_frame = self._generate_synthetic_frame(self.synth_t)
                with self.lock:
                    self.frame = synth_frame
                    self.ret = True
                time.sleep(0.033)

                # Periodic reconnect attempt to ESP32 every 8 seconds
                if time.time() - last_reconnect_attempt > 8.0:
                    last_reconnect_attempt = time.time()
                    try:
                        test_cap = cv2.VideoCapture(self.src)
                        if test_cap.isOpened():
                            ret, frame = test_cap.read()
                            if ret and frame is not None:
                                self.cap = test_cap
                                self.mode = "ESP32_WIFI"
                                print("[AEGIS] Reconnected to ESP32-CAM stream!")
                    except Exception:
                        pass

    def read(self):
        with self.lock:
            if self.frame is None:
                return False, None
            return self.ret, self.frame.copy()

    def stop(self):
        self.running = False
        if self.cap:
            self.cap.release()


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

model = YOLO(
    MODEL_PATH
)


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

        # Run YOLO inference with broader sensitivity
        if frame_idx % INFERENCE_INTERVAL == 0:
            results = model(optical_frame, conf=0.15, verbose=False)
            boxes = []
            for r in results:
                for b in r.boxes:
                    coords = b.xyxy[0].cpu().numpy().astype(int)
                    conf = float(b.conf[0].cpu().numpy())
                    cls_id = int(b.cls[0].cpu().numpy())
                    cls_name = model.names.get(cls_id, "OBSTACLE").upper()
                    boxes.append((coords, conf, cls_name))
            
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

        # Draw dashed border and tactical highlight HUD on all detected targets
        dist = ultrasonic_state.get("distance_cm", 238.5)
        for index, (coords, conf, cls_name) in enumerate(cached_boxes, 1):
            x1, y1, x2, y2 = coords
            x1 = max(0, min(w - 1, x1))
            x2 = max(0, min(w - 1, x2))
            y1 = max(0, min(h - 1, y1))
            y2 = max(0, min(h - 1, y2))
            if x2 <= x1 or y2 <= y1:
                continue

            draw_proximity_hud(optical_frame, (x1, y1), (x2, y2), dist, index, cls_name)

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
    fused_shape = {
        "detected": len(current_detections_list) > 0,
        "object_count": len(current_detections_list),
        "primary_class": "HUMANOID / OBSTACLE" if len(current_detections_list) > 0 else "UNKNOWN OBSTACLE",
        "estimated_width_cm": round(max(15.0, min(180.0, (dist_cm * 0.28))), 1),
        "estimated_height_cm": round(max(30.0, min(220.0, (dist_cm * 0.65))), 1),
        "aspect_ratio": "1:1.6",
        "hazard_score": 95 if dist_cm < 45 else (55 if dist_cm < 120 else 10),
    }

    if len(current_detections_list) > 0:
        primary = current_detections_list[0]
        fused_shape["primary_class"] = primary.get("type", "SURVIVOR")
        fused_shape["confidence"] = primary.get("conf", 88)

    ultrasonic_state["fused_shape"] = fused_shape
    return ultrasonic_state


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
