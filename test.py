import requests

# Create a session to handle ngrok interstitial page
session = requests.Session()

# Disable SSL warnings
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

ngrok_url = "https://29124516e35e.ngrok-free.app"

# Step 1: Visit the base URL to bypass ngrok interstitial
session.get(ngrok_url, verify=False)

# Step 2: Make the actual API call
resp = session.post(
    f"{ngrok_url}/compile-lean",
    json={
        "code": "#eval 1 + 1",
    },
    verify=False,
)

print(resp.json())