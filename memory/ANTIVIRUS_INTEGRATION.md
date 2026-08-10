# 🛡️ Antivirus Integratie — Stappenplan

Deze gids beschrijft hoe je de PearBlue-website koppelt aan een echte virusscanner.
De backend heeft al de schema's + endpoints (`/api/admin/virus-scanner/unread`, `/api/admin/virus-scanner/acknowledge-all`, `/api/admin/cybersecurity/virus-scans`), maar er wordt op dit moment **niets gescand** — de records zijn placeholders (`mock (bitdefender-simulator)`).

## Aanbevolen opties

| Optie | Kosten | Setup complexiteit | Waar draait het |
|-------|--------|---------------------|-----------------|
| **VirusTotal API** | Gratis 500 req/dag · Premium vanaf $499/m | Laag | Cloud (SaaS) |
| **ClamAV** | Volledig gratis · open source | Middel | Zelf hosten (server) |
| **Bitdefender GravityZone Cloud** | Enterprise vanaf ~€3/endpoint/m | Hoog | Cloud + agent |
| **Sophos Central API** | Enterprise vanaf ~€2,50/endpoint/m | Hoog | Cloud + agent |

Voor MKB is **ClamAV** of **VirusTotal** het meest praktisch. Voor bedrijven met managed IT is **Bitdefender GravityZone** geschikter.

---

## Optie 1 — ClamAV (open source, zelf hosten)

1. **Installeer ClamAV** op de backend-container of een aparte VM:
   ```bash
   sudo apt-get install clamav clamav-daemon
   sudo systemctl enable clamav-daemon
   sudo systemctl start clamav-daemon
   sudo freshclam   # download de nieuwste virusdefinities
   ```

2. **Voeg de Python-binding toe** aan `/app/backend/requirements.txt`:
   ```
   clamd==1.0.2
   ```
   en installeer: `pip install clamd`.

3. **Configureer ClamAV** om te luisteren op een TCP-socket in `/etc/clamav/clamd.conf`:
   ```
   TCPSocket 3310
   TCPAddr 127.0.0.1
   ```
   herstart: `sudo systemctl restart clamav-daemon`.

4. **Vervang de mock-scan** in `/app/backend/server.py`. Zoek `seed_virus_scans` en voeg een echte `scan_upload(file_bytes)` helper toe:
   ```python
   import clamd
   _cd = clamd.ClamdNetworkSocket(host="127.0.0.1", port=3310)

   async def scan_upload(file_bytes: bytes, filename: str, source: str, path: str) -> dict:
       result = _cd.instream(io.BytesIO(file_bytes))
       verdict = result.get("stream", ("UNKNOWN", None))
       infected = verdict[0] == "FOUND"
       doc = {
           "id": str(uuid.uuid4()),
           "filename": filename,
           "path": path,
           "size_bytes": len(file_bytes),
           "threat_name": verdict[1] if infected else None,
           "engine": "clamav",
           "severity": "high" if infected else "clean",
           "quarantined": infected,
           "detected_at": datetime.now(timezone.utc).isoformat(),
           "acknowledged": False,
           "source": source,
       }
       if infected:
           await db.virus_scans.insert_one(doc)
       return doc
   ```

5. **Roep `scan_upload()`** aan vanuit elke plek waar een gebruiker een bestand upload: portaal, chatbot-bijlages en (later) mailbox-inkomend.

6. **Test** met een EICAR-testbestand: [https://www.eicar.org/download-anti-malware-testfile/](https://www.eicar.org/download-anti-malware-testfile/).

---

## Optie 2 — VirusTotal (cloud SaaS)

1. **Vraag een gratis API-key** aan op [https://www.virustotal.com/gui/join-us](https://www.virustotal.com/gui/join-us).

2. **Voeg toe aan `/app/backend/.env`**:
   ```
   VIRUSTOTAL_API_KEY=xxxxx
   ```

3. **Voeg de client toe** aan `/app/backend/requirements.txt`:
   ```
   vt-py==0.20.1
   ```

4. **Async scan flow** — VirusTotal is async voor bestanden > 32MB, maar voor kleine files kun je hashen en direct opzoeken:
   ```python
   import vt, hashlib
   VT_KEY = os.environ["VIRUSTOTAL_API_KEY"]

   async def scan_upload(file_bytes, filename, source, path):
       h = hashlib.sha256(file_bytes).hexdigest()
       async with vt.Client(VT_KEY) as vtc:
           try:
               f = await vtc.get_object_async(f"/files/{h}")
               stats = f.last_analysis_stats
               infected = stats["malicious"] > 0 or stats["suspicious"] > 0
           except vt.error.APIError:
               # Not seen before → upload
               analysis = await vtc.scan_file_async(io.BytesIO(file_bytes), wait_for_completion=True)
               stats = analysis.stats
               infected = stats["malicious"] > 0
           # persist result exactly like the ClamAV flow
   ```

5. **Rate limit**: gratis tier is 4 requests/minuut. Voor productie kies je Premium ($499/maand voor 20.000 req/dag).

---

## Optie 3 — Bitdefender GravityZone Cloud (enterprise)

1. Neem contact op met een Bitdefender-partner en registreer een **GravityZone Cloud** account.
2. Genereer een API-key in het GravityZone control center (Settings → API Keys).
3. Voeg toe aan `.env`:
   ```
   BITDEFENDER_API_KEY=xxxxx
   BITDEFENDER_API_URL=https://gravityzone.bitdefender.com/api/v1.0/jsonrpc
   ```
4. Gebruik de HTTP API: `https://www.bitdefender.com/business/support/en/77209-135327-getting-started.html`.

---

## Wat er nu klaar staat in PearBlue

- Endpoints: `GET/POST/PATCH /api/admin/virus-scanner/*`
- Sidebar-badge met ongelezen aantal in Cybersecurity CMS
- Quarantine/restore actions
- 3 mock records worden bij startup gezaaid zodat je de UI kunt zien

## Wat er nog moet gebeuren

- `scan_upload()` helper toevoegen (kies optie 1, 2 of 3 hierboven)
- Aanroepen vanuit portal-uploads, chatbot-bijlages, mailbox-inkomend
- Real-time notificatie naar admin bij high-severity detectie (email + eventueel push)
- Automatische deletion van quarantine-bestanden na X dagen (compliance)

Vragen? Neem contact op met info@pearblue.nl.
