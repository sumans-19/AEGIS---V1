from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from simulation.world_state import world
from simulation import drone_engine, survivor_engine, scenario_loader, trajectory
from simulation.sensor_manager import sensor_manager
from api.routes import router
from api.api_websocket import hub

@asynccontextmanager
async def lifespan(app):
    # Start simulation loop as background task
    loop_task = asyncio.create_task(simulation_loop())
    yield
    loop_task.cancel()

app = FastAPI(lifespan=lifespan)

# Allow CORS for dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

async def simulation_loop():
    last_sensor_tick = 0
    while True:
        try:
            now = asyncio.get_event_loop().time()
            # Continuously tick sensors (1Hz sampling)
            if now - last_sensor_tick >= 1.0:
                last_sensor_tick = now
                sensor_manager.tick_simulation_feed(world.sim_time)

            if world.running:
                # dt = 0.05s * world.speed (20Hz base)
                dt = 0.05 * world.speed
                world.sim_time += dt
                world.tick += 1
                
                # Engines
                drone_engine.tick_all(dt)
                survivor_engine.update_survivors(world, dt)
                survivor_engine.check_detections(world)
                scenario_loader.handle_scenario_events()
                trajectory.update_all_trajectories()
                
                # Broadcast state via WS
                await hub.broadcast(world)
                
            # Delta time wait
            await asyncio.sleep(0.05 / world.speed if world.speed > 0 else 0.05)
        except Exception as e:
            print(f"Simulation Error: {e}")
            await asyncio.sleep(0.1)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
