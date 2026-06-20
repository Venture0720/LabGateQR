from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.database import Base, engine, SessionLocal
from app.models import User, RoleEnum
from app.security import hash_password
from app.config import settings
from app.routers import auth, attendance


def bootstrap_developer_account():
    """Creates the initial developer account on first run, if none exists."""
    db = SessionLocal()
    try:
        existing_dev = db.query(User).filter(User.role == RoleEnum.developer).first()
        if not existing_dev:
            dev = User(
                username=settings.dev_bootstrap_username,
                password_hash=hash_password(settings.dev_bootstrap_password),
                role=RoleEnum.developer,
            )
            db.add(dev)
            db.commit()
            print(f"[bootstrap] Created initial developer account: {settings.dev_bootstrap_username}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables (use Alembic migrations in real production instead)
    Base.metadata.create_all(bind=engine)
    bootstrap_developer_account()
    yield
    # Shutdown: nothing to clean up currently


app = FastAPI(
    title="LabGate API",
    description="Access control and attendance tracking system",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: open for mobile app/browser clients hitting from any origin.
# Tighten allow_origins to your actual app domain(s) before going to production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # must be False when allow_origins is "*"
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(attendance.router)

# Mount static files
static_path = Path(__file__).parent / "static"
static_path.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_path)), name="static")


@app.get("/")
def root():
    return FileResponse(static_path / "index.html")


@app.get("/health")
def health_check():
    return {"status": "healthy"}
