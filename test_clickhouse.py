#!/usr/bin/env python3
import clickhouse_connect

def test_clickhouse_connection():
    """Test ClickHouse connection with the provided credentials"""
    try:
        client = clickhouse_connect.get_client(
            host='localhost',
            port=8123,
            username='panda',
            password='pandapass',
            database='local'
        )
        
        # Simple test query
        result = client.query('SELECT 1 AS test')
        print("✓ ClickHouse connection successful!")
        print(f"Query result: {result.result_set}")
        
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        return False
    
    return True

if __name__ == '__main__':
    test_clickhouse_connection()
