import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
from api.index import app

# Mount static directories
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")
elif os.path.exists("public/static"):
    app.mount("/static", StaticFiles(directory="public/static"), name="static")

@app.get("/")
async def get_index():
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    if os.path.exists("static/index.html"):
        return FileResponse("static/index.html")
    if os.path.exists("public/index.html"):
        return FileResponse("public/index.html")
    return {"status": "ok", "service": "SuaraKaca TTS"}

if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
