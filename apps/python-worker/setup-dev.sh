#!/bin/bash

# Python Worker Development Setup Script
# Sets up the complete development environment

set -e

echo "🐍 Setting up Python Worker Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check Python version
print_status "Checking Python version..."
python_version=$(python3 --version 2>&1 | cut -d' ' -f2)
required_version="3.11"

if [[ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]]; then
    print_error "Python $required_version or higher is required. Found: $python_version"
    print_status "Please install Python $required_version using pyenv:"
    echo "  pyenv install 3.11.8"
    echo "  pyenv local 3.11.8"
    exit 1
fi

print_success "Python $python_version is compatible"

# Create virtual environment
print_status "Creating virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    print_success "Virtual environment created"
else
    print_warning "Virtual environment already exists"
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
print_status "Upgrading pip..."
pip install --upgrade pip

# Install development dependencies
print_status "Installing development dependencies..."
pip install -r requirements-dev.txt

# Set up pre-commit hooks
print_status "Setting up pre-commit hooks..."
pre-commit install

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    print_status "Creating .env file from example..."
    cp .env.example .env
    print_warning "Please edit .env file with your configuration"
else
    print_warning ".env file already exists"
fi

# Run health check
print_status "Running health check..."
python health_check.py || print_warning "Health check failed - please configure environment variables"

print_success "Development environment setup complete!"
echo ""
echo "🚀 Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Start development with: ./run-worker.sh"
echo "3. Run tests with: pytest"
echo "4. Format code with: black ."
echo "5. Check linting with: flake8"
echo ""
echo "Happy coding! 🎉"
