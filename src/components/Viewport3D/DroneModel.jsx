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

/* ---- DETAILED SPINNING LIDAR PUCK ---- */
function SpinningLidar({ materials, spinning, onClick }) {
  const ref = React.useRef();
  useFrame((_, dt) => {
    if (ref.current && spinning) {
      ref.current.rotation.y -= dt * 15;
    }
  });
  return (
    <group position={[0.0, 0.52, 0.25]} onClick={(e) => { e.stopPropagation(); onClick?.('lidar'); }}>
      {/* Heavy metallic base */}
      <mesh material={materials.motorSilver} position={[0, -0.04, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 0.04, 32]} />
      </mesh>
      {/* Ribbed heatsink base */}
      {[0, 1, 2, 3].map(i => (
        <mesh key={i} material={materials.motorDark} position={[0, -0.02 + i * 0.005, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.003, 32]} />
        </mesh>
      ))}
      {/* Outer transparent protective dome/glass */}
      <mesh material={materials.lensGlass} position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.065, 0.07, 0.08, 32]} />
      </mesh>
      {/* Spinning optical core */}
      <mesh ref={ref} material={materials.camBlack} position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.06, 16]} />
        {/* Laser lenses */}
        <mesh material={materials.tealLed} position={[0, 0.01, 0.04]}>
          <boxGeometry args={[0.02, 0.015, 0.01]} />
        </mesh>
        <mesh material={materials.tealLed} position={[0, -0.01, 0.04]}>
          <boxGeometry args={[0.02, 0.015, 0.01]} />
        </mesh>
      </mesh>
      {/* Top cap */}
      <mesh material={materials.motorSilver} position={[0, 0.075, 0]}>
        <cylinderGeometry args={[0.065, 0.065, 0.01, 32]} />
      </mesh>
    </group>
  );
}

/* =========================================================================
   MAIN EXPORT COMPONENT
   ========================================================================= */
