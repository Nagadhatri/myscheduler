import asyncio
import websockets
import json
import requests
import pyttsx3
import wave
from vosk import Model, KaldiRecognizer
import sys

# Initialize TTS
tts_engine = pyttsx3.init()
tts_engine.setProperty('rate', 150) # Speed

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
    print(f"[TTS] Speaking: {text}")
    tts_engine.say(text)
    tts_engine.runAndWait()

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
                        # Forward to Rasa
                        rasa_res = requests.post(RASA_WEBHOOK, json={"sender": "user", "message": text})
                        rasa_res.raise_for_status()
                        replies = rasa_res.json()
                        for reply in replies:
                            bot_text = reply.get('text', '')
                            if bot_text:
                                print(f"[RASA NLP] Bot says: {bot_text}")
                                await websocket.send(json.dumps({"type": "bot", "text": bot_text}))
                                speak(bot_text)
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
                        
                        # 2. Forward to Rasa
                        try:
                            rasa_res = requests.post(RASA_WEBHOOK, json={"sender": "user", "message": text})
                            rasa_res.raise_for_status()
                            replies = rasa_res.json()
                            
                            for reply in replies:
                                bot_text = reply.get('text', '')
                                if bot_text:
                                    print(f"[RASA NLP] Bot says: {bot_text}")
                                    # Send text to UI
                                    await websocket.send(json.dumps({"type": "bot", "text": bot_text}))
                                    # Speak it!
                                    speak(bot_text)
                        except Exception as e:
                            print(f"Rasa error: {e}")
                            await websocket.send(json.dumps({"type": "bot", "text": "Sorry, my brain is offline."}))
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
