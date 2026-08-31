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

# List resource groups
sub_id = "e4207dc9-2851-4d58-aaae-6400e611cafe"
url = f"https://management.azure.com/subscriptions/{sub_id}/resourcegroups?api-version=2021-04-01"
req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})

try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        print("EXISTING RESOURCE GROUPS:", json.dumps(data, indent=2), flush=True)
except urllib.error.HTTPError as e:
    print("LIST RG ERROR:", e.read().decode("utf-8"), flush=True)
