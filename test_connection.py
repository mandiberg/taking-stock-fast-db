#!/usr/bin/env python3
"""Simple ClickHouse connection tester.

Usage:
  python test_connection.py

It reads ClickHouse config from `myPasswords.clickhouse` (if available) or environment vars:
  CLICKHOUSE_HOST, CLICKHOUSE_PORT, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD

Tests performed:
  - TCP connect (socket)
  - HTTP GET to /?query=SELECT%201
  - clickhouse-client --query "SELECT version()"

This is intentionally dependency-light and prints clear success/error messages.
"""

import socket
import urllib.request
import subprocess
import sys
import os
import json

DEFAULT_TIMEOUT = 5


def load_config():
    conf = {}
    try:
        import myPasswords
        conf = getattr(myPasswords, 'clickhouse', {}) or {}
    except Exception:
        pass

    # Environment overrides
    conf['host'] = os.environ.get('CLICKHOUSE_HOST', conf.get('host', '127.0.0.1'))
    conf['port'] = int(os.environ.get('CLICKHOUSE_PORT', conf.get('port', 8123)))
    conf['username'] = os.environ.get('CLICKHOUSE_USER', conf.get('username'))
    conf['password'] = os.environ.get('CLICKHOUSE_PASSWORD', conf.get('password'))
    conf['database'] = os.environ.get('CLICKHOUSE_DATABASE', conf.get('database'))

    if conf['host'] == 'localhost':
        conf['host'] = '127.0.0.1'

    return conf


def test_tcp(host, port, timeout=DEFAULT_TIMEOUT):
    print(f"Testing TCP connection to {host}:{port}...")
    try:
        with socket.create_connection((host, port), timeout=timeout):
            print("  ✓ TCP connect: OK")
            return True
    except Exception as e:
        print(f"  ✗ TCP connect failed: {e}")
        return False


def test_http(host, port, username=None, password=None, timeout=DEFAULT_TIMEOUT):
    url = f'http://{host}:{port}/?query=SELECT%201'
    print(f"Testing HTTP GET to {url} ...")
    req = urllib.request.Request(url)
    # Add Basic Auth header if credentials provided
    if username and password:
        import base64
        token = base64.b64encode(f"{username}:{password}".encode()).decode()
        req.add_header('Authorization', f'Basic {token}')

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read(200)
            print(f"  ✓ HTTP GET: {resp.status} {resp.reason} - first {len(body)} bytes returned")
            return True
    except urllib.error.HTTPError as e:
        # Show code and brief body if available
        try:
            body_preview = e.read(200)
        except Exception:
            body_preview = b''
        print(f"  ✗ HTTP GET failed: HTTP Error {e.code}: {e.reason} - {body_preview}")
        return False
    except Exception as e:
        print(f"  ✗ HTTP GET failed: {e}")
        return False


def test_clickhouse_client(host, port, username=None, password=None, database=None, timeout=10):
    print("Testing clickhouse-client (if installed)...")

    def run_client(p):
        cmd = ['clickhouse-client', '--host', host, '--port', str(p), '--query', 'SELECT version()']
        if username:
            cmd += ['--user', username]
        if password:
            cmd += ['--password', password]
        if database:
            cmd += ['--database', database]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            return proc
        except FileNotFoundError:
            print("  ✗ clickhouse-client not found in PATH")
            return None
        except Exception as e:
            print(f"  ✗ clickhouse-client invocation error: {e}")
            return None

    # Try configured port first
    proc = run_client(port)
    if proc and proc.returncode == 0:
        out = proc.stdout.strip()
        print(f"  ✓ clickhouse-client OK: {out[:200]}")
        return True

    if port != 9000:
        print("  Trying clickhouse-client on port 9000 as a fallback...")
        proc2 = run_client(9000)
        if proc2 and proc2.returncode == 0:
            out = proc2.stdout.strip()
            print(f"  ✓ clickhouse-client OK on 9000: {out[:200]}")
            return True

    # If we get here, either clickhouse-client isn't present or both attempts failed
    if proc is None:
        return False

    err = (proc.stderr or proc.stdout or '').strip()
    print(f"  ✗ clickhouse-client failed: {err}")
    return False


def main():
    conf = load_config()
    print("Using ClickHouse config:")
    print(json.dumps(conf, indent=2, default=str))

    host = conf.get('host', '127.0.0.1')
    port = conf.get('port', 8123)
    username = conf.get('username')
    password = conf.get('password')
    database = conf.get('database')

    tcp_ok = test_tcp(host, port)
    http_ok = test_http(host, port)
    client_ok = test_clickhouse_client(host, port, username, password, database)

    ok_any = tcp_ok or http_ok or client_ok

    print('\nSummary:')
    print(f"  TCP: {'OK' if tcp_ok else 'FAIL'}")
    print(f"  HTTP: {'OK' if http_ok else 'FAIL'}")
    print(f"  clickhouse-client: {'OK' if client_ok else 'FAIL'}")

    if not ok_any:
        print('\nNo successful connection methods detected.\nSuggested next steps:')
        print('  - Confirm ClickHouse is running and listening on the configured port(s)')
        print('  - Try: curl -v "http://127.0.0.1:8123/?query=SELECT%201"')
        print('  - Try: clickhouse-client --host 127.0.0.1 --port 9000 --query "SELECT version()"')
        sys.exit(2)

    print('\nAt least one connection method succeeded.')


if __name__ == '__main__':
    main()
