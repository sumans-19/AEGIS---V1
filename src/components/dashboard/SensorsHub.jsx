import React from 'react';
import { Camera, Zap, Waves, Thermometer, X } from 'lucide-react';
import './SensorsHub.css';

const SparklineChart = () => (
  <svg width="120" height="40" viewBox="0 0 120 40" className="sparkline">
    <path 
      d="M0 25 L10 32 L20 10 L30 28 L40 22 L50 30 L60 12 L70 20 L80 8 L90 28 L100 20 L110 15 L120 5" 
      fill="none" 
      stroke="#6BA5AD" 
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path 
      d="M0 25 L10 32 L20 10 L30 28 L40 22 L50 30 L60 12 L70 20 L80 8 L90 28 L100 20 L110 15 L120 5 L120 40 L0 40 Z" 
      fill="url(#sparkline-gradient)" 
      opacity="0.3"
    />
    <defs>
      <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6BA5AD" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#6BA5AD" stopOpacity="0" />
      </linearGradient>
    </defs>
    <circle cx="0" cy="25" r="2.5" fill="#6BA5AD" />
    <circle cx="10" cy="32" r="2.5" fill="#6BA5AD" />
    <circle cx="20" cy="10" r="2.5" fill="#6BA5AD" />
    <circle cx="30" cy="28" r="2.5" fill="#6BA5AD" />
    <circle cx="40" cy="22" r="2.5" fill="#6BA5AD" />
    <circle cx="50" cy="30" r="2.5" fill="#6BA5AD" />
    <circle cx="60" cy="12" r="2.5" fill="#6BA5AD" />
    <circle cx="70" cy="20" r="2.5" fill="#6BA5AD" />
    <circle cx="80" cy="8" r="2.5" fill="#6BA5AD" />
    <circle cx="90" cy="28" r="2.5" fill="#6BA5AD" />
    <circle cx="100" cy="20" r="2.5" fill="#6BA5AD" />
    <circle cx="110" cy="15" r="2.5" fill="#6BA5AD" />
    <circle cx="120" cy="5" r="2.5" fill="#fff" stroke="#6BA5AD" strokeWidth="1.5" />
  </svg>
);

export default function SensorsHub({ onSelectSensor }) {
  const [ultrasonicDist, setUltrasonicDist] = React.useState('238.9');

  React.useEffect(() => {
    const fetchDist = async () => {
      try {
        const res = await fetch("http://localhost:5000/proximity-data");
        if (res.ok) {
          const data = await res.json();
          if (data.distance_cm) setUltrasonicDist(data.distance_cm.toFixed(1));
        }
      } catch (e) {}
    };
    fetchDist();
    const interval = setInterval(fetchDist, 1000);
    return () => clearInterval(interval);
  }, []);

  const sensors = [
    {
      id: 'dht11',
      title: 'ENVIRONMENTAL SENSOR',
      description: 'High-precision atmospheric monitoring for ambient temperature and humidity tracking.',
      icon: Thermometer,
      image: '/assets/sensors/dht11.png',
      status: 'ACTIVE',
      reading: '24.2',
      unit: '°C',
      specs: [
        { label: 'Range', value: '-20°C ~ 60°C' },
        { label: 'Humidity', value: '20% ~ 90%' },
        { label: 'Accuracy', value: '±1°C' },
        { label: 'Update Rate', value: '0.5 Hz' }
      ],
      location: 'Left Wing - Outer Mount'
    },
    {
      id: 'ina219',
      title: 'POWER MONITOR',
      description: 'Bi-directional current, voltage, and total power draw telemetry module.',
      icon: Zap,
      image: '/assets/sensors/ina219.png',
      status: 'ACTIVE',
      reading: '11.4',
      unit: 'V',
      specs: [
        { label: 'Bus Voltage', value: '26V Max' },
        { label: 'Current Limit', value: '±3.2A' },
        { label: 'Precision', value: '1% Error' },
        { label: 'Interface', value: 'I2C' }
      ],
      location: 'Core - Power Distribution'
    },
    {
      id: 'ultrasonic',
      title: 'PROXIMITY RADAR',
      description: 'High-precision ultrasonic obstacle detection and real-time shape fusion.',
      icon: Waves,
      image: '/assets/sensors/ultrasonic.png',
      status: 'ACTIVE',
      reading: ultrasonicDist,
      unit: 'cm',
      specs: [
        { label: 'Range', value: '2cm ~ 400cm' },
        { label: 'Angle', value: '< 15°' },
        { label: 'Frequency', value: '40 kHz' },
        { label: 'Resolution', value: '3 mm' }
      ],
      location: 'Front - Gimbal Face'
    },
    {
      id: 'thermal',
      title: 'THERMAL CAMERA',
      description: 'High resolution thermal imaging for heat signature detection and night vision.',
      icon: Camera,
      image: '/assets/sensors/esp32cam.png',
      status: 'ACTIVE',
      reading: '35.4',
      unit: '°C',
      specs: [
        { label: 'Resolution', value: '640 × 512' },
        { label: 'FOV', value: '60°' },
        { label: 'Range', value: '0.5 km' },
        { label: 'Update Rate', value: '30 Hz' }
      ],
      location: 'Front - Bottom Mount'
    }
  ];

  return (
    <div className="sensors-hub">
      <div className="sensors-grid">
        {sensors.map(sensor => (
          <div key={sensor.id} className="light-card">
            
            <div className="light-card__header">
              <h3>{sensor.title}</h3>
              <X size={18} className="icon-close" />
            </div>

            <div className="light-card__info-box">
              <p>{sensor.description}</p>
              <img src={sensor.image} alt={sensor.title} className="info-box__image" />
            </div>

            <div className="light-card__status-row">
              <span className="label">STATUS</span>
              <span className="status-val">{sensor.status}</span>
            </div>

            <div className="light-card__reading-section">
              <div className="label">LIVE READING</div>
              <div className="reading-content">
                <div className="reading-value">
                  {sensor.reading}<span className="unit">{sensor.unit}</span>
                </div>
                <SparklineChart />
              </div>
            </div>

            <div className="light-card__specs-section">
              <div className="label">SPECIFICATIONS</div>
              <div className="specs-list">
                {sensor.specs.map((spec, i) => (
                  <div className="spec-row" key={i}>
                    <span className="spec-label">{spec.label}</span>
                    <span className="spec-value">{spec.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="light-card__location-section">
              <div className="label">LOCATION</div>
              <div className="location-val">{sensor.location}</div>
            </div>

            <button className="btn-view-feed" onClick={() => onSelectSensor(sensor.id)}>
              <Camera size={16} /> VIEW SENSOR FEED
            </button>

          </div>
        ))}
      </div>
    </div>
  );
}
