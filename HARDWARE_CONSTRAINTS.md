# Hardware Constraints Implementation Guide

## DJI Matrice 300 RTK - Baseline Specifications

### Power & Battery
```
Battery: 2.7 kWh (Zenmuse payload version: 5.92 kWh with 2x hot-swap batteries)
Voltage: 44.4V
Cells: 6S2P (LiPo)
Max Discharge Rate: 96A
Energy Density: 245 Wh/L

Flight Time (no wind):
- Hover: ~50 min
- Cruise: ~55 min
- Max: 162 min (with 2x batteries + hot-swap)

Typical Power Consumption:
- Hovering: 900-1100W
- Cruising (5 m/s): 800-1000W
- Climbing (2 m/s): 1500-1800W
- Descending (auto): 700-900W
```

### Motion Dynamics
```
Max Ascent Speed: 6 m/s
Max Descent Speed: 5 m/s (auto) / 4 m/s (manual)
Max Horizontal Speed: 19 m/s (68 km/h)
Max Tilt Angle: 35°
Operating Temperature: -20°C to 55°C
Max Takeoff Weight: 9kg
```

### Sensors (Zenmuse H30T)
```
RGB Camera:
- Resolution: 48MP (24mm equivalent focal length)
- FOV: 45°
- Zoom: 12x optical, 100x digital
- Image Frequency: 30fps

Thermal Camera (uncooled):
- Resolution: 640×512 @ 30fps
- Spectral Range: 7.5-13.5 μm
- NETD: ≤40mK @ 25°C (uncooled)
- Accuracy: ±2°C or 2%
- Temperature Range: -40°C to 550°C
- FOV: 45° wide / 13° tele

Laser Rangefinder:
- Range: 1200m
- Accuracy: ±0.1m
```

### Communication
```
Transmission Range (unobstructed):
- Standard: 8000m (with OcuSync Enterprise)
- Extended: 15000m (with signal booster)

Telemetry Data Rate: 1.2 Mbps downlink
Control Update Rate: 50 Hz
Redundant Links: Primary (2.4 GHz) + Secondary (5.8 GHz)

Latency:
- Control latency: 50-150ms
- Telemetry latency: 100-300ms
```

---

## Energy Model - Implementation

### 1. Base Power Consumption
```python
# HOVER POWER (from DJI Matrice 300 RTK specs)
POWER_HOVER = 1000  # Watts

# VELOCITY-DEPENDENT POWER (aerodynamic drag)
# P_velocity = 0.5 * ρ * C_d * A * v³
AIR_DENSITY = 1.225  # kg/m³ at sea level
DRAG_COEFFICIENT = 0.1  # Approximate for quadcopter
CROSS_SECTION_AREA = 0.07  # m² (assuming ~0.3m rotor diameter)

# CLIMB/DESCENT POWER
MASS = 9.0  # kg (max takeoff weight)
G = 9.81  # m/s²
CLIMB_EFFICIENCY = 0.85  # Motor efficiency

# BATTERY CAPACITY
BATTERY_CAPACITY = 2.7  # kWh = 9720 kJ = 2,700,000 J

def calculate_power_consumption(drone_vel_magnitude, climb_rate, payload_fraction=1.0):
    """
    Total Power = P_hover + P_drag + P_climb
    
    Args:
        drone_vel_magnitude: magnitude of velocity vector (m/s)
        climb_rate: vertical velocity (m/s, positive = climbing)
        payload_fraction: 1.0 = full load, 0.5 = half thermal camera
    
    Returns:
        Power in Watts
    """
    # Hovering baseline
    p_hover = POWER_HOVER * payload_fraction
    
    # Aerodynamic drag power
    p_drag = 0.5 * AIR_DENSITY * DRAG_COEFFICIENT * CROSS_SECTION_AREA * (drone_vel_magnitude ** 3)
    
    # Climbing power (positive climb = energy cost)
    if climb_rate > 0:
        p_climb = (MASS * G * climb_rate) / CLIMB_EFFICIENCY
    else:
        # Descending (generator-like, but limited energy recovery)
        p_climb = 0  # Conservative: no recovery
    
    total_power = p_hover + p_drag + p_climb
    return total_power

# Example usage in drone_engine.py:
def tick_all(dt: float):
    for drone in world.drones:
        # ... existing movement code ...
        
        # NEW: Calculate realistic power consumption
        vel_mag = np.linalg.norm(drone.vel)
        climb_rate = drone.vel[1]  # vertical component
        power_watts = calculate_power_consumption(vel_mag, climb_rate)
        
        # Convert to battery percentage (0-100%)
        energy_per_tick = power_watts * dt / 1000  # Convert to Wh per dt
        battery_drain_percent = (energy_per_tick / 2700.0) * 100
        
        drone.battery -= battery_drain_percent * world.speed
```

