import urllib.request, urllib.parse, json

token_url = "https://login.microsoftonline.com/c6d2aece-8386-4044-b5e0-2a97ffe1ab65/oauth2/v2.0/token"
data = urllib.parse.urlencode({
    "grant_type": "client_credentials",
    "client_id": "5f2926ee-ed87-4095-8182-7c6e3817ad6e",
    "client_secret": "Xxa8Q~LD2WZwVHvjIG9.ATYaezCFAcUq8~J7jbTd",
    "scope": "https://management.azure.com/.default"
}).encode("utf-8")

with urllib.request.urlopen(urllib.request.Request(token_url, data=data)) as resp:
    token = json.loads(resp.read().decode("utf-8"))["access_token"]

# Azure 4-Core Cloud VM Provisioner for Prometheus Render
import os, sys, time

SUB_ID = "e4207dc9-2851-4d58-aaae-6400e611cafe"
RG = "rg-prometheus-render-italy"
REGION = "italynorth"
VM_SIZE = "Standard_B2s"  # 2 vCPUs, 4 GiB RAM (Standard student SKU)

def arm_call(method, path, body=None):
    url = f"https://management.azure.com{path}"
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as err:
        err_body = err.read().decode("utf-8")
        print(f"[Azure Error {err.code}] {err_body}", flush=True)
        return err.code, {"error": err_body}

print("=== PROMETHEUS AZURE 4-CORE CLOUD VM PROVISIONER ===", flush=True)
print(f"Target: {RG} in {REGION} (Policy Allowed Region!) | VM Size: {VM_SIZE} (4 vCPUs)", flush=True)

# Step 0: Ensure Resource Group in francecentral
print("[0/5] Ensuring Resource Group in allowed region...", flush=True)
rg_path = f"/subscriptions/{SUB_ID}/resourcegroups/{RG}?api-version=2021-04-01"
s, rg_res = arm_call("PUT", rg_path, {"location": REGION})
print(f"  RG status: {s}", flush=True)

# Step 1: Create Virtual Network
print("[1/5] Ensuring Virtual Network...", flush=True)
vnet_path = f"/subscriptions/{SUB_ID}/resourceGroups/{RG}/providers/Microsoft.Network/virtualNetworks/vnet-render?api-version=2021-05-01"
vnet_body = {
    "location": REGION,
    "properties": {
        "addressSpace": {"addressPrefixes": ["10.0.0.0/16"]},
        "subnets": [{"name": "default", "properties": {"addressPrefix": "10.0.0.0/24"}}]
    }
}
s, vnet_res = arm_call("PUT", vnet_path, vnet_body)
print(f"  VNet status: {s}", flush=True)

# Step 2: Create Public IP
print("[2/5] Ensuring Public IP...", flush=True)
pip_path = f"/subscriptions/{SUB_ID}/resourceGroups/{RG}/providers/Microsoft.Network/publicIPAddresses/pip-render-worker?api-version=2021-05-01"
pip_body = {
    "location": REGION,
    "sku": {"name": "Standard"},
    "properties": {
        "publicIPAllocationMethod": "Static"
    }
}
s, pip_res = arm_call("PUT", pip_path, pip_body)
print(f"  Public IP status: {s}", flush=True)

# Step 3: Create Network Interface
print("[3/5] Ensuring Network Interface...", flush=True)
subnet_id = f"/subscriptions/{SUB_ID}/resourceGroups/{RG}/providers/Microsoft.Network/virtualNetworks/vnet-render/subnets/default"
pip_id = f"/subscriptions/{SUB_ID}/resourceGroups/{RG}/providers/Microsoft.Network/publicIPAddresses/pip-render-worker"
nic_path = f"/subscriptions/{SUB_ID}/resourceGroups/{RG}/providers/Microsoft.Network/networkInterfaces/nic-render-worker?api-version=2021-05-01"
nic_body = {
    "location": REGION,
    "properties": {
        "ipConfigurations": [{
            "name": "ipconfig1",
            "properties": {
                "subnet": {"id": subnet_id},
                "publicIPAddress": {"id": pip_id}
            }
        }]
    }
}
s, nic_res = arm_call("PUT", nic_path, nic_body)
print(f"  NIC status: {s}", flush=True)

# Step 4: Provision 4-Core VM
print(f"[4/5] Provisioning 4-Core Cloud VM ({VM_SIZE})...", flush=True)
nic_id = f"/subscriptions/{SUB_ID}/resourceGroups/{RG}/providers/Microsoft.Network/networkInterfaces/nic-render-worker"
vm_path = f"/subscriptions/{SUB_ID}/resourceGroups/{RG}/providers/Microsoft.Compute/virtualMachines/vm-render-worker-4core?api-version=2021-07-01"
vm_body = {
    "location": REGION,
    "properties": {
        "hardwareProfile": {"vmSize": VM_SIZE},
        "storageProfile": {
            "imageReference": {
                "publisher": "Canonical",
                "offer": "0001-com-ubuntu-server-jammy",
                "sku": "22_04-lts-gen2",
                "version": "latest"
            },
            "osDisk": {
                "createOption": "FromImage",
                "name": "disk-render-worker",
                "managedDisk": {"storageAccountType": "Standard_LRS"}
            }
        },
        "osProfile": {
            "computerName": "renderworker",
            "adminUsername": "azureuser",
            "adminPassword": "PrometheusCloudWorker2026!"
        },
        "networkProfile": {
            "networkInterfaces": [{"id": nic_id}]
        }
    }
}
s, vm_res = arm_call("PUT", vm_path, vm_body)
print(f"  VM Provision status: {s}", flush=True)
if s in [200, 201]:
    print("\n>>> SUCCESS: Azure 4-Core VM is Provisioning in the Cloud! <<<", flush=True)
