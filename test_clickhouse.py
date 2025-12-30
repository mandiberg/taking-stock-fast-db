#!/usr/bin/env python3
import subprocess
import sys

def test_clickhouse_connection():
    """Test ClickHouse connection using the native client program"""
    try:
        result = subprocess.run(
            [
                'clickhouse-client',
                '--host', 'localhost',
                '--port', '9000',
                '--user', 'panda',
                '--password', 'pandapass',
                '--database', 'local',
                '--query', 'SELECT 1 AS test'
            ],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            print("✓ ClickHouse connection successful!")
            print(f"Query result: {result.stdout.strip()}")
            return True
        else:
            print(f"✗ Connection failed: {result.stderr}")
            return False
        
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        return False

if __name__ == '__main__':
    test_clickhouse_connection()
