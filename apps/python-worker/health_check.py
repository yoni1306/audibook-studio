#!/usr/bin/env python3
"""
Simple health check script for the Python worker.
This can be used to verify the worker environment and dependencies.
"""

import sys
import os
from pathlib import Path

def check_dependencies():
    """Check if all required dependencies are available"""
    required_modules = [
        'redis',
        'psycopg2',
        'structlog',
    ]
    
    missing_modules = []
    for module in required_modules:
        try:
            __import__(module)
            print(f"✅ {module} - OK")
        except ImportError:
            missing_modules.append(module)
            print(f"❌ {module} - MISSING")
    
    return len(missing_modules) == 0

def check_phonikud():
    """Check phonikud availability"""
    try:
        import phonikud_onnx
        print("✅ phonikud-onnx - OK")
        return True
    except ImportError:
        print("⚠️  phonikud-onnx - MISSING (will use mock implementation)")
        return False

def check_environment():
    """Check environment variables"""
    required_env_vars = [
        'REDIS_URL',
        'DATABASE_URL',
    ]
    
    optional_env_vars = [
        'PHONIKUD_MODEL_PATH',
    ]
    
    print("\n🔍 Environment Variables:")
    all_good = True
    
    for var in required_env_vars:
        value = os.getenv(var)
        if value:
            # Don't print sensitive values, just show they exist
            masked_value = value[:10] + "..." if len(value) > 10 else value
            print(f"✅ {var} = {masked_value}")
        else:
            print(f"❌ {var} - NOT SET")
            all_good = False
    
    for var in optional_env_vars:
        value = os.getenv(var)
        if value:
            print(f"✅ {var} = {value}")
        else:
            print(f"⚠️  {var} - NOT SET (using default)")
    
    return all_good

def check_worker_files():
    """Check if worker files exist"""
    required_files = [
        'worker.py',
        'services/__init__.py',
        'services/database.py',
        'services/diacritics.py',
        'services/job_processor.py',
    ]
    
    print("\n📁 Worker Files:")
    all_good = True
    
    for file_path in required_files:
        if Path(file_path).exists():
            print(f"✅ {file_path} - EXISTS")
        else:
            print(f"❌ {file_path} - MISSING")
            all_good = False
    
    return all_good

def main():
    """Run all health checks"""
    print("🏥 Python Worker Health Check")
    print("=" * 40)
    
    print("\n📦 Dependencies:")
    deps_ok = check_dependencies()
    phonikud_ok = check_phonikud()
    
    env_ok = check_environment()
    files_ok = check_worker_files()
    
    print("\n" + "=" * 40)
    if deps_ok and env_ok and files_ok:
        print("🎉 Health Check PASSED - Worker is ready!")
        return 0
    else:
        print("⚠️  Health Check FAILED - Issues found above")
        return 1

if __name__ == "__main__":
    sys.exit(main())
