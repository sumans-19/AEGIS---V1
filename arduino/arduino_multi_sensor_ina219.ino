/*
 ==============================================================================
  AEGIS SENSOR HUB — ARDUINO UNO 4-SENSOR TELEMETRY SKETCH
 ==============================================================================
  Sensors Integrated:
    1. HC-SR04 Ultrasonic Distance Sensor (Trig Pin 9, Echo Pin 10)
    2. DHT11 Temperature & Humidity Sensor (Data Pin 2)
    3. INA219 High-Side DC Current, Voltage & Power Monitor (I2C: SDA A4, SCL A5)
    4. Optical/Thermal Camera Hub (ESP32-CAM via WiFi / Serial Bridge)

  Hardware Wiring:
    - Arduino UNO 5V & GND to Power Rail
    - HC-SR04: Trig -> Pin 9, Echo -> Pin 10
    - DHT11: Signal -> Pin 2
    - INA219: SDA -> Pin A4, SCL -> Pin A5, VCC -> 5V, GND -> GND
    - INA219 Vin+ / Vin- across DC load/battery circuit

  Baud Rate: 9600
  Packet Format:
    DIST:<val>,TEMP:<val>,HUM:<val>,VOLT:<val>,CURR:<val>,POW:<val>
 ==============================================================================
*/

#include <Wire.h>
#include <Adafruit_INA219.h>
#include "DHT.h"

// DHT11 Pin & Configuration
#define DHTPIN 2
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// HC-SR04 Ultrasonic Distance Sensor Pins
const int trigPin = 9;
const int echoPin = 10;

// INA219 Sensor Instance
Adafruit_INA219 ina219;
bool ina_detected = false;

void setup() {
  Serial.begin(9600);

  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  dht.begin();

  if (ina219.begin()) {
    ina_detected = true;
  }
}

void loop() {
  // 1. HC-SR04 Ultrasonic Ping
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 30000); // 30ms timeout (~5m max)
  float distanceCm = (duration == 0) ? -1.0 : (duration * 0.0343 / 2.0);

  // 2. DHT11 Environmental Readings
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  // 3. INA219 Voltage, Current & Power Telemetry
  float bus_v = 0.0;
  float current_ma = 0.0;
  float power_mw = 0.0;

  if (ina_detected) {
    bus_v = ina219.getBusVoltage_V();
    current_ma = ina219.getCurrent_mA();
    power_mw = ina219.getPower_mW();
  }

  // 4. Structured Telemetry Packet Output (Parsed in Real-Time by stream_server.py)
  Serial.print("DIST:");
  Serial.print(distanceCm, 1);
  Serial.print(",TEMP:");
  if (isnan(temp)) Serial.print("ERR"); else Serial.print(temp, 1);
  Serial.print(",HUM:");
  if (isnan(hum)) Serial.print("ERR"); else Serial.print(hum, 1);
  Serial.print(",VOLT:");
  Serial.print(bus_v, 2);
  Serial.print(",CURR:");
  Serial.print(current_ma, 1);
  Serial.print(",POW:");
  Serial.println(power_mw, 1);

  delay(500); // 2.0 Hz telemetry broadcast
}
