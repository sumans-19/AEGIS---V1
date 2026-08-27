import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* =========================================================================
   AEROVIEW DRONE MODEL — Precision Industrial UAV Replica
   Recreated as an extremely close visual replica of the reference image:
   - Sculpted aerodynamic composite canopy with multi-faceted chamfered contours
   - Raised center avionics spine with technical panel seams
   - Front sloped nose with recessed sensor aperture & twin vertical teal headlights
   - Side recessed cooling gill slots
   - Light gray arm mounting collar sleeves
   - Woven carbon fiber diagonal arms
   - Machined motor pods with glowing Ice-Teal status rings
   - Swept airfoil dual-blade propellers
   - 3-axis gimbal camera assembly under front fuselage
   - Tubular A-frame landing legs & horizontal ground skid rails with rubber feet
   ========================================================================= */

// Procedural Carbon Fiber Weave Texture
function createCarbonTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1A2124';
  ctx.fillRect(0, 0, 64, 64);

  ctx.fillStyle = '#2A353A';
  for (let y = 0; y < 64; y += 4) {
    for (let x = 0; x < 64; x += 8) {
      const offset = (y % 8 === 0) ? 0 : 4;
      ctx.fillRect(x + offset, y, 4, 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 24);
  return texture;
}

// Procedural Aerodynamic Propeller Blade Geometry
function createBladeGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.025);
  shape.bezierCurveTo(0.2, -0.045, 0.5, -0.048, 0.85, -0.025);
  shape.bezierCurveTo(0.96, -0.015, 1.02, 0.0, 0.98, 0.015);
  shape.bezierCurveTo(0.85, 0.035, 0.5, 0.045, 0.2, 0.038);
  shape.bezierCurveTo(0.08, 0.030, 0.02, 0.015, 0, 0.010);
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.004,
    bevelThickness: 0.004,
  });
}

// Sculpted Top Canopy Fuselage Geometry (Aerodynamic Tapered Profile — TALLER)
function createCanopyGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.84);
  shape.lineTo(0.32, 0.62);
  shape.lineTo(0.38, 0.15);
  shape.lineTo(0.35, -0.55);
  shape.lineTo(0.18, -0.82);
  shape.lineTo(-0.18, -0.82);
  shape.lineTo(-0.35, -0.55);
  shape.lineTo(-0.38, 0.15);
  shape.lineTo(-0.32, 0.62);
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.38,
    bevelEnabled: true,
    bevelSegments: 6,
    steps: 1,
    bevelSize: 0.09,
    bevelThickness: 0.09,
  });
}

// Raised Center Avionics Spine Geometry (taller to match body)
function createSpineGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.55);
  shape.lineTo(0.16, 0.38);
  shape.lineTo(0.18, -0.25);
  shape.lineTo(0.10, -0.62);
  shape.lineTo(-0.10, -0.62);
  shape.lineTo(-0.18, -0.25);
  shape.lineTo(-0.16, 0.38);
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.10,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.04,
    bevelThickness: 0.04,
  });
}

/* ---- PROPELLER ASSEMBLY ---- */
function Propeller({ dir = 1, propMat, hubMat, bladeGeo, spinning = true }) {
  const ref = useRef();
  useFrame((_, dt) => {
    if (ref.current && spinning) ref.current.rotation.y += dt * dir * 24;
  });

  return (
    <group ref={ref}>
      {/* Blade 1 */}
      <mesh
        geometry={bladeGeo}
        material={propMat}
        position={[0.08, 0.005, 0]}
        rotation={[Math.PI / 2, 0.06, 0]}
      />
      {/* Blade 2 (180 deg offset) */}
      <mesh
        geometry={bladeGeo}
        material={propMat}
        position={[-0.08, 0.005, 0]}
        rotation={[Math.PI / 2, 0.06, Math.PI]}
      />
      {/* Center Hub Cap */}
      <mesh material={hubMat} position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.052, 0.046, 0.038, 24]} />
      </mesh>
      {/* Center Screw Cap */}
      <mesh material={hubMat} position={[0, 0.034, 0]}>
        <sphereGeometry args={[0.022, 12, 10]} />
      </mesh>
    </group>
  );
}

