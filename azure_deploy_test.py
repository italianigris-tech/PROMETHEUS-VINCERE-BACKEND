import os
import sys
import json
import time
import urllib.request
import urllib.parse
from pathlib import Path

TENANT_ID = os.getenv("AZURE_TENANT_ID", "c6d2aece-8386-4044-b5e0-2a97ffe1ab65")
CLIENT_ID = os.getenv("AZURE_CLIENT_ID", "5f2926ee-ed87-4095-8182-7c6e3817ad6e")
CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET", "Xxa8Q~LD2WZwVHvjIG9.ATYaezCFAcUq8~J7jbTd")
SUB_ID = os.getenv("AZURE_SUBSCRIPTION_ID", "e4207dc9-2851-4d58-aaae-6400e611cafe")
REGION = os.getenv("AZURE_REGION", "eastus")
RESOURCE_GROUP = "rg-prometheus-render"

def get_azure_token():
    print(f"[Azure] Authenticating Service Principal {CLIENT_ID} against Tenant {TENANT_ID}...", flush=True)
    token_url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    payload = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": "https://management.azure.com/.default"
    }).encode("utf-8")
    
    req = urllib.request.Request(token_url, data=payload, headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    token = data.get("access_token")
    if not token:
        raise RuntimeError(f"Failed to acquire token: {data}")
    print("[Azure] Authentication successful! Bearer token acquired.", flush=True)
    return token

def create_resource_group(token):
    print(f"[Azure] Ensuring Resource Group '{RESOURCE_GROUP}' in region '{REGION}'...", flush=True)
    rg_url = f"https://management.azure.com/subscriptions/{SUB_ID}/resourcegroups/{RESOURCE_GROUP}?api-version=2021-04-01"
    body = json.dumps({"location": REGION}).encode("utf-8")
    req = urllib.request.Request(rg_url, data=body, method="PUT", headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        rg_data = json.loads(resp.read().decode("utf-8"))
    print(f"[Azure] Resource Group '{rg_data.get('name')}' status: {rg_data.get('properties', {}).get('provisioningState', 'OK')}", flush=True)
    return rg_data

def check_azure_quotas(token):
    print(f"[Azure] Checking Compute & Container Quotas for region '{REGION}'...", flush=True)
    quota_url = f"https://management.azure.com/subscriptions/{SUB_ID}/providers/Microsoft.Compute/locations/{REGION}/usages?api-version=2021-07-01"
    req = urllib.request.Request(quota_url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            usages = json.loads(resp.read().decode("utf-8"))
        for item in usages.get("value", []):
            name = item.get("name", {}).get("value", "")
            if "cores" in name.lower() or "vcpu" in name.lower():
                print(f"  - {name}: current={item.get('currentValue')} / limit={item.get('limit')}", flush=True)
    except Exception as e:
        print(f"[Azure] Quota check note: {e}", flush=True)

def main():
    print("=== INITIALIZING PROMETHEUS AZURE CLOUD RENDER ORCHESTRATOR ===", flush=True)
    token = get_azure_token()
    rg = create_resource_group(token)
    check_azure_quotas(token)
    print("\n[Azure] Base infrastructure is ready for worker slice deployment!", flush=True)

if __name__ == "__main__":
    main()
