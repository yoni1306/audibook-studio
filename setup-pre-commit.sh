#!/bin/bash

# Audibook Studio - Pre-commit Hooks Setup
# Sets up pre-commit hooks for the entire monorepo

set -e

echo "🔧 Setting up pre-commit hooks for Audibook Studio..."

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

# Check if we're in the root directory
if [ ! -f "package.json" ] || [ ! -f ".pre-commit-config.yaml" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check if pre-commit is installed
if ! command -v pre-commit &> /dev/null; then
    print_status "Installing pre-commit..."
    
    # Try to install with pip
    if command -v pip3 &> /dev/null; then
        pip3 install pre-commit
    elif command -v pip &> /dev/null; then
        pip install pre-commit
    else
        print_error "pip not found. Please install pre-commit manually:"
        echo "  pip install pre-commit"
        echo "  or"
        echo "  brew install pre-commit"
        exit 1
    fi
fi

print_success "pre-commit is available"

# Install Node.js dependencies (needed for ESLint and Prettier)
print_status "Installing Node.js dependencies..."
if command -v pnpm &> /dev/null; then
    pnpm install
elif command -v npm &> /dev/null; then
    npm install
else
    print_error "Neither pnpm nor npm found. Please install Node.js dependencies first."
    exit 1
fi

# Install Python dependencies for Python worker
print_status "Setting up Python worker dependencies..."
if [ -d "apps/python-worker" ]; then
    cd apps/python-worker
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        print_status "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment and install dependencies
    source venv/bin/activate
    pip install --upgrade pip
    
    if [ -f "requirements-dev.txt" ]; then
        pip install -r requirements-dev.txt
    else
        pip install -r requirements.txt
        pip install black isort flake8 mypy pre-commit
    fi
    
    cd ../..
    print_success "Python worker dependencies installed"
else
    print_warning "Python worker directory not found, skipping Python setup"
fi

# Install pre-commit hooks
print_status "Installing pre-commit hooks..."
pre-commit install

# Install commit message hook
print_status "Installing commit message hook..."
pre-commit install --hook-type commit-msg

# Run pre-commit on all files to test setup
print_status "Running pre-commit on all files (this may take a while)..."
if pre-commit run --all-files; then
    print_success "Pre-commit hooks installed and tested successfully!"
else
    print_warning "Some pre-commit checks failed. This is normal for the first run."
    print_status "The hooks will automatically fix issues on future commits."
fi

print_success "Pre-commit setup complete!"
echo ""
echo "🎉 Pre-commit hooks are now active for:"
echo "  ✅ JavaScript/TypeScript (ESLint + Prettier)"
echo "  ✅ Python (Black + isort + flake8 + mypy)"
echo "  ✅ Dockerfiles (hadolint)"
echo "  ✅ Shell scripts (shellcheck)"
echo "  ✅ General file checks (trailing whitespace, etc.)"
echo "  ✅ Conventional commit messages"
echo ""
echo "🔄 Hooks will run automatically on:"
echo "  • git commit (code formatting and linting)"
echo "  • git commit -m (commit message validation)"
echo ""
echo "💡 To run hooks manually:"
echo "  pre-commit run --all-files"
echo ""
echo "🚀 Happy coding with consistent code quality!"
