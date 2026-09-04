from pydantic_settings import BaseSettings, SettingsConfigDict


class PerceptionConfig(BaseSettings):
    # Model config
    PERCEPTION_MODEL_PATH: str = "yolov8n.pt"  # Default to nano model for CPU testing
    PERCEPTION_CONFIDENCE: float = 0.5
    PERCEPTION_IOU: float = 0.45
    PERCEPTION_INPUT_SIZE: int = 640

    # Device config
    # Can be "cpu", "cuda:0", "mps", etc. Empty string lets framework decide.
    PERCEPTION_DEVICE: str = "cpu"

    # Classes of interest. COCO 0 = person
    PERCEPTION_CLASSES: list[int] = [0]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


perception_config = PerceptionConfig()
