import asyncio
import websockets
import json
import requests
import pyttsx3
import wave
from vosk import Model, KaldiRecognizer
import sys
import queue
import threading

# Initialize TTS in a dedicated background thread to prevent blocking event loop
# and avoid SAPI5 CoInitialize Windows errors.
tts_queue = queue.Queue()

def tts_worker():
    engine = pyttsx3.init()
    engine.setProperty('rate', 150) # Speed
    while True:
        text = tts_queue.get()
        if text is None:
            break
        print(f"[TTS] Speaking: {text}")
        engine.say(text)
        engine.runAndWait()
        tts_queue.task_done()

threading.Thread(target=tts_worker, daemon=True).start()

# Load Vosk Model
print("Loading Vosk model...")
try:
    model = Model("model") # Requires a folder named 'model' downloaded locally
    recognizer = KaldiRecognizer(model, 16000)
    print("Vosk model loaded successfully.")
except Exception as e:
    print(f"Failed to load model: {e}. Make sure you extracted vosk-model-small-en-us-0.15 to a folder named 'model'.")
    sys.exit(1)

RASA_WEBHOOK = "http://localhost:5005/webhooks/rest/webhook"

def speak(text):
    tts_queue.put(text)

async def handle_rasa_request(websocket, text):
    loop = asyncio.get_event_loop()
    try:
        # Run the synchronous HTTP request in a thread pool so we don't block the websocket
        rasa_res = await loop.run_in_executor(
            None,
            lambda: requests.post(RASA_WEBHOOK, json={"sender": "user", "message": text})
        )
        rasa_res.raise_for_status()
        replies = rasa_res.json()
        for reply in replies:
            bot_text = reply.get('text', '')
            if bot_text:
                print(f"[RASA NLP] Bot says: {bot_text}")
                await websocket.send(json.dumps({"type": "bot", "text": bot_text}))
                speak(bot_text)
    except requests.exceptions.ConnectionError:
        print("Rasa is not ready yet.")
        msg = "I'm still waking up! Please give me a few seconds."
        await websocket.send(json.dumps({"type": "bot", "text": msg}))
        speak(msg)
    except Exception as e:
        print(f"Rasa error: {e}")
        msg = "Sorry, my brain encountered an error."
        await websocket.send(json.dumps({"type": "bot", "text": msg}))
        speak(msg)

async def process_audio(websocket, path):
    print("Client connected")
    try:
        async for message in websocket:
            if isinstance(message, str):
                try:
                    data = json.loads(message)
                    text = data.get("text", "")
                    if text:
                        print(f"[TEXT IN] User says: {text}")
                        # Forward to Rasa without blocking
                        asyncio.create_task(handle_rasa_request(websocket, text))
                except Exception as e:
                    print(f"Error processing text message: {e}")
            else:
                # Vosk expects raw bytes
                if recognizer.AcceptWaveform(message):
                    result = json.loads(recognizer.Result())
                    text = result.get('text', '')
                    if text:
                        print(f"[VOSK STT] Heard: {text}")
                        
                        # 1. Send text back to UI (so user sees what they said)
                        await websocket.send(json.dumps({"type": "stt", "text": text}))
                        
                        # 2. Forward to Rasa without blocking
                        asyncio.create_task(handle_rasa_request(websocket, text))
                else:
                    partial = json.loads(recognizer.PartialResult())
                    if partial.get('partial'):
                        await websocket.send(json.dumps({"type": "partial", "text": partial['partial']}))
                    
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")

start_server = websockets.serve(process_audio, "localhost", 2700)

print("Starting Vosk WebSocket Server on ws://localhost:2700")
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
