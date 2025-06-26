#!/usr/bin/env python3
import os
import subprocess
import json
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import argparse

class Color:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'

def print_header(text: str) -> None:
    print(f"\n{Color.CYAN}{Color.BOLD}{text}{Color.END}")

def print_success(text: str) -> None:
    print(f"{Color.GREEN}✅ {text}{Color.END}")

def print_error(text: str) -> None:
    print(f"{Color.RED}❌ {text}{Color.END}")

def run_command(command: str, cwd: Optional[str] = None) -> Tuple[str, int]:
    """Run a shell command and return its output and return code."""
    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True
        )
        return result.stdout, result.returncode
    except Exception as e:
        return str(e), 1

def check_typescript_errors() -> bool:
    """Run TypeScript type checking and return True if no errors found."""
    print_header("🔍 Checking TypeScript errors...")
    
    # First check if we're in a TypeScript project
    if not os.path.exists("tsconfig.json"):
        print_error("tsconfig.json not found. Not a TypeScript project?")
        return False
    
    output, returncode = run_command("npx tsc --noEmit --pretty")
    
    if returncode == 0:
        print_success("No TypeScript errors found!")
        return True
    else:
        print(output)
        return False

def check_eslint_errors() -> bool:
    """Run ESLint and return True if no errors found."""
    print_header("🔍 Checking ESLint errors...")
    
    # First check if ESLint is installed
    if not os.path.exists("node_modules/.bin/eslint"):
        print_error("ESLint not found. Please install it first with 'npm install eslint'")
        return False
    
    output, returncode = run_command("npx eslint . --max-warnings=0 --format=stylish")
    
    if returncode == 0:
        print_success("No ESLint errors found!")
        return True
    else:
        print(output)
        return False

def main():
    parser = argparse.ArgumentParser(description='Check for TypeScript and ESLint errors in your project')
    parser.add_argument('--typescript', action='store_true', help='Check only TypeScript errors')
    parser.add_argument('--eslint', action='store_true', help='Check only ESLint errors')
    args = parser.parse_args()
    
    print(f"{Color.BLUE}{Color.BOLD}🔍 Starting code quality checks...{Color.END}")
    
    check_ts = not args.eslint or args.typescript
    check_eslint = not args.typescript or args.eslint
    
    if not (check_ts or check_eslint):
        check_ts = check_eslint = True
    
    ts_success = True
    eslint_success = True
    
    if check_ts:
        ts_success = check_typescript_errors()
    
    if check_eslint:
        eslint_success = check_eslint_errors()
    
    print("\n" + "="*50)
    print(f"{Color.BOLD}Check Results:{Color.END}")
    print(f"TypeScript: {'✅ No errors' if ts_success else '❌ Errors found'}")
    print(f"ESLint:    {'✅ No errors' if eslint_success else '❌ Errors found'}")
    print("="*50)
    
    if not ts_success or not eslint_success:
        exit(1)

if __name__ == "__main__":
    main()