export default function DroneModel({ wireframe = false, xray = false, propellersRunning = true, onSensorClick }) {
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

  const {
    shellWhite,
    panelGrey,
    seamDark,
    carbonFiber,
    propMat,
    camBlack,
    lensGlass,
    tealLed,
    legDark,
    motorDark,
    motorSilver,
  } = materials;

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

      {/* =========================================================
          HIGH-FIDELITY REALISTIC SENSOR HARDWARE MODULES
         ========================================================= */}

      {/* 1. TOP GPS MODULE & FOLDING MAST */}
      <group position={[0, 0.44, -0.15]}>
        {/* CNC Aluminum Mast Base Hinge */}
        <mesh material={seamDark}>
          <boxGeometry args={[0.07, 0.035, 0.07]} />
        </mesh>
        <mesh position={[0, 0.02, 0]} material={motorSilver}>
          <cylinderGeometry args={[0.025, 0.030, 0.025, 16]} />
        </mesh>
        {/* Carbon Fiber Mast Rod */}
        <mesh position={[0, 0.08, 0]} material={carbonFiber}>
          <cylinderGeometry args={[0.012, 0.012, 0.12, 16]} />
        </mesh>
        {/* GPS Puck Saucer Antenna Base */}
        <mesh position={[0, 0.14, 0]} material={motorDark}>
          <cylinderGeometry args={[0.095, 0.085, 0.028, 32]} />
        </mesh>
        {/* GPS Top Ceramic Patch Housing */}
        <mesh position={[0, 0.155, 0]} material={shellWhite}>
          <cylinderGeometry args={[0.085, 0.095, 0.018, 32]} />
        </mesh>
        {/* Center Ceramic GNSS Square */}
        <mesh position={[0, 0.166, 0]} material={motorSilver}>
          <boxGeometry args={[0.07, 0.005, 0.07]} />
        </mesh>
        {/* Active 360° GNSS Status Ring */}
        <mesh position={[0, 0.145, 0]} material={tealLed}>
          <torusGeometry args={[0.092, 0.004, 8, 32]} />
        </mesh>
      </group>

      {/* 2. IMU FLIGHT CONTROLLER AVIONICS CORE (Visible Deck Port) */}
      <group position={[0, 0.425, 0.10]}>
        {/* Raised Avionics Deck Port Plate */}
        <mesh material={seamDark}>
          <boxGeometry args={[0.18, 0.020, 0.18]} />
        </mesh>
        {/* 4 Corner Silicone Vibration Dampening Standoffs */}
        {[[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]].map(([x, z], i) => (
          <mesh key={`imu-standoff-${i}`} position={[x, 0.015, z]} material={motorSilver}>
            <cylinderGeometry args={[0.010, 0.010, 0.018, 12]} />
          </mesh>
        ))}
        {/* Black FR4 Printed Circuit Board */}
        <mesh position={[0, 0.022, 0]} material={camBlack}>
          <boxGeometry args={[0.14, 0.006, 0.14]} />
        </mesh>
        {/* 9-Axis Gyro IC Chip (Surface Mount) */}
        <mesh position={[0, 0.028, 0]} material={motorSilver}>
          <boxGeometry args={[0.045, 0.008, 0.045]} />
        </mesh>
        {/* Gold Solder Contacts */}
        <mesh position={[0.035, 0.026, 0]} material={panelGrey}>
          <boxGeometry args={[0.010, 0.004, 0.035]} />
        </mesh>
        {/* IMU Active Telemetry Status Blinker */}
        <mesh position={[0.045, 0.028, 0.045]} material={tealLed}>
          <boxGeometry args={[0.010, 0.006, 0.010]} />
        </mesh>
      </group>

      {/* 3. FRONT NOSE OBSTACLE LIDAR & ULTRASONIC RADAR BUMPER */}
      <group position={[0, 0.14, 0.96]}>
        {/* Mounting Bumper Bracket */}
        <mesh material={seamDark}>
          <boxGeometry args={[0.22, 0.055, 0.06]} />
        </mesh>
        {/* Twin Ultrasonic Transducer Cans (HC-SR04 Style Silver Cylinders) */}
        {[-0.065, 0.065].map((x, i) => (
          <group key={`sonar-can-${i}`} position={[x, 0, 0.030]} rotation={[Math.PI / 2, 0, 0]}>
            {/* Outer Beveled Aluminum Barrel */}
            <mesh material={motorSilver}>
              <cylinderGeometry args={[0.028, 0.028, 0.035, 24]} />
            </mesh>
            {/* Dark Acoustic Mesh Face */}
            <mesh position={[0, 0.018, 0]} material={camBlack}>
              <circleGeometry args={[0.024, 20]} />
            </mesh>
            {/* Inner Transducer Core */}
            <mesh position={[0, 0.019, 0]} material={tealLed}>
              <circleGeometry args={[0.008, 16]} />
            </mesh>
          </group>
        ))}
        {/* Center Laser LiDAR Scanner Turret */}
        <mesh position={[0, 0.030, 0]} material={camBlack}>
          <cylinderGeometry args={[0.032, 0.036, 0.030, 20]} />
        </mesh>
        <mesh position={[0, 0.042, 0]} material={tealLed}>
          <torusGeometry args={[0.030, 0.003, 6, 20]} />
        </mesh>
      </group>

      {/* 4. SMOKE / GAS SNIFFER & PARTICULATE SENSOR (Right Wing Port) */}
      <group position={[0.42, 0.22, 0.38]}>
        {/* Sensor Housing Pylon Base */}
        <mesh material={seamDark}>
          <boxGeometry args={[0.08, 0.05, 0.08]} />
        </mesh>
        {/* MQ-Type Stainless Steel Wire Mesh Sensor Bonnet */}
        <mesh position={[0.02, 0.035, 0]} material={motorSilver}>
          <cylinderGeometry args={[0.028, 0.028, 0.040, 20]} />
        </mesh>
        {/* Internal Heated Catalytic Element */}
        <mesh position={[0.02, 0.035, 0]} material={tealLed}>
          <sphereGeometry args={[0.014, 12, 10]} />
        </mesh>
        {/* Air Intake Scoop Gills */}
        <mesh position={[0.045, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={camBlack}>
          <planeGeometry args={[0.05, 0.025]} />
        </mesh>
      </group>

      {/* 5. 6S LIPO BATTERY MODULE & QUICK-RELEASE POWER DECK */}
      <group position={[0, 0.40, -0.48]}>
        {/* Carbon-Wrapped 6-Cell Battery Pack */}
        <mesh material={carbonFiber}>
          <boxGeometry args={[0.26, 0.11, 0.38]} />
        </mesh>
        {/* Top Reinforcement Spine Armor */}
        <mesh position={[0, 0.060, 0]} material={seamDark}>
          <boxGeometry args={[0.20, 0.015, 0.34]} />
        </mesh>
        {/* Quick-Release Lock Handle */}
        <mesh position={[0, 0.055, -0.18]} material={motorDark}>
          <boxGeometry args={[0.12, 0.035, 0.025]} />
        </mesh>
        {/* Yellow XT90 High-Current Power Connector Terminals */}
        <mesh position={[-0.05, 0.055, -0.19]} material={motorSilver}>
          <cylinderGeometry args={[0.012, 0.012, 0.018, 12]} />
        </mesh>
        <mesh position={[0.05, 0.055, -0.19]} material={motorSilver}>
          <cylinderGeometry args={[0.012, 0.012, 0.018, 12]} />
        </mesh>
        {/* 5-Segment LED Battery Fuel Gauge */}
        {[-0.06, -0.03, 0, 0.03, 0.06].map((x, i) => (
          <mesh key={`bat-led-${i}`} position={[x, 0.069, -0.10]} material={tealLed}>
            <boxGeometry args={[0.020, 0.005, 0.008]} />
          </mesh>
        ))}
      </group>

      {/* 6. UNDER-BELLY ALTITUDE & GROUND SONAR CLEARANCE MODULE */}
      <group position={[0, -0.18, 0.0]}>
        {/* Ventral Sensor Pod Enclosure */}
        <mesh material={camBlack}>
          <boxGeometry args={[0.16, 0.040, 0.12]} />
        </mesh>
        {/* Dual Ground Sonar Transceiver Horns */}
        {[-0.045, 0.045].map((x, i) => (
          <group key={`alt-horn-${i}`} position={[x, -0.022, 0]}>
            <mesh material={motorSilver}>
              <cylinderGeometry args={[0.022, 0.016, 0.018, 16]} />
            </mesh>
            <mesh position={[0, -0.010, 0]} rotation={[Math.PI / 2, 0, 0]} material={tealLed}>
              <circleGeometry args={[0.015, 16]} />
            </mesh>
          </group>
        ))}
        {/* Downward Optical Flow Lens */}
        <mesh position={[0, -0.022, 0.035]} rotation={[Math.PI / 2, 0, 0]} material={lensGlass}>
          <circleGeometry args={[0.022, 16]} />
        </mesh>
      </group>

      {/* 7. FPV NAVIGATION CAMERA (Front Nose Aperture) */}
      <group position={[0, -0.06, 1.02]}>
        {/* Protective Aluminum Roll-Cage Frame */}
        <mesh material={motorDark}>
          <boxGeometry args={[0.09, 0.065, 0.04]} />
        </mesh>
        {/* 2.1mm Optical Glass Lens Barrel */}
        <mesh position={[0, 0, 0.022]} rotation={[Math.PI / 2, 0, 0]} material={camBlack}>
          <cylinderGeometry args={[0.024, 0.024, 0.025, 24]} />
        </mesh>
        {/* Front Anti-Reflective Optical Glass Element */}
        <mesh position={[0, 0, 0.036]} rotation={[Math.PI / 2, 0, 0]} material={lensGlass}>
          <circleGeometry args={[0.020, 20]} />
        </mesh>
        <mesh position={[0, 0, 0.037]} material={tealLed}>
          <torusGeometry args={[0.022, 0.002, 6, 20]} />
        </mesh>
      </group>

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
        {/* THERMAL SENSOR LENS (Offset on Gimbal) */}
        <group position={[-0.10, -0.055, 0.14]} onClick={(e) => { e.stopPropagation(); onSensorClick?.('thermal'); }}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={camBlack}>
            <cylinderGeometry args={[0.04, 0.04, 0.08, 24]} />
          </mesh>
          {/* Ribbed thermal barrel */}
          {[0,1,2].map(i => (
            <mesh key={i} position={[0, 0, 0.02 - i*0.015]} rotation={[Math.PI / 2, 0, 0]} material={motorDark}>
              <cylinderGeometry args={[0.043, 0.043, 0.005, 24]} />
            </mesh>
          ))}
          {/* Germanium dark lens */}
          <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]} material={seamDark}>
            <sphereGeometry args={[0.035, 16, 16, 0, Math.PI*2, 0, Math.PI/2]} />
          </mesh>
        </group>
      </group>

      {/* =========================================================
          6. TOP GPS / NAVIGATION MAST
         ========================================================= */}
      <group onClick={(e) => { e.stopPropagation(); onSensorClick?.('gps'); }}>
        {/* Stalk Base Pad */}
        <mesh position={[0, 0.58, -0.10]} material={motorDark}>
          <cylinderGeometry args={[0.056, 0.070, 0.038, 16]} />
        </mesh>
        {/* Mast Stem */}
        <mesh position={[0, 0.65, -0.10]} material={seamDark}>
          <cylinderGeometry args={[0.013, 0.015, 0.140, 12]} />
        </mesh>
        {/* GPS Puck Sensor */}
        <mesh position={[0, 0.73, -0.10]} material={motorDark}>
          <cylinderGeometry args={[0.040, 0.056, 0.036, 16]} />
        </mesh>
        <mesh position={[0, 0.73, -0.10]} material={motorSilver}>
          <torusGeometry args={[0.040, 0.005, 8, 16]} />
        </mesh>
        {/* Antenna Dome Cap */}
        <mesh position={[0, 0.745, -0.10]} material={panelGrey}>
          <sphereGeometry args={[0.036, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        </mesh>
        {/* Top Navigation LED */}
        <mesh position={[0, 0.75, -0.10]} material={tealLed}>
          <sphereGeometry args={[0.014, 10, 8]} />
        </mesh>
      </group>

      {/* =========================================================
          7. NEW SEARCH & RESCUE SENSORS
         ========================================================= */}
      
      {/* OBSTACLE LIDAR (Animated) */}
      <SpinningLidar materials={{ seamDark, camBlack, lensGlass, motorSilver, motorDark, tealLed }} spinning={propellersRunning} onClick={onSensorClick} />

      {/* FPV PILOT CAMERA (Fixed in Nose) */}
      <group position={[0.0, 0.08, 0.86]} rotation={[-0.1, 0, 0]} onClick={(e) => { e.stopPropagation(); onSensorClick?.('camera'); }}>
        {/* Boxy heatsink body */}
        <mesh material={motorDark}>
          <boxGeometry args={[0.07, 0.07, 0.09]} />
        </mesh>
        {/* Lens barrel */}
        <mesh material={camBlack} position={[0, 0, 0.05]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.035, 0.05, 32]} />
        </mesh>
        {/* Glass lens */}
        <mesh position={[0, 0, 0.07]} material={lensGlass}>
          <sphereGeometry args={[0.025, 16, 16, 0, Math.PI*2, 0, Math.PI/2]} />
        </mesh>
        <mesh position={[0, 0, 0.07]} material={motorSilver} rotation={[Math.PI/2, 0, 0]}>
          <torusGeometry args={[0.027, 0.003, 16, 32]} />
        </mesh>
      </group>

      {/* IMU SENSOR ACCESS PLATE (Top Center Spine) */}
      <group position={[0.0, 0.60, 0.0]} onClick={(e) => { e.stopPropagation(); onSensorClick?.('imu'); }}>
        <mesh material={motorDark}>
          <boxGeometry args={[0.18, 0.03, 0.18]} />
        </mesh>
        <mesh material={seamDark} position={[0, 0.015, 0]}>
          <boxGeometry args={[0.14, 0.005, 0.14]} />
        </mesh>
        <mesh material={panelGrey} position={[0, 0.018, 0]}>
          <boxGeometry args={[0.12, 0.002, 0.12]} />
        </mesh>
        {/* Tiny screws */}
        {[[-0.04,-0.04],[0.04,-0.04],[-0.04,0.04],[0.04,0.04]].map((pos, i) => (
          <mesh key={i} material={motorSilver} position={[pos[0], 0.02, pos[1]]}>
            <cylinderGeometry args={[0.004, 0.004, 0.002, 8]} />
          </mesh>
        ))}
      </group>

      {/* SMOKE SENSOR / AIR SAMPLER (Right Side Intake) */}
      <group position={[0.32, 0.05, 0.25]} rotation={[0, 0, -Math.PI/2]} onClick={(e) => { e.stopPropagation(); onSensorClick?.('smoke'); }}>
        <mesh material={camBlack}>
          <cylinderGeometry args={[0.06, 0.06, 0.05, 24]} />
        </mesh>
        <mesh position={[0, 0.025, 0]} material={motorSilver}>
          <ringGeometry args={[0.04, 0.06, 24]} />
        </mesh>
        <mesh position={[0, 0.02, 0]} material={seamDark}>
          <circleGeometry args={[0.05, 24]} />
        </mesh>
        {/* Micro fan blades (static) */}
        {[0,1,2,3,4].map(i => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI*2) / 5]} position={[0, 0.021, 0]} material={motorSilver}>
            <boxGeometry args={[0.01, 0.08, 0.002]} />
          </mesh>
        ))}
      </group>

      {/* BATTERY PACK HATCH (Rear Compartment) */}
      <group position={[0.0, 0.15, -0.85]} rotation={[0.4, 0, 0]} onClick={(e) => { e.stopPropagation(); onSensorClick?.('battery'); }}>
        <mesh material={motorDark}>
          <boxGeometry args={[0.26, 0.22, 0.1]} />
        </mesh>
        {/* Ribbed battery surface */}
        {[0,1,2,3,4,5].map(i => (
          <mesh key={i} material={camBlack} position={[0, -0.08 + i*0.03, 0.05]}>
            <boxGeometry args={[0.22, 0.01, 0.005]} />
          </mesh>
        ))}
        {/* Battery Charge Indicator Strip */}
        <mesh position={[-0.08, 0.08, 0.052]} material={tealLed}>
          <boxGeometry args={[0.04, 0.015, 0.004]} />
        </mesh>
        <mesh position={[-0.03, 0.08, 0.052]} material={tealLed}>
          <boxGeometry args={[0.04, 0.015, 0.004]} />
        </mesh>
        <mesh position={[0.02, 0.08, 0.052]} material={tealLed}>
          <boxGeometry args={[0.04, 0.015, 0.004]} />
        </mesh>
        <mesh position={[0.07, 0.08, 0.052]} material={seamDark}>
          <boxGeometry args={[0.04, 0.015, 0.004]} />
        </mesh>
      </group>

    </group>
  );
}
