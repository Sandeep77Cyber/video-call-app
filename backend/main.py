import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from database import verify_user

app = FastAPI()

frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

class LoginRequest(BaseModel):
    username: str
    password: str

rooms: dict[str, list[WebSocket]] = {}

@app.get("/")
async def get_index():
    return FileResponse(os.path.join(frontend_dir, "index.html"))

@app.post("/login")
async def login(data: LoginRequest):
    if verify_user(data.username, data.password):
        return {"status": "ok"}
    raise HTTPException(status_code=401, detail="Invalid username or password")

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    if room_id not in rooms:
        rooms[room_id] = []
    
    if len(rooms[room_id]) >= 2:
        await websocket.send_json({"type": "full"})
        await websocket.close()
        return

    rooms[room_id].append(websocket)
    is_initiator = len(rooms[room_id]) == 2
    await websocket.send_json({"type": "joined", "initiator": is_initiator})

    try:
        while True:
            data = await websocket.receive_text()
            for client in rooms[room_id]:
                if client != websocket:
                    await client.send_text(data)
    except WebSocketDisconnect:
        rooms[room_id].remove(websocket)
        if not rooms[room_id]:
            del rooms[room_id]