### 2. Scenario-Specific Power Adjustments
```python
def get_scenario_power_modifier(scenario: str, conditions: dict) -> float:
    """
    Adjust power consumption based on environmental conditions
    
    Returns: Multiplier (1.0 = nominal, >1.0 = higher consumption)
    """
    modifier = 1.0
    
    if scenario == "earthquake":
        # Debris may require more precise hovering
        modifier *= 1.05
        
    elif scenario == "tsunami":
        # Salt water increases corrosion, salt spray damages motors
        # Not directly power, but simulate with small penalty
        modifier *= 1.02
        
    elif scenario == "wildfire":
        # High ambient temperature (~35°C) affects battery efficiency
        # Battery loses ~5% efficiency per 10°C above 25°C
        ambient_temp = conditions.get("ambient_temp", 35)
        temp_loss = (ambient_temp - 25) / 10 * 0.05
        modifier *= (1.0 - temp_loss)
        
    elif scenario == "flood":
        # High humidity affects motor efficiency
        # Assume 2% penalty for high moisture
        modifier *= 1.02
    
    return modifier
```

### 3. Wind Effect on Power
```python
def calculate_wind_power_penalty(drone_vel, wind_vector):
    """
    Headwind increases power, tailwind decreases it
    """
    # Effective velocity relative to ground
    effective_vel = drone_vel - wind_vector
    
    # Power depends on relative motion, not absolute
    # Headwind: drone works harder
    # Tailwind: drone works less
    
    nominal_vel_mag = np.linalg.norm(drone_vel)
    effective_vel_mag = np.linalg.norm(effective_vel)
    
    # Power ratio (cubic relationship)
    if nominal_vel_mag > 0.1:
        power_ratio = (effective_vel_mag / nominal_vel_mag) ** 3
    else:
        power_ratio = 1.0
    
    return power_ratio
```

---

## Sensor Degradation Model

### Thermal Camera - Detection Confidence
```python
def thermal_detection_confidence(drone_pos, survivor_pos, world_state):
    """
    Detection success probability decreases with:
    1. Distance (spatial resolution)
    2. Altitude (FOV coverage)
    3. Environmental noise (scenario-dependent)
    4. Relative motion
    """
    dist_3d = np.linalg.norm(drone_pos - survivor_pos)
    dist_2d = np.linalg.norm(drone_pos[:2] - survivor_pos[:2])
    altitude = drone_pos[1]
    
    # 1. THERMAL SENSOR SPECS
    #    FOV: 45° (tele) to 54° (wide)
    #    NETD: 40mK (noise), ~±2°C accuracy
    #    Human body: ~37°C baseline
    
    # Assuming thermal camera looking down (FOV = 54° wide)
    fov_horizontal_rad = np.radians(54)
    coverage_radius_at_altitude = altitude * np.tan(fov_horizontal_rad / 2)
    
    # Base detection: distance from nadir
    if dist_2d > coverage_radius_at_altitude:
        return 0.0  # Outside FOV
    
    base_confidence = 1.0 - (dist_2d / coverage_radius_at_altitude)
    
    # 2. ALTITUDE EFFECT (Ground Sample Distance)
    #    GSD = (altitude * sensor_width) / (2 * focal_length)
    #    At 30m altitude with 25mm lens: ~1cm GSD
    focal_length_mm = 25
    sensor_width_px = 640
    gsd_cm = (altitude * sensor_width_px) / (2 * focal_length_mm)
    
    # Human body = ~50cm wide, at least 5 GSD pixels needed
    altitude_factor = min(1.0, gsd_cm / 10)  # 10cm GSD = optimal
    
    # 3. ENVIRONMENTAL NOISE (scenario-dependent)
    scenario_noise = {
        "earthquake": 0.15,   # Urban environment, structural heat
        "tsunami": 0.20,      # Water reflections, spray noise
        "wildfire": 0.45,     # High background heat, complex scene
        "flood": 0.25         # Water, humidity noise
    }
    noise_factor = 1.0 - scenario_noise.get(world_state.scenario, 0.15)
    
    # 4. THERMAL SENSITIVITY (NETD: Noise Equivalent Delta T)
    # At 50m distance, NETD of 40mK means we need ΔT > 0.04°C from background
    # Human body: 37°C, background: 20-35°C = 2-17°C difference = detectable
    thermal_delta = abs(survivor_pos_thermal_temp - world_state.ambient_temp)
    sensitivity_factor = min(1.0, thermal_delta / 3.0)  # 3°C difference = confident
    
    final_confidence = (base_confidence * altitude_factor * 
                       noise_factor * sensitivity_factor)
    
    return max(0.0, min(1.0, final_confidence))
```

