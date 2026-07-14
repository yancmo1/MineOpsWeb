from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, case_sensitive=False)
    app_name: str = "MineOpsWeb"
    app_env: str = "development"
    database_url: str = "sqlite:///./mineops.db"
    frontend_origin: str = "http://localhost:8080"
    initial_admin_email: str | None = None
    initial_admin_password: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
