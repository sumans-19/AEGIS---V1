import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
import io
import random
from simulation.world_state import DroneState, WorldState

# Constants
WIDTH, HEIGHT = 320, 240

def generate_thermal_frame(drone: DroneState, world: WorldState) -> bytes:
    # 1. Base temp layer (ambient + noise)
    arr = np.full((HEIGHT, WIDTH), world.ambient_temp, dtype=np.float32)
    arr += np.random.normal(0, 0.5, (HEIGHT, WIDTH))
    
    # 2. Terrain effects (simplified top-down)
    # Map area under drone (scan_radius cover) to pixel space
    # Camera centered at drone.pos, looking down
    gx_center = int((drone.pos[0] + 50) / 5)
    gy_center = int((drone.pos[2] + 50) / 5)
    
    # Render visible terrain cells
    view_cells = int(drone.scan_radius / 5) + 1
    for ix in range(max(0, gx_center - view_cells), min(20, gx_center + view_cells)):
        for iy in range(max(0, gy_center - view_cells), min(20, gy_center + view_cells)):
            damage = world.terrain_grid[ix, iy]
            cell_temp = world.ambient_temp
            if damage > 0.8: # Collapsed
                cell_temp += 2.0
            if world.scenario == "wildfire" and damage > 0.6:
                cell_temp += 15.0 + np.random.uniform(0, 25)
            if world.scenario == "tsunami" and ix < 6: # water
                cell_temp -= 3.0
            
            # Map grid (ix, iy) to pixel (sx, sy) relative to drone
            px_per_cell = 40 # approx cell zoom
            sx = int(WIDTH/2 + (ix - (drone.pos[0]+50)/5) * px_per_cell)
            sy = int(HEIGHT/2 + (iy - (drone.pos[2]+50)/5) * px_per_cell)
            
            if 0 < sx < WIDTH and 0 < sy < HEIGHT:
                cv2.rectangle(arr, (sx-15, sy-15), (sx+15, sy+15), float(cell_temp), -1)

    # 3. Survivor heat blobs
    for s in world.survivors:
        # Distance check in world units
        dist_2d = np.linalg.norm(drone.pos[:2] - s.pos[:2])
        if dist_2d < drone.scan_radius:
            # Project survivor world pos to pixel relative to drone pos
            # Offset = (s.pos - drone.pos)
            ox, oy = (s.pos[0] - drone.pos[0]), (s.pos[2] - drone.pos[2])
            # Scale to pixels (assuming scan_radius maps to edge)
            scale = (WIDTH / (2 * drone.scan_radius))
            sx = int(WIDTH/2 + ox * scale)
            sy = int(HEIGHT/2 + oy * scale)
            
            if 0 < sx < WIDTH and 0 < sy < HEIGHT:
                # Gaussian blob for survivor heat
                # Temperature 36-38 C
                val = s.body_temp
                sigma = max(3, int(15 * (1.0 - dist_2d / drone.scan_radius)))
                # Render a small blob
                cv2.circle(arr, (sx, sy), sigma, float(val), -1)
                
    # 4. Scenario noise
    if world.scenario == "wildfire":
        # Hot pixels
        for _ in range(50):
            rx, ry = np.random.randint(0, WIDTH), np.random.randint(0, HEIGHT)
            arr[ry, rx] += np.random.uniform(10, 40)

    # 5. Colormap and HUD
    # Normalize 0..50C -> 0..255
    arr_norm = np.clip((arr - 0) / 50.0 * 255.0, 0, 255).astype(np.uint8)
    colored = cv2.applyColorMap(arr_norm, cv2.COLORMAP_INFERNO)
    
    # Overlay HUD
    cv2.putText(colored, f"THERMAL | {drone.callsign} | AMB {world.ambient_temp:.1f}C", (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
    # Crosshair
    cv2.line(colored, (WIDTH//2 - 10, HEIGHT//2), (WIDTH//2 + 10, HEIGHT//2), (255, 255, 255), 1)
    cv2.line(colored, (WIDTH//2, HEIGHT//2 - 10), (WIDTH//2, HEIGHT//2 + 10), (255, 255, 255), 1)
    
    # Temp scale bar (right edge)
    for i in range(HEIGHT):
        c = (HEIGHT - i) / HEIGHT * 255
        cv2.line(colored, (WIDTH-10, i), (WIDTH-2, i), [c, c, c], 1)

    # Encode JPEG
    _, buffer = cv2.imencode('.jpg', colored, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    return buffer.tobytes()

def generate_camera_frame(drone: DroneState, world: WorldState) -> bytes:
    img = Image.new('RGB', (WIDTH, HEIGHT), color=(20, 20, 30)) # dusky sky base
    draw = ImageDraw.Draw(img)
    
    # Gradient sky
    for i in range(HEIGHT // 3):
        c = int((HEIGHT//3 - i) / (HEIGHT//3) * 40)
        draw.line([0, i, WIDTH, i], fill=(20+c, 20+c, 30+c))

    # Grid Render (simulating terrain from above)
    gx_center, gy_center = int((drone.pos[0] + 50) / 5), int((drone.pos[2] + 50) / 5)
    for i in range(max(0, gx_center - 4), min(20, gx_center + 4)):
        for j in range(max(0, gy_center - 4), min(20, gy_center + 4)):
            damage = world.terrain_grid[i, j]
            # Map grid to pixels
            px = WIDTH//2 + (i - (drone.pos[0]+50)/5) * 40
            py = HEIGHT//2 + (j - (drone.pos[2]+50)/5) * 40
            
            fill = (26, 26, 42) # Intact
            if damage > 0.8: fill = (42, 26, 10) # Rubble
            elif damage > 0.4: fill = (58, 42, 26) # Damaged
            
            draw.rectangle([px-18, py-18, px+18, py+18], fill=fill, outline=(100, 100, 100, 50))
            if damage > 0.9: # Add "noise" for rubble
                for _ in range(5):
                    nx, ny = px + random.randint(-15, 15), py + random.randint(-15, 15)
                    draw.point([nx, ny], fill=(20, 10, 0))

    # HUD
    draw.line([10, 10, 30, 10], fill=(0, 229, 255), width=2)
    draw.line([10, 10, 10, 30], fill=(0, 229, 255), width=2)
    if world.tick % 30 < 15:
        draw.ellipse([290, 10, 305, 25], fill=(255, 0, 0)) # REC dot
        
    draw.text((10, 215), f"DRONE-0{drone.id} {drone.callsign} | ALT {drone.pos[1]:.0f}m | SPD {np.linalg.norm(drone.vel):.1f}m/s", fill=(0, 229, 255))
    
    # Survivor box?
    for s in world.survivors:
        dx, dy = (s.pos[0] - drone.pos[0]), (s.pos[2] - drone.pos[2])
        if abs(dx) < 20 and abs(dy) < 15: # in frame approx
            sx = WIDTH//2 + dx * 8 # zoom mapping
            sy = HEIGHT//2 + dy * 8
            # Confidence labels (only if detected by sim)
            if s.detected and s.id in world.detected_survivors:
                draw.rectangle([sx-10, sy-10, sx+10, sy+10], outline=(0, 255, 136), width=2)
                draw.text((sx+12, sy-5), f"S#{s.id} {s.confidence:.0%}", fill=(0, 255, 136))


    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=80)
    return buffer.getvalue()
