from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Магистраль 400"
    database_url: str = "postgresql+asyncpg://magistral:magistral@postgres:5432/magistral"
    valkey_url: str = "redis://valkey:6379/0"
    ml_service_url: str = "http://ml-service:8001"
    ml_timeout_sec: float = 40.0

    jwt_secret: str = "change-me-in-production"
    jwt_ttl_minutes: int = 60 * 24 * 7

    seed_demo_data: bool = True

    # Grace period for network latency when validating decision timers
    answer_grace_sec: float = 2.5

    # Random emergency events ("специвент"): one per [interval, 2*interval] of activity
    emergency_min_interval_sec: int = 900

    # Weekly tournament schedule (Moscow time)
    tournament_weekday: int = 4  # Friday
    tournament_hour: int = 18
    tournament_duration_min: int = 30
    tournament_questions: int = 10
    scheduler_interval_sec: int = 30


@lru_cache
def get_settings() -> Settings:
    return Settings()
