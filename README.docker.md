# Docker quickstart

This project contains a React frontend in `my-react-app` and a Spring Boot backend in `server`.

Build and run both services with Docker Compose (Windows PowerShell):

```powershell
# From repository root (C:\Users\Aseuro\agent)
docker compose build
docker compose up
```

Notes:
- The backend listens on port `8080` and uses `SPRING_PROFILES_ACTIVE=docker` so `application-docker.properties` will be used if present.
- The frontend is served by `nginx` on container port `80` and mapped to host port `3000`.

Tesseract OCR
- The backend image includes `tesseract-ocr` installed in the runtime image. The Java code reads the tessdata path from the `TESSDATA_PATH` or `TESSDATA_PREFIX` environment variable, and falls back to `/usr/share/tessdata`.
- If you need additional language data, add it to the image or mount a host folder to `/usr/share/tessdata` and set `TESSDATA_PATH`.

Customize installed Tesseract languages
- The backend `Dockerfile` accepts a build-arg `TESSDATA_PACKAGES` which lists Debian package names to install. By default it installs: `tesseract-ocr-eng tesseract-ocr-osd tesseract-ocr-spa tesseract-ocr-deu tesseract-ocr-fra`.
- To rebuild the backend image with different languages, run (PowerShell):

```powershell
# Example: add Italian and Portuguese traineddata
docker compose build --build-arg TESSDATA_PACKAGES="tesseract-ocr-eng tesseract-ocr-osd tesseract-ocr-ita tesseract-ocr-por" backend
docker compose up -d backend
```

- Alternatively, mount a host tessdata folder with the traineddata files and set `TESSDATA_PATH` in `docker-compose.yml`:

```yaml
services:
	backend:
		build: ./server
		environment:
			- TESSDATA_PATH=/usr/share/tessdata
		volumes:
			- ./server/tessdata:/usr/share/tessdata:ro
```


Stopping and removing containers:

```powershell
docker compose down
```

If you want to build images manually:

```powershell
docker build -t my-backend:latest ./server
docker build -t my-frontend:latest ./my-react-app
```