### RGB Camera - Visual Detection
```python
def rgb_detection_confidence(drone_pos, object_pos, world_state):
    """
    RGB detection depends on:
    1. FOV and GSD (resolution)
    2. Lighting conditions
    3. Object size & contrast
    """
    dist_2d = np.linalg.norm(drone_pos[:2] - object_pos[:2])
    altitude = drone_pos[1]
    
    # RGB FOV: 45° (24mm equivalent)
    fov_rad = np.radians(45)
    coverage_radius = altitude * np.tan(fov_rad / 2)
    
    if dist_2d > coverage_radius:
        return 0.0
    
    # GSD for RGB: (altitude * 36mm sensor) / (2 * 24mm lens)
    gsd_mm = (altitude * 36) / (2 * 24)  # in mm
    
    # Human visible size: ~50cm wide, need ≥10 pixels
    # So GSD must be ≤ 50mm
    gsd_factor = max(0.0, 1.0 - (gsd_mm / 50))
    
    # Lighting factor (time of day dependent - SIMPLE approximation)
    hour_of_day = (world_state.sim_time % 86400) / 3600  # 0-24
    if 6 <= hour_of_day <= 18:
        lighting = 1.0  # Daytime
    else:
        lighting = 0.3  # Night (very dim)
    
    confidence = (1.0 - (dist_2d / coverage_radius)) * gsd_factor * lighting
    return max(0.0, min(1.0, confidence))
```

---

## Communication Range & Latency

```python
class CommunicationModel:
    """Simulates DJI Enterprise communication constraints"""
    
    NOMINAL_RANGE = 8000  # meters (OcuSync Enterprise)
    EXTENDED_RANGE = 15000  # with signal booster
    
    def __init__(self):
        self.latency_ms = 100  # baseline latency
        self.telemetry_rate = 50  # Hz
        
    def is_in_range(self, drone_pos, base_station_pos=[0, 0, 0]) -> bool:
        """Check if drone can communicate"""
        distance = np.linalg.norm(drone_pos - np.array(base_station_pos))
        return distance < self.NOMINAL_RANGE
    
    def get_telemetry_update_interval(self, drone_pos) -> float:
        """
        Closer = faster updates
        At range limit = very slow / no updates
        """
        distance = np.linalg.norm(drone_pos)
        
        if distance < 2000:
            return 1 / 50  # 50 Hz telemetry
        elif distance < 5000:
            return 1 / 20  # 20 Hz telemetry
        elif distance < 8000:
            return 1 / 5   # 5 Hz telemetry
        else:
            return float('inf')  # No telemetry

    def add_latency_jitter(self, base_latency_ms=100) -> float:
        """Add realistic latency variation"""
        return np.random.normal(base_latency_ms, 30)
```

---

## Implementation Checklist

- [ ] Integrate `calculate_power_consumption()` into `drone_engine.tick_all()`
- [ ] Add environmental power modifiers in `scenario_loader.load_scenario()`
- [ ] Replace fixed `scan_radius` with altitude/distance-based model
- [ ] Add communication range checks to WebSocket broadcast
- [ ] Create hardware spec constants file: `backend/simulation/hardware_specs.py`
- [ ] Document baseline assumptions in README.md
- [ ] Add unit tests for energy calculations
- [ ] Validate against DJI Matrice 300 RTK actual flight data (if available)

---

## References

- DJI Matrice 300 RTK User Manual v2.0
- DJI Zenmuse H30T Specifications Sheet
- Beard, R. W. & McLain, T. W. (2012). "Small Unmanned Aircraft: Theory and Practice" - Chapter 5: Energy Management
- Anderson, D. (2019). "UAV Energy Consumption for Disaster Response" - IEEE Transactions on Systems, Man, and Cybernetics

---

**Last Updated**: May 22, 2026  
**Ready for Integration**: Phase 1 - Implementation
