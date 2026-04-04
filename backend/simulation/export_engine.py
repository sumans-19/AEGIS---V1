import json
import csv
import io
from datetime import datetime
from uuid import uuid4
import numpy as np

def export_mission_json(world) -> dict:
    # Full mission snapshot
    # helper to convert numpy
    def to_val(x):
        if isinstance(x, np.ndarray): return x.tolist()
        return x

    return {
        "mission_id": str(uuid4()),
        "scenario": world.scenario,
        "exported_at": datetime.now().isoformat(),
        "sim_duration": world.sim_time,
        "summary": {
            "total_survivors": len(world.survivors),
            "detected": len(world.detected_survivors),
            "rescued": sum(1 for s in world.survivors if s.rescued),
            "zone_coverage_pct": float(np.mean(world.zone_coverage) * 100),
            "drone_flights": [
                {"id": d.id, "callsign": d.callsign, "battery": d.battery} for d in world.drones
            ]
        },
        "drones": [
             {
                 "id": d.id,
                 "pos": to_val(d.pos),
                 "status": d.status,
                 "battery": d.battery,
                 "trail": [to_val(p) for p in d.trail]
             } for d in world.drones
        ],
        "survivors": [
            {
                "id": s.id,
                "pos": to_val(s.pos),
                "detected": s.detected,
                "detected_at": s.detected_at,
                "detected_by": s.detected_by,
                "real_coords": s.real_coords,
                "status": "RESCUED" if s.rescued else ("DETECTION_PENDING" if not s.detected else "IDENTIFIED")
            } for s in world.survivors
        ],
        "event_log": [
             {
                 "time": l.time,
                 "drone_id": l.drone_id,
                 "category": l.category,
                 "message": l.message
             } for l in world.event_log
        ],
        "terrain_grid": to_val(world.terrain_grid),
        "coverage_grid": to_val(world.zone_coverage)
    }

def export_mission_csv(world) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["time", "drone_id", "drone_callsign", "event_type", "message", "pos_x", "pos_y", "pos_z", "battery", "survivor_id", "confidence"])
    
    # One row per event log
    for l in world.event_log:
        drone = next((d for d in world.drones if d.id == l.drone_id), None)
        writer.writerow([
            l.time,
            l.drone_id or "",
            drone.callsign if drone else "",
            l.category,
            l.message,
            drone.pos[0] if drone else "",
            drone.pos[1] if drone else "",
            drone.pos[2] if drone else "",
            drone.battery if drone else "",
            "", # survivor_id if event has one
            ""
        ])
    return output.getvalue()

def generate_mission_report(world) -> str:
    coverage = np.mean(world.zone_coverage) * 100
    detected_count = len(world.detected_survivors)
    total_survivors = len(world.survivors)
    rescued_count = sum(1 for s in world.survivors if s.rescued)
    critical_count = sum(1 for l in world.event_log if l.category == "critical")
    
    report = f"""
═══════════════════════════════════
AEGIS MISSION REPORT
Scenario: {world.scenario.upper()}
Mission Duration: {world.sim_time:.1f}s
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
═══════════════════════════════════

EXECUTIVE SUMMARY
Zone coverage achieved: {coverage:.1f}%
Survivors detected: {detected_count}/{total_survivors}
Survivors rescued: {rescued_count}
Critical events: {critical_count}

DRONE PERFORMANCE
"""
    for d in world.drones:
        # Distance flown approx by trail
        dist = sum(np.linalg.norm(np.array(d.trail[i]) - np.array(d.trail[i-1])) for i in range(1, len(d.trail)))
        report += f"""  - Callsign: {d.callsign}
    Status: {d.status}
    Final Battery: {d.battery:.1f}%
    Approx Distance Flown: {dist:.1f}m
    Deployment status: OPERATIONAL if d.battery > 5 else CRITICAL
"""

    report += "\nSURVIVOR TIMELINE\n"
    for s in world.survivors:
        if s.detected:
            drone_call = next((d.callsign for d in world.drones if d.id == s.detected_by), "Unknown")
            report += f"  - #{s.id} Identified at T+{s.detected_at:.1f}s by {drone_call}\n"
            report += f"    Location: {s.real_coords}\n"
            report += f"    Confidence: {s.confidence:.0%}\n"
            report += f"    Status: {'RESCUED ✓' if s.rescued else 'PENDING RECOVERY'}\n"

    report += "\nEVENT LOG (abbreviated)\n"
    # Show last 20 events
    for l in world.event_log[-20:]:
        report += f"  [{l.time:>6.1f}s] {l.category.upper():<10} | {l.message}\n"
        
    report += "\n═══════════════════════════════════\n"
    return report

def merge_mission_data(missions: list) -> dict:
    # Multiple mission snapshots merging
    total_coverage = sum(m["summary"]["zone_coverage_pct"] for m in missions) / len(missions)
    total_found = sum(m["summary"]["detected"] for m in missions)
    
    return {
        "missions_analyzed": len(missions),
        "aggregate": {
            "avg_coverage": total_coverage,
            "total_detections_across_runs": total_found,
        },
        "details": missions
    }
