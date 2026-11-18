import sys
import os

HOST = '127.0.0.1'
PORT = '8000'

# Security check: Never permit binding to non-loopback interfaces (e.g. 0.0.0.0 or LAN IP)
for idx, arg in enumerate(sys.argv):
    if arg in ('--host', '-h') and idx + 1 < len(sys.argv):
        candidate = sys.argv[idx + 1].strip().lower()
        if candidate not in ('127.0.0.1', 'localhost', '::1') and not candidate.startswith('127.'):
            print(f"❌ [Security Error] Fatal: Chroma must bind strictly to loopback (127.0.0.1), got '{candidate}'. Refusing to start.", file=sys.stderr)
            sys.exit(1)
        HOST = candidate

try:
    import chromadb.cli.cli as chroma_cli
    print("======================================================")
    print(f"🔮 Starting Official Chroma DB Server (Host: {HOST}, Port: {PORT})...")
    print("💾 Data directory: ./chroma_data")
    print("🔒 Security: Explicit 127.0.0.1 loopback isolation enforced")
    print("======================================================\n")
    sys.argv = ['chroma', 'run', '--path', './chroma_data', '--port', PORT, '--host', HOST]
    chroma_cli.app()
except ImportError as e:
    print("❌ Failed to load Chroma DB python module:", e)
    print("Please install via: pip install chromadb")
    sys.exit(1)
