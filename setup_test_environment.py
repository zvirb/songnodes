#!/usr/bin/env python3
"""
Setup script for the SongNodes pipeline test environment
Installs required dependencies for the test suite
"""

import subprocess
import sys
import os

def install_package(package):
    """Install a Python package using pip"""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        print(f"✅ Successfully installed {package}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install {package}: {e}")
        return False

def main():
    """Install test dependencies"""
    print("🔧 Setting up SongNodes Pipeline Test Environment")
    print("=" * 60)

    # Required packages for the test script
    packages = [
        "asyncpg>=0.28.0",
        "httpx>=0.24.0"
    ]

    failed_packages = []

    for package in packages:
        print(f"📦 Installing {package}...")
        if not install_package(package):
            failed_packages.append(package)

    print("\n" + "=" * 60)

    if failed_packages:
        print(f"❌ Failed to install {len(failed_packages)} packages:")
        for pkg in failed_packages:
            print(f"   • {pkg}")
        print("\n🛠️  You may need to install these manually:")
        print(f"   pip install {' '.join(failed_packages)}")
        sys.exit(1)
    else:
        print("✅ All test dependencies installed successfully!")
        print("\n🚀 You can now run the test suite with:")
        print("   python test_pipeline.py")

if __name__ == "__main__":
    main()