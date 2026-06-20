from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    supabase_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720

    dev_bootstrap_username: str = "developer"
    dev_bootstrap_password: str = "changeme123!"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


settings = Settings()
