import urllib.request
import zipfile
import os
import shutil
import ssl

# Ensure SSL context doesn't block download
ssl._create_default_https_context = ssl._create_unverified_context

url = "https://alphacephei.com/vosk/models/vosk-model-en-us-0.22-lgraph.zip"
zip_path = "model.zip"

print(f"Downloading heavier, more accurate STT model (128MB)...\n{url}")
urllib.request.urlretrieve(url, zip_path)
print("Download complete. Extracting...")

with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(".")

print("Extraction complete. Replacing old 'model' directory...")
if os.path.exists("model"):
    shutil.rmtree("model")

os.rename("vosk-model-en-us-0.22-lgraph", "model")
os.remove(zip_path)
print("Done! The new model is in place.")
