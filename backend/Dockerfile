FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# The migrations have to ship with the image: init_db() runs `alembic
# upgrade head` on startup and reads both of these from disk.
COPY alembic.ini .
COPY alembic ./alembic

COPY app ./app

# Most PaaS providers (Railway, Render, Fly.io) inject $PORT at runtime.
# Default to 8000 for local `docker run` without -e PORT=...
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
