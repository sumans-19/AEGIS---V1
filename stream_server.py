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



# ---------------------------------------------------------
# THREADED VIDEO STREAM
# ---------------------------------------------------------

class VideoStreamThread:

    def __init__(self, src):

        self.cap = cv2.VideoCapture(src)

        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        self.ret = False
        self.frame = None

        self.running = True

        self.lock = threading.Lock()

        self.thread = threading.Thread(
            target=self.update,
            daemon=True
        )

        self.thread.start()


    def update(self):

        while self.running:

            ret, frame = self.cap.read()

            if ret and frame is not None:

                with self.lock:

                    self.ret = ret
                    self.frame = frame

            else:

                time.sleep(0.005)


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
# STREAM ENDPOINT
# ---------------------------------------------------------

@app.get("/thermal-stream")
def video_feed():

    return StreamingResponse(
        generate_frames(),
        media_type=(
            "multipart/x-mixed-replace;"
            " boundary=frame"
        )
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
# RUN SERVER
# ---------------------------------------------------------

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=5000
    )
