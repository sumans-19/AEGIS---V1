/*
 ==============================================================================
  AEGIS SENSOR HUB — ARDUINO UNO ULTRASONIC SENSOR TELEMETRY SKETCH
 ==============================================================================
  Hardware Configuration:
    - Board: Arduino UNO (Connected on COM port / USB)
    - Trig Pin -> Pin 9
    - Echo Pin -> Pin 10
    - VCC -> 5V
    - GND -> GND
    - Baud Rate: 9600 / 115200
 ==============================================================================
*/

const int trigPin = 9;
const int echoPin = 10;

void setup() {
  Serial.begin(9600);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
}

void loop() {
  // Clear the trigger pin
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  // Send a 10us high pulse
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // Read the echo pin pulse duration in microseconds
  long duration = pulseIn(echoPin, HIGH, 30000); // 30ms timeout (~5m)

  float distance_cm;
  if (duration == 0) {
    distance_cm = 400.0; // Out of range
  } else {
    // Speed of sound: 343 m/s = 0.0343 cm/us
    distance_cm = (duration * 0.0343) / 2.0;
  }

  // Formatted serial output for Python stream_server auto-detection
  Serial.print("DISTANCE: ");
  Serial.println(distance_cm, 2);

  delay(80); // ~12 Hz refresh rate
}
