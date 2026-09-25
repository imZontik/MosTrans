from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # heuristic | gigachat | ollama
    ml_provider: str = "heuristic"
    llm_timeout_sec: float = 35.0

    gigachat_auth_key: str = ""
    gigachat_scope: str = "GIGACHAT_API_PERS"
    gigachat_model: str = "GigaChat"
    gigachat_verify_ssl: bool = False
    gigachat_oauth_url: str = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
    gigachat_api_url: str = "https://gigachat.devices.sberbank.ru/api/v1"

    ollama_url: str = "http://ollama:11434"
    ollama_model: str = "qwen2.5:3b"


@lru_cache
def get_settings() -> Settings:
    return Settings()