/* ---- MOTOR ASSEMBLY ---- */
function MotorPod({ position, propDir, materials, bladeGeo, spinning }) {
  const { motorDark, motorSilver, tealLed, propMat } = materials;

  return (
    <group position={position}>
      {/* Main Motor Stator Housing */}
      <mesh material={motorDark} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.22, 32]} />
      </mesh>
      {/* Machined Metallic Top Rotor Ring */}
      <mesh position={[0, 0.12, 0]} material={motorSilver}>
        <cylinderGeometry args={[0.155, 0.18, 0.035, 32]} />
      </mesh>
      {/* Stator Cooling Slots Ring */}
      <mesh position={[0, 0.08, 0]} material={motorDark}>
        <torusGeometry args={[0.182, 0.008, 8, 32]} />
      </mesh>
      {/* Lower Base Mounting Flange */}
      <mesh position={[0, -0.12, 0]} material={motorDark}>
        <cylinderGeometry args={[0.195, 0.195, 0.032, 32]} />
      </mesh>
      {/* Glowing Ice-Teal Base Status Ring */}
      <mesh position={[0, -0.105, 0]} material={tealLed}>
        <torusGeometry args={[0.196, 0.014, 8, 32]} />
      </mesh>
      {/* Central Spindle Shaft */}
      <mesh position={[0, 0.16, 0]} material={motorSilver}>
        <cylinderGeometry args={[0.022, 0.022, 0.06, 16]} />
      </mesh>
      {/* Propeller */}
      <group position={[0, 0.20, 0]}>
        <Propeller dir={propDir} propMat={propMat} hubMat={motorDark} bladeGeo={bladeGeo} spinning={spinning} />
      </group>
    </group>
  );
}

/* ---- CARBON FIBER ARM ---- */
function CarbonArm({ start, end, materials }) {
  const { carbonFiber, seamDark } = materials;
  const vStart = new THREE.Vector3(...start);
  const vEnd = new THREE.Vector3(...end);
  const dir = new THREE.Vector3().subVectors(vEnd, vStart);
  const len = dir.length();
  const mid = new THREE.Vector3().addVectors(vStart, vEnd).multiplyScalar(0.5);

  const quat = new THREE.Quaternion();
  quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

  return (
    <group position={mid.toArray()} quaternion={quat}>
      {/* Main Structural Carbon Tube */}
      <mesh material={carbonFiber}>
        <cylinderGeometry args={[0.048, 0.048, len - 0.10, 24]} />
      </mesh>
      {/* Top Seam Rib Strip */}
      <mesh position={[0, 0, 0.049]} material={seamDark}>
        <boxGeometry args={[0.010, len - 0.12, 0.004]} />
      </mesh>
    </group>
  );
}

/* =========================================================================
   MAIN EXPORT COMPONENT
   ========================================================================= */
