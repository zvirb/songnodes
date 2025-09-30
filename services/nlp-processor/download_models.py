#!/usr/bin/env python3
"""Download spaCy models for NLP processor"""
import subprocess
import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_model(model_name):
    """Download a spaCy model"""
    try:
        logger.info(f"Downloading spaCy model: {model_name}")
        result = subprocess.run([
            sys.executable, "-m", "spacy", "download", model_name
        ], capture_output=True, text=True, check=True)
        logger.info(f"Successfully downloaded {model_name}")
        return True
    except subprocess.CalledProcessError as e:
        logger.warning(f"Failed to download {model_name}: {e}")
        logger.warning(f"Error output: {e.stderr}")
        return False

def main():
    """Download required spaCy models"""
    # Use specific versions compatible with spaCy 3.7.2
    models = [
        "en_core_web_sm-3.7.0",
        "en_core_web_sm",  # Fallback to latest
        "en_core_web_md-3.7.0",
        "en_core_web_md"
    ]

    for model in models:
        success = download_model(model)
        if success:
            logger.info(f"Model {model} is ready")
            break
    else:
        logger.warning("No spaCy models could be downloaded. NLP will use rule-based processing.")

if __name__ == "__main__":
    main()