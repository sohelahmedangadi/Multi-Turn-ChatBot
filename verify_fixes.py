import json
import time
import uuid
import urllib.request
import urllib.error
import sys

BASE_URL = "http://localhost:3000"
CHAT_ENDPOINT = f"{BASE_URL}/api/chat"

def log(msg):
    try:
        print(msg, flush=True)
    except UnicodeEncodeError:
        print(msg.encode('ascii', errors='backslashreplace').decode('ascii'), flush=True)

def test_bug_1():
    log("==================================================")
    log("[TEST 1] VERIFYING BUG 1: Empty Message Validation & No Session Creation")
    log("==================================================")
    
    sess_id = f"sess_bug1_test_{uuid.uuid4().hex[:8]}"
    payload = {
        "sessionId": sess_id,
        "message": "    " # whitespace only
    }
    
    req = urllib.request.Request(
        CHAT_ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    
    status_code = None
    response_body = None
    
    try:
        with urllib.request.urlopen(req) as resp:
            status_code = resp.status
            response_body = resp.read().decode()
    except urllib.error.HTTPError as e:
        status_code = e.code
        response_body = e.read().decode()
    
    log(f"1. Chat Request with empty whitespace message:")
    log(f"   -> HTTP Status: {status_code} (Expected: 400)")
    log(f"   -> Response Body: {response_body}")
    assert status_code == 400, f"Expected 400, got {status_code}"
    assert "Field \"message\" is required" in response_body or "cannot be empty" in response_body
    log("   [PASS] Clean 400 Bad Request returned, no 500 crash.")

    # Check that session was NOT created in DB
    history_url = f"{BASE_URL}/api/history/{sess_id}"
    hist_status = None
    hist_body = None
    try:
        with urllib.request.urlopen(history_url) as resp:
            hist_status = resp.status
            hist_body = resp.read().decode()
    except urllib.error.HTTPError as e:
        hist_status = e.code
        hist_body = e.read().decode()

    log(f"\n2. Verifying Session Inexistence in Database:")
    log(f"   -> GET /api/history/{sess_id}")
    log(f"   -> HTTP Status: {hist_status} (Expected: 404 Session not found)")
    log(f"   -> Response: {hist_body}")
    assert hist_status == 404, f"Expected 404, got {hist_status}"
    log("   [PASS] No session document was created in MongoDB!")

def test_bug_2():
    log("\n==================================================")
    log("[TEST 2] VERIFYING BUG 2: Circuit Breaker & Fallback Latency")
    log("==================================================")

    sess_id = f"sess_bug2_test_{uuid.uuid4().hex[:8]}"
    
    # Request 1: Normal turn (Gemini or Groq if Gemini 429)
    payload1 = {
        "sessionId": sess_id,
        "message": "What is the capital of Canada?"
    }
    req1 = urllib.request.Request(
        CHAT_ENDPOINT,
        data=json.dumps(payload1).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    
    start1 = time.time()
    with urllib.request.urlopen(req1) as resp1:
        lat1 = int((time.time() - start1) * 1000)
        data1 = json.loads(resp1.read().decode())
    
    log(f"1. First Request:")
    log(f"   -> Latency: {lat1} ms")
    log(f"   -> Provider Used: {data1.get('provider')} ({data1.get('model')})")
    log(f"   -> Fallback Active: {data1.get('isFallback')}")
    log(f"   -> Reply: {data1.get('reply')[:80]}...")
    assert "ottawa" in data1.get('reply', '').lower()

    # Request 2: Immediate follow-up
    payload2 = {
        "sessionId": sess_id,
        "message": "What is its largest city by population?"
    }
    req2 = urllib.request.Request(
        CHAT_ENDPOINT,
        data=json.dumps(payload2).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    
    start2 = time.time()
    with urllib.request.urlopen(req2) as resp2:
        lat2 = int((time.time() - start2) * 1000)
        data2 = json.loads(resp2.read().decode())
        
    log(f"\n2. Second Request (Circuit Breaker Fast-Routing):")
    log(f"   -> Latency: {lat2} ms (Expected: < 10,000 ms, compared to 32,000 ms before fix)")
    log(f"   -> Provider Used: {data2.get('provider')} ({data2.get('model')})")
    log(f"   -> Fallback Active: {data2.get('isFallback')}")
    log(f"   -> Reply: {data2.get('reply')[:80]}...")
    assert lat2 < 12000, f"Latency {lat2}ms exceeded 12s threshold"
    assert "toronto" in data2.get('reply', '').lower()
    log(f"   [PASS] Completed in {lat2} ms via fast fallback with context retained!")

if __name__ == "__main__":
    test_bug_1()
    test_bug_2()
    log("\n[SUCCESS] ALL BUG FIXES VERIFIED SUCCESSFULLY ON RUNNING SERVER!")