export default function DroneModel({ wireframe = false, xray = false, propellersRunning = true }) {
  const op = xray ? 0.18 : 1;
  const tr = xray;
  const wf = wireframe;

  const carbonTexture = useMemo(() => createCarbonTexture(), []);
  const bladeGeo = useMemo(() => createBladeGeometry(), []);
  const canopyGeo = useMemo(() => createCanopyGeometry(), []);
  const spineGeo = useMemo(() => createSpineGeometry(), []);

  // Materials Palette
  const materials = useMemo(() => {
    // Matte White / Light Gray Composite Shell (#E6ECEE)
    const shellWhite = new THREE.MeshStandardMaterial({
      color: '#E6ECEE',
      roughness: 0.38,
      metalness: 0.06,
      wireframe: wf,
      transparent: tr,
      opacity: op,
    });

    // Light Technical Gray Panel Accents (#C2CBCD)
    const panelGrey = new THREE.MeshStandardMaterial({
      color: '#C2CBCD',
      roughness: 0.45,
      metalness: 0.10,
      wireframe: wf,
      transparent: tr,
      opacity: op,
    });

    // Dark Under-Chassis / Seams (#182022)
    const seamDark = new THREE.MeshStandardMaterial({
      color: '#182022',
      roughness: 0.65,
      metalness: 0.18,
      wireframe: wf,
      transparent: tr,
      opacity: op,
    });

    // Dark Carbon Fiber with Woven Pattern (#323E42)
    const carbonFiber = new THREE.MeshStandardMaterial({
      map: carbonTexture,
      color: '#323E42',
      roughness: 0.35,
      metalness: 0.32,
      wireframe: wf,
      transparent: tr,
      opacity: op,
    });

    // Anodized Dark Graphite Motors (#151C1E)
    const motorDark = new THREE.MeshStandardMaterial({
      color: '#151C1E',
      roughness: 0.22,
      metalness: 0.85,
      wireframe: wf,
      transparent: tr,
      opacity: op,
    });

    // Machined Metallic Silver Accents (#8C989B)
    const motorSilver = new THREE.MeshStandardMaterial({
      color: '#8C989B',
      roughness: 0.24,
      metalness: 0.82,
      wireframe: wf,
      transparent: tr,
      opacity: op,
    });

    // Dark Airfoil Propellers (#222A2C)
    const propMat = new THREE.MeshStandardMaterial({
      color: '#222A2C',
      roughness: 0.28,
      metalness: 0.22,
      side: THREE.DoubleSide,
      wireframe: wf,
      transparent: true,
      opacity: xray ? 0.3 : 0.94,
    });

    // Camera Housing Black (#0E1416)
    const camBlack = new THREE.MeshStandardMaterial({
      color: '#0E1416',
      roughness: 0.15,
      metalness: 0.92,
      wireframe: wf,
      transparent: tr,
      opacity: op,
    });

    // Optical Lens Glass
    const lensGlass = new THREE.MeshStandardMaterial({
      color: '#04090C',
      roughness: 0.01,
      metalness: 0.99,
      emissive: '#0C1B24',
      emissiveIntensity: 0.5,
    });

    // Restrained Ice-Teal Status LED Glow (#8ACBD2)
    const tealLed = new THREE.MeshStandardMaterial({
      color: '#8ACBD2',
      emissive: '#8ACBD2',
      emissiveIntensity: 1.2,
      roughness: 0.1,
    });

    // Landing Gear Matte Charcoal (#161C1E)
    const legDark = new THREE.MeshStandardMaterial({
      color: '#161C1E',
      roughness: 0.50,
      metalness: 0.35,
      wireframe: wf,
      transparent: tr,
      opacity: op,
    });

    return { shellWhite, panelGrey, seamDark, carbonFiber, motorDark, motorSilver, propMat, camBlack, lensGlass, tealLed, legDark };
  }, [carbonTexture, wf, tr, op, xray]);

  // Motor Positions (Industrial Quad Stance)
  const motorPos = {
    FR: [ 1.48, 0.16,  1.48],
    FL: [-1.48, 0.16,  1.48],
    RR: [ 1.48, 0.16, -1.48],
    RL: [-1.48, 0.16, -1.48],
  };

  const armRootPos = {
    FR: [ 0.32, 0.04,  0.32],
    FL: [-0.32, 0.04,  0.32],
    RR: [ 0.32, 0.04, -0.32],
    RL: [-0.32, 0.04, -0.32],
  };

  const { shellWhite, panelGrey, seamDark, camBlack, lensGlass, tealLed, legDark, motorDark, motorSilver } = materials;

  return (
    <group position={[0, 0.10, 0]} rotation={[0, Math.PI * 0.02, 0]}>

      {/* =========================================================
          1. CENTRAL FUSELAGE — SCULPTED AERODYNAMIC CANOPY
         ========================================================= */}
      
      {/* Sculpted Main Upper Canopy Shell */}
      <mesh
        geometry={canopyGeo}
        material={shellWhite}
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />

      {/* Dome Top — Smooth hemisphere on top of the canopy for organic feel */}
      <mesh position={[0, 0.30, -0.05]} material={shellWhite}>
        <sphereGeometry args={[0.32, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
      </mesh>

      {/* Raised Avionics Spine Panel */}
      <mesh
        geometry={spineGeo}
        material={panelGrey}
        position={[0, 0.28, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />

      {/* ---- MID-BODY DARK BAND (Upper/Lower Chassis Split Line) ---- */}
      <mesh position={[0, 0.0, 0]} material={seamDark}>
        <boxGeometry args={[0.82, 0.04, 1.72]} />
      </mesh>
      {/* Side dark band accents */}
      {[-0.40, 0.40].map((x, i) => (
        <mesh key={`band-acc-${i}`} position={[x, 0.0, 0]} material={camBlack}>
          <boxGeometry args={[0.008, 0.05, 1.50]} />
        </mesh>
      ))}

      {/* ---- LOWER CHASSIS (Dark Under-Body) ---- */}
      <mesh position={[0, -0.08, 0]} material={seamDark}>
        <boxGeometry args={[0.74, 0.12, 1.52]} />
      </mesh>
      {/* Lower chassis side panels */}
      {[-0.38, 0.38].map((x, i) => (
        <mesh key={`lower-side-${i}`} position={[x, -0.06, 0]} material={seamDark}>
          <boxGeometry args={[0.012, 0.08, 1.40]} />
        </mesh>
      ))}

      {/* Longitudinal Center Seam Groove */}
      <mesh position={[0, 0.35, -0.05]} material={seamDark}>
        <boxGeometry args={[0.006, 0.006, 1.10]} />
      </mesh>

      {/* Center Insignia Panel */}
      <mesh position={[0, 0.352, 0.08]} material={seamDark}>
        <boxGeometry args={[0.06, 0.003, 0.04]} />
      </mesh>

      {/* ---- FRONT SLOPED NOSE & SENSOR APERTURE ---- */}
      <group position={[0, 0.10, 0.74]} rotation={[0.38, 0, 0]}>
        {/* Sloped Beveled White Nose Block */}
        <mesh material={shellWhite}>
          <boxGeometry args={[0.58, 0.22, 0.28]} />
        </mesh>
        {/* Recessed Dark Camera/Sensor Frame */}
        <mesh position={[0, -0.02, 0.145]} material={seamDark}>
          <boxGeometry args={[0.34, 0.12, 0.02]} />
        </mesh>
        {/* Inner Dark Lens Window */}
        <mesh position={[0, -0.02, 0.15]} material={camBlack}>
          <boxGeometry args={[0.30, 0.09, 0.012]} />
        </mesh>
        {/* Ice-Teal Center Sensor Strip */}
        <mesh position={[0, -0.02, 0.158]} material={tealLed}>
          <boxGeometry args={[0.22, 0.014, 0.005]} />
        </mesh>
      </group>

      {/* Twin Vertical Ice-Teal Front Headlights */}
      {[-0.28, 0.28].map((x, i) => (
        <mesh key={`fheadlight-${i}`} position={[x, 0.02, 0.86]} material={tealLed}>
          <boxGeometry args={[0.022, 0.095, 0.022]} />
        </mesh>
      ))}

      {/* ---- SIDE RECESSED COOLING GILLS (4 per side) ---- */}
      {[-0.18, 0.00, 0.18, 0.36].map((z, vi) => (
        <React.Fragment key={`vent-slot-${vi}`}>
          <mesh position={[0.40, 0.12, z]} rotation={[0.3, 0, 0]} material={seamDark}>
            <boxGeometry args={[0.018, 0.06, 0.070]} />
          </mesh>
          <mesh position={[-0.40, 0.12, z]} rotation={[0.3, 0, 0]} material={seamDark}>
            <boxGeometry args={[0.018, 0.06, 0.070]} />
          </mesh>
        </React.Fragment>
      ))}

      {/* ---- ARM MOUNTING COLLAR SLEEVES (Light Gray Caps) ---- */}
      {Object.entries(armRootPos).map(([key, pos]) => (
        <mesh
          key={`collar-${key}`}
          position={pos}
          rotation={[0, (key === 'FR' || key === 'RL') ? -Math.PI / 4 : Math.PI / 4, 0]}
          material={panelGrey}
        >
          <boxGeometry args={[0.14, 0.10, 0.14]} />
        </mesh>
      ))}

      {/* =========================================================
          SURFACE DETAIL COMPONENTS — Realism & Panel Lines
         ========================================================= */}

      {/* ---- LATERAL PANEL SEAM LINES (left & right body edges) ---- */}
      {[-0.36, 0.36].map((x, i) => (
        <mesh key={`lat-seam-${i}`} position={[x, 0.10, 0]} material={seamDark}>
          <boxGeometry args={[0.005, 0.005, 1.30]} />
        </mesh>
      ))}

      {/* ---- TRANSVERSE PANEL CUT LINES (front, mid, rear) ---- */}
      {[0.45, 0.10, -0.30, -0.60].map((z, i) => (
        <mesh key={`trans-cut-${i}`} position={[0, 0.37, z]} material={seamDark}>
          <boxGeometry args={[0.52, 0.003, 0.005]} />
        </mesh>
      ))}

      {/* ---- BATTERY COMPARTMENT HATCH (top rear section) ---- */}
      <group position={[0, 0.36, -0.44]}>
        {/* Hatch Panel Outline */}
        <mesh material={panelGrey}>
          <boxGeometry args={[0.24, 0.008, 0.22]} />
        </mesh>
        {/* Hatch Recess Border */}
        <mesh position={[0, 0.005, 0]} material={seamDark}>
          <boxGeometry args={[0.22, 0.003, 0.20]} />
        </mesh>
        {/* Hatch Pull Latch Handle */}
        <mesh position={[0, 0.008, 0.06]} material={motorSilver}>
          <boxGeometry args={[0.06, 0.012, 0.016]} />
        </mesh>
        {/* Battery Status Indicator Dots (3 green LEDs) */}
        {[-0.04, 0, 0.04].map((xo, i) => (
          <mesh key={`bat-led-${i}`} position={[xo, 0.008, -0.06]} material={tealLed}>
            <sphereGeometry args={[0.008, 8, 6]} />
          </mesh>
        ))}
      </group>

      {/* ---- REAR EXHAUST / VENT GRILLE ARRAY ---- */}
      <group position={[0, 0.06, -0.78]}>
        {/* Rear Dark Panel Frame */}
        <mesh material={seamDark}>
          <boxGeometry args={[0.30, 0.10, 0.04]} />
        </mesh>
        {/* Individual Horizontal Vent Slats (5 slats) */}
        {[-0.032, -0.016, 0, 0.016, 0.032].map((yo, i) => (
          <mesh key={`rear-slat-${i}`} position={[0, yo, 0.022]} material={panelGrey}>
            <boxGeometry args={[0.24, 0.006, 0.004]} />
          </mesh>
        ))}
      </group>

      {/* ---- REAR TAIL MARKER LED LIGHTS ---- */}
      {[-0.16, 0.16].map((x, i) => (
        <React.Fragment key={`tail-led-${i}`}>
          <mesh position={[x, 0.04, -0.84]} material={tealLed}>
            <boxGeometry args={[0.030, 0.030, 0.012]} />
          </mesh>
          <mesh position={[x, 0.04, -0.845]} material={camBlack}>
            <boxGeometry args={[0.036, 0.036, 0.006]} />
          </mesh>
        </React.Fragment>
      ))}

      {/* ---- SIDE ULTRASONIC SENSOR BUMPS (left & right) ---- */}
      {[-0.39, 0.39].map((x, i) => (
        <React.Fragment key={`side-sensor-${i}`}>
          {/* Sensor Housing Pod */}
          <mesh position={[x, 0.06, 0.40]} material={seamDark}>
            <cylinderGeometry args={[0.035, 0.035, 0.020, 16]} />
          </mesh>
          {/* Sensor Lens/Face */}
          <mesh position={[x > 0 ? x + 0.012 : x - 0.012, 0.06, 0.40]}
            rotation={[0, 0, Math.PI / 2]} material={camBlack}>
            <circleGeometry args={[0.028, 16]} />
          </mesh>
        </React.Fragment>
      ))}

      {/* ---- TOP ANTENNA BUMPS (Dual UHF/WiFi Antennas) ---- */}
      {[-0.12, 0.12].map((x, i) => (
        <group key={`antenna-${i}`} position={[x, 0.38, 0.22]}>
          {/* Antenna Base Pad */}
          <mesh material={seamDark}>
            <cylinderGeometry args={[0.022, 0.028, 0.016, 12]} />
          </mesh>
          {/* Antenna Stub Mast */}
          <mesh position={[0, 0.035, 0]} material={motorDark}>
            <cylinderGeometry args={[0.008, 0.010, 0.055, 8]} />
          </mesh>
          {/* Antenna Tip */}
          <mesh position={[0, 0.065, 0]} material={motorSilver}>
            <sphereGeometry args={[0.010, 8, 6]} />
          </mesh>
        </group>
      ))}

      {/* ---- UNDER-BELLY SENSOR MODULES ---- */}
      {/* Forward-Looking IR Sensor */}
      <mesh position={[0, -0.10, 0.30]} material={camBlack}>
        <boxGeometry args={[0.10, 0.030, 0.10]} />
      </mesh>
      <mesh position={[0, -0.115, 0.30]} material={lensGlass}>
        <circleGeometry args={[0.032, 16]} />
      </mesh>
      {/* Downward Altitude/Optical Flow Sensor */}
      <mesh position={[0, -0.10, -0.15]} material={camBlack}>
        <cylinderGeometry args={[0.040, 0.040, 0.022, 16]} />
      </mesh>
      <mesh position={[0, -0.115, -0.15]} material={lensGlass}>
        <circleGeometry args={[0.030, 16]} />
      </mesh>

      {/* ---- FORWARD OBSTACLE AVOIDANCE SENSOR PODS ---- */}
      {[-0.18, 0.18].map((x, i) => (
        <group key={`obs-sensor-${i}`} position={[x, -0.02, 0.82]}>
          <mesh material={seamDark}>
            <boxGeometry args={[0.06, 0.04, 0.03]} />
          </mesh>
          <mesh position={[0, 0, 0.018]} material={camBlack}>
            <circleGeometry args={[0.014, 12]} />
          </mesh>
        </group>
      ))}

      {/* ---- TOP SPINE REINFORCEMENT RIBS (3 transverse ribs) ---- */}
      {[0.20, -0.10, -0.40].map((z, i) => (
        <mesh key={`spine-rib-${i}`} position={[0, 0.375, z]} material={seamDark}>
          <boxGeometry args={[0.30, 0.005, 0.008]} />
        </mesh>
      ))}

      {/* ---- SIDE PANEL DETAIL INDENTS (decorative panel breaks) ---- */}
      {[-0.34, 0.34].map((x, i) => (
        <React.Fragment key={`side-indent-${i}`}>
          <mesh position={[x, 0.12, 0.30]} material={panelGrey}>
            <boxGeometry args={[0.012, 0.06, 0.14]} />
          </mesh>
          <mesh position={[x, 0.12, -0.20]} material={panelGrey}>
            <boxGeometry args={[0.012, 0.06, 0.12]} />
          </mesh>
        </React.Fragment>
      ))}

      {/* ---- CORNER SCREW / RIVET HEADS (8 rivets on top canopy) ---- */}
      {[
        [0.24, 0.37, 0.50], [-0.24, 0.37, 0.50],
        [0.30, 0.37, 0.20], [-0.30, 0.37, 0.20],
        [0.28, 0.37, -0.15], [-0.28, 0.37, -0.15],
        [0.22, 0.37, -0.50], [-0.22, 0.37, -0.50],
      ].map((pos, i) => (
        <group key={`rivet-${i}`} position={pos}>
          <mesh material={motorSilver}>
            <cylinderGeometry args={[0.010, 0.010, 0.006, 8]} />
          </mesh>
          <mesh position={[0, 0.004, 0]} material={seamDark}>
            <cylinderGeometry args={[0.006, 0.006, 0.003, 6]} />
          </mesh>
        </group>
      ))}

      {/* ---- ADDITIONAL BODY RIVETS (along spine edges) ---- */}
      {[0.35, 0.10, -0.15, -0.45].map((z, i) => (
        <React.Fragment key={`spine-rivet-${i}`}>
          <mesh position={[0.14, 0.38, z]} material={motorSilver}>
            <cylinderGeometry args={[0.007, 0.007, 0.005, 6]} />
          </mesh>
          <mesh position={[-0.14, 0.38, z]} material={motorSilver}>
            <cylinderGeometry args={[0.007, 0.007, 0.005, 6]} />
          </mesh>
        </React.Fragment>
      ))}

      {/* ---- TOP SERVICE PORT COVERS (2 recessed panels) ---- */}
      <group position={[0.14, 0.37, 0.35]}>
        <mesh material={panelGrey}>
          <boxGeometry args={[0.10, 0.006, 0.08]} />
        </mesh>
        <mesh position={[0, 0.004, 0]} material={seamDark}>
          <boxGeometry args={[0.08, 0.003, 0.06]} />
        </mesh>
      </group>
      <group position={[-0.14, 0.37, 0.35]}>
        <mesh material={panelGrey}>
          <boxGeometry args={[0.10, 0.006, 0.08]} />
        </mesh>
        <mesh position={[0, 0.004, 0]} material={seamDark}>
          <boxGeometry args={[0.08, 0.003, 0.06]} />
        </mesh>
      </group>

      {/* ---- SIDE AIR INTAKE SCOOPS (angular dark inlets) ---- */}
      {[-0.38, 0.38].map((x, i) => (
        <group key={`intake-${i}`} position={[x, 0.02, -0.30]}>
          <mesh material={seamDark} rotation={[0, x > 0 ? 0.15 : -0.15, 0]}>
            <boxGeometry args={[0.020, 0.06, 0.12]} />
          </mesh>
          <mesh position={[x > 0 ? 0.012 : -0.012, 0, 0]} material={camBlack}
            rotation={[0, x > 0 ? 0.15 : -0.15, 0]}>
            <boxGeometry args={[0.006, 0.04, 0.08]} />
          </mesh>
        </group>
      ))}

      {/* ---- WIRE HARNESS CHANNELS (under belly) ---- */}
      {[-0.18, 0.18].map((x, i) => (
        <mesh key={`wire-ch-${i}`} position={[x, -0.095, 0.10]} material={seamDark}>
          <boxGeometry args={[0.025, 0.008, 0.80]} />
        </mesh>
      ))}

      {/* ---- EDGE CHAMFER ACCENT STRIPS (left & right lower edges) ---- */}
      {[-0.37, 0.37].map((x, i) => (
        <mesh key={`chamfer-${i}`} position={[x, -0.02, 0]}
          rotation={[0, 0, x > 0 ? 0.15 : -0.15]} material={panelGrey}>
          <boxGeometry args={[0.015, 0.008, 1.40]} />
        </mesh>
      ))}

      {/* ---- UNDER-BELLY REINFORCEMENT CROSS PLATES ---- */}
      {[-0.30, 0.00, 0.30].map((z, i) => (
        <mesh key={`belly-plate-${i}`} position={[0, -0.098, z]} material={seamDark}>
          <boxGeometry args={[0.60, 0.004, 0.018]} />
        </mesh>
      ))}

      {/* ---- FRONT NOSE CHEVRON V-ACCENT ---- */}
      <group position={[0, 0.26, 0.68]}>
        <mesh position={[0.08, 0, 0]} rotation={[0, 0.30, 0]} material={tealLed}>
          <boxGeometry args={[0.10, 0.008, 0.005]} />
        </mesh>
        <mesh position={[-0.08, 0, 0]} rotation={[0, -0.30, 0]} material={tealLed}>
          <boxGeometry args={[0.10, 0.008, 0.005]} />
        </mesh>
      </group>

      {/* ---- REAR STABILIZER MICRO-FINS ---- */}
      {[-0.12, 0.12].map((x, i) => (
        <mesh key={`stab-fin-${i}`} position={[x, 0.22, -0.82]}
          rotation={[0.1, 0, x > 0 ? 0.08 : -0.08]} material={panelGrey}>
          <boxGeometry args={[0.03, 0.06, 0.06]} />
        </mesh>
      ))}

      {/* ---- SIDE PANEL SCREW ROWS (4 per side) ---- */}
      {[-0.36, 0.36].map((x, si) => (
        <React.Fragment key={`screw-row-${si}`}>
          {[0.40, 0.15, -0.10, -0.35].map((z, i) => (
            <mesh key={`screw-${si}-${i}`} position={[x, 0.12, z]} material={motorSilver}>
              <sphereGeometry args={[0.008, 6, 4]} />
            </mesh>
          ))}
        </React.Fragment>
      ))}

      {/* ---- CENTER BODY STATUS LED STRIP ---- */}
      <group position={[0, 0.28, 0.50]}>
        {[-0.06, -0.02, 0.02, 0.06].map((x, i) => (
          <mesh key={`status-led-${i}`} position={[x, 0, 0]} material={tealLed}>
            <boxGeometry args={[0.022, 0.005, 0.005]} />
          </mesh>
        ))}
        {/* LED Strip Housing */}
        <mesh material={seamDark}>
          <boxGeometry args={[0.20, 0.010, 0.012]} />
        </mesh>
      </group>

      {/* ---- MICRO-PANEL DETAIL LINES (diagonal accent cuts) ---- */}
      {[-0.26, 0.26].map((x, i) => (
        <mesh key={`diag-cut-${i}`} position={[x, 0.15, 0.45]}
          rotation={[0, x > 0 ? 0.4 : -0.4, 0]} material={seamDark}>
          <boxGeometry args={[0.004, 0.04, 0.08]} />
        </mesh>
      ))}

      {/* ---- ARM ROOT REINFORCEMENT GUSSETS ---- */}
      {Object.entries(armRootPos).map(([key, pos]) => (
        <mesh
          key={`gusset-${key}`}
          position={[pos[0] * 0.6, pos[1] - 0.02, pos[2] * 0.6]}
          rotation={[0, (key === 'FR' || key === 'RL') ? -Math.PI / 4 : Math.PI / 4, 0]}
          material={seamDark}
        >
          <boxGeometry args={[0.08, 0.03, 0.16]} />
        </mesh>
      ))}

      {/* =========================================================
          2. FOUR WOVEN CARBON FIBER ARMS
         ========================================================= */}
      <CarbonArm start={armRootPos.FR} end={motorPos.FR} materials={materials} />
      <CarbonArm start={armRootPos.FL} end={motorPos.FL} materials={materials} />
      <CarbonArm start={armRootPos.RR} end={motorPos.RR} materials={materials} />
      <CarbonArm start={armRootPos.RL} end={motorPos.RL} materials={materials} />

      {/* =========================================================
          3. FOUR MOTOR PODS & DUAL-BLADE PROPELLERS
         ========================================================= */}
      <MotorPod position={motorPos.FR} propDir={ 1} materials={materials} bladeGeo={bladeGeo} spinning={propellersRunning} />
      <MotorPod position={motorPos.FL} propDir={-1} materials={materials} bladeGeo={bladeGeo} spinning={propellersRunning} />
      <MotorPod position={motorPos.RR} propDir={-1} materials={materials} bladeGeo={bladeGeo} spinning={propellersRunning} />
      <MotorPod position={motorPos.RL} propDir={ 1} materials={materials} bladeGeo={bladeGeo} spinning={propellersRunning} />

      {/* =========================================================
          4. LANDING GEAR — ANGLED STRUTS + HORIZONTAL GROUND SKID RAILS
          (Exactly matching the reference image landing skid frame!)
         ========================================================= */}

      {/* Left Landing Skid Assembly (Front & Rear Legs + Ground Rail) */}
      <group position={[-0.38, -0.06, 0]}>
        {/* Front Angled Leg Strut */}
        <mesh position={[0, -0.22, 0.52]} rotation={[0.26, 0, -0.16]} material={legDark}>
          <cylinderGeometry args={[0.026, 0.024, 0.48, 16]} />
        </mesh>
        {/* Rear Angled Leg Strut */}
        <mesh position={[0, -0.22, -0.52]} rotation={[-0.26, 0, -0.16]} material={legDark}>
          <cylinderGeometry args={[0.026, 0.024, 0.48, 16]} />
        </mesh>
        {/* Left Ground Skid Rail (Horizontal Tube with End Caps) */}
        <mesh position={[-0.08, -0.44, 0]} rotation={[Math.PI / 2, 0, 0]} material={legDark}>
          <capsuleGeometry args={[0.028, 1.35, 8, 20]} />
        </mesh>
        {/* Front Foot Cap & Accent Ring */}
        <mesh position={[-0.08, -0.44, 0.68]} material={legDark}>
          <sphereGeometry args={[0.038, 16, 12]} />
        </mesh>
        <mesh position={[-0.08, -0.44, 0.68]} material={tealLed}>
          <torusGeometry args={[0.038, 0.007, 6, 20]} />
        </mesh>
        {/* Rear Foot Cap & Accent Ring */}
        <mesh position={[-0.08, -0.44, -0.68]} material={legDark}>
          <sphereGeometry args={[0.038, 16, 12]} />
        </mesh>
        <mesh position={[-0.08, -0.44, -0.68]} material={tealLed}>
          <torusGeometry args={[0.038, 0.007, 6, 20]} />
        </mesh>
      </group>

      {/* Right Landing Skid Assembly (Front & Rear Legs + Ground Rail) */}
      <group position={[0.38, -0.06, 0]}>
        {/* Front Angled Leg Strut */}
        <mesh position={[0, -0.22, 0.52]} rotation={[0.26, 0, 0.16]} material={legDark}>
          <cylinderGeometry args={[0.026, 0.024, 0.48, 16]} />
        </mesh>
        {/* Rear Angled Leg Strut */}
        <mesh position={[0, -0.22, -0.52]} rotation={[-0.26, 0, 0.16]} material={legDark}>
          <cylinderGeometry args={[0.026, 0.024, 0.48, 16]} />
        </mesh>
        {/* Right Ground Skid Rail */}
        <mesh position={[0.08, -0.44, 0]} rotation={[Math.PI / 2, 0, 0]} material={legDark}>
          <capsuleGeometry args={[0.028, 1.35, 8, 20]} />
        </mesh>
        {/* Front Foot Cap & Accent Ring */}
        <mesh position={[0.08, -0.44, 0.68]} material={legDark}>
          <sphereGeometry args={[0.038, 16, 12]} />
        </mesh>
        <mesh position={[0.08, -0.44, 0.68]} material={tealLed}>
          <torusGeometry args={[0.038, 0.007, 6, 20]} />
        </mesh>
        {/* Rear Foot Cap & Accent Ring */}
        <mesh position={[0.08, -0.44, -0.68]} material={legDark}>
          <sphereGeometry args={[0.038, 16, 12]} />
        </mesh>
        <mesh position={[0.08, -0.44, -0.68]} material={tealLed}>
          <torusGeometry args={[0.038, 0.007, 6, 20]} />
        </mesh>
      </group>

      {/* =========================================================
          5. 3-AXIS GIMBAL CAMERA UNDER FORWARD FUSELAGE
         ========================================================= */}
      <group position={[0, -0.20, 0.68]}>
        {/* Gimbal Mounting Base Bracket */}
        <mesh material={seamDark}>
          <boxGeometry args={[0.22, 0.05, 0.09]} />
        </mesh>
        {/* Gimbal Arm Links */}
        <mesh position={[-0.075, -0.055, 0]} material={camBlack}>
          <cylinderGeometry args={[0.012, 0.012, 0.085, 10]} />
        </mesh>
        <mesh position={[ 0.075, -0.055, 0]} material={camBlack}>
          <cylinderGeometry args={[0.012, 0.012, 0.085, 10]} />
        </mesh>
        {/* Gimbal Outer Ring */}
        <mesh position={[0, -0.055, 0]} material={camBlack}>
          <torusGeometry args={[0.110, 0.015, 8, 28]} />
        </mesh>
        {/* Spherical Camera Housing */}
        <mesh position={[0, -0.055, 0]} material={camBlack}>
          <sphereGeometry args={[0.155, 32, 24]} />
        </mesh>
        {/* Primary Optical Barrel (Snout) */}
        <mesh position={[0, -0.055, 0.145]} rotation={[Math.PI / 2, 0, 0]} material={camBlack}>
          <cylinderGeometry args={[0.078, 0.090, 0.115, 28]} />
        </mesh>
        {/* High-Index Front Glass Lens */}
        <mesh position={[0, -0.055, 0.206]} rotation={[Math.PI / 2, 0, 0]} material={lensGlass}>
          <circleGeometry args={[0.072, 28]} />
        </mesh>
        {/* Metal Lens Retaining Bezel Ring */}
        <mesh position={[0, -0.055, 0.203]} rotation={[Math.PI / 2, 0, 0]} material={motorSilver}>
          <torusGeometry args={[0.050, 0.018, 8, 28]} />
        </mesh>
        {/* Gimbal Lower Accent Status Ring */}
        <mesh position={[0, -0.165, 0]} material={tealLed}>
          <torusGeometry args={[0.038, 0.007, 6, 18]} />
        </mesh>
      </group>

      {/* =========================================================
          6. TOP GPS / NAVIGATION MAST
         ========================================================= */}
      {/* Stalk Base Pad */}
      <mesh position={[0, 0.38, -0.10]} material={motorDark}>
        <cylinderGeometry args={[0.056, 0.070, 0.038, 16]} />
      </mesh>
      {/* Mast Stem */}
      <mesh position={[0, 0.46, -0.10]} material={seamDark}>
        <cylinderGeometry args={[0.013, 0.015, 0.140, 12]} />
      </mesh>
      {/* GPS Puck Sensor */}
      <mesh position={[0, 0.54, -0.10]} material={motorDark}>
        <cylinderGeometry args={[0.040, 0.056, 0.036, 16]} />
      </mesh>
      {/* Antenna Dome Cap */}
      <mesh position={[0, 0.555, -0.10]} material={panelGrey}>
        <sphereGeometry args={[0.036, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
      </mesh>
      {/* Top Navigation LED */}
      <mesh position={[0, 0.56, -0.10]} material={tealLed}>
        <sphereGeometry args={[0.014, 10, 8]} />
      </mesh>

    </group>
  );
}
