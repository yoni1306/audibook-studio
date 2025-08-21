# Pre-commit Hooks Setup

This project uses pre-commit hooks to ensure consistent code quality across all languages and file types.

## 🚀 Quick Setup

Run the automated setup script:

```bash
./setup-pre-commit.sh
```

This will:
- Install pre-commit if not already installed
- Install Node.js dependencies (for ESLint/Prettier)
- Set up Python virtual environment (for Python tools)
- Install all pre-commit hooks
- Test the setup by running hooks on all files

## 🔧 Manual Setup

If you prefer manual setup:

```bash
# Install pre-commit
pip install pre-commit

# Install dependencies
pnpm install

# Set up Python worker environment
cd apps/python-worker
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
cd ../..

# Install hooks
pre-commit install
pre-commit install --hook-type commit-msg
```

## 🎯 What Gets Checked

### JavaScript/TypeScript Files
- **ESLint**: Code linting and auto-fixing
- **Prettier**: Code formatting
- **File extensions**: `.js`, `.jsx`, `.ts`, `.tsx`

### Python Files (apps/python-worker/)
- **Black**: Code formatting
- **isort**: Import sorting
- **flake8**: Linting
- **mypy**: Type checking
- **File extensions**: `.py`

### All Files
- **Trailing whitespace** removal
- **End of file** newline fixing
- **YAML/JSON/TOML** syntax validation
- **Merge conflict** detection
- **Large files** detection (>1MB)
- **Private keys** detection

### Docker & Shell
- **hadolint**: Dockerfile linting
- **shellcheck**: Shell script linting

### Commit Messages
- **Conventional Commits**: Enforces conventional commit format
- Examples: `feat:`, `fix:`, `docs:`, `refactor:`

## 📝 Available Commands

```bash
# Run all hooks manually
pnpm pre-commit:run

# Install hooks (if not done during setup)
pnpm pre-commit:install

# Update hook versions
pnpm pre-commit:update

# Run specific hook
pre-commit run <hook-name> --all-files

# Skip hooks for a commit (use sparingly!)
git commit --no-verify -m "emergency fix"
```

## 🔄 Workflow

### Normal Development
1. Make your changes
2. Stage files: `git add .`
3. Commit: `git commit -m "feat: add new feature"`
4. Hooks run automatically and may:
   - ✅ Pass: Commit succeeds
   - 🔧 Fix issues: Files are modified, re-stage and commit again
   - ❌ Fail: Fix issues manually, then commit again

### Example Workflow
```bash
# Make changes
echo "console.log('hello')" > test.js

# Stage and commit
git add test.js
git commit -m "feat: add hello world"

# Pre-commit runs:
# - Prettier formats the file
# - ESLint checks for issues
# - Files are auto-fixed

# If files were modified, re-stage and commit
git add test.js
git commit -m "feat: add hello world"
```

## 🛠️ Hook Configuration

### Excluding Files
The configuration automatically excludes:
- `node_modules/`
- `dist/`
- `coverage/`
- `.next/`
- `.nx/`
- Minified files (`.min.js`, `.min.css`)

### Python-specific Paths
Python hooks only run on files in:
- `apps/python-worker/`

### Customizing Hooks
Edit `.pre-commit-config.yaml` to:
- Add new hooks
- Modify existing hook arguments
- Change file patterns
- Update hook versions

## 🐛 Troubleshooting

### Hook Installation Issues
```bash
# Clear pre-commit cache
pre-commit clean

# Reinstall hooks
pre-commit uninstall
pre-commit install
```

### Python Environment Issues
```bash
# Recreate Python environment
cd apps/python-worker
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
```

### ESLint/Prettier Issues
```bash
# Reinstall Node dependencies
rm -rf node_modules
pnpm install
```

### Skipping Hooks (Emergency Only)
```bash
# Skip all hooks
git commit --no-verify -m "emergency fix"

# Skip specific hook
SKIP=eslint git commit -m "skip eslint for this commit"
```

## 📊 Benefits

- ✅ **Consistent code style** across the entire team
- ✅ **Automatic formatting** saves time
- ✅ **Early bug detection** before code review
- ✅ **Enforced standards** for commit messages
- ✅ **Security checks** for sensitive data
- ✅ **Multi-language support** (JS/TS + Python)

## 🎉 Success!

Once set up, you'll see output like this on commits:

```
Trim Trailing Whitespace.................................................Passed
Fix End of Files.........................................................Passed
Check Yaml...............................................................Passed
Check JSON...............................................................Passed
Prettier.................................................................Passed
ESLint...................................................................Passed
Black....................................................................Passed
isort....................................................................Passed
Flake8...................................................................Passed
MyPy.....................................................................Passed
Hadolint.................................................................Passed
ShellCheck...............................................................Passed
Conventional Commit......................................................Passed
```

Happy coding with consistent quality! 🚀
