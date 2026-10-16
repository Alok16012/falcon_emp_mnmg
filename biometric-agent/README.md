# Falcon Biometric Agent

Runs the Dahua auto-registration server on the **site Windows PC** (192.168.0.111)
instead of Railway. The Dahua machine (192.168.0.107) connects to it over the LAN;
punches go straight into the production database, so the ERP shows them as before.

## One-time setup (on the site PC)

The zip is self-contained: portable Node, Prisma engine and the filled `.env` are inside.

1. Right-click `falcon-biometric-agent.zip`, choose **Extract All**, then open the folder.
2. Double-click **`SETUP.bat`**. When Windows asks for admin rights, click **Yes**.
   It copies everything to `C:\falcon-biometric-agent`, opens firewall port 8099,
   turns off sleep, and adds an auto-start task (`FalconBiometric`) that runs
   on every boot. At the end it checks that the agent is up.

**The zip contains the database password. Do not share it.**

## Point the Dahua machine at the PC

Machine web UI (http://192.168.0.107, admin/admin123), then **CGI Auto Registration**:

- Server address: `192.168.0.111`
- Port: `8099`
- Device ID: `FALCON-GATE-1`

The PC's IP must not change. Give it a static IP (or a DHCP reservation on the router).

## Day-to-day

- **Status:** http://localhost:8098/
- **Logs:** `C:\falcon-biometric-agent\logs\agent.log`
- **Missed punches** (after the PC was off, e.g. every night): every time the machine
  connects, the agent re-pulls everything since the newest punch already in the ERP
  (up to 31 days) by itself. For a longer gap, open
  `http://localhost:8098/backfill?from=YYYY-MM-DD&to=YYYY-MM-DD`
- **Remove:** double-click `C:\falcon-biometric-agent\uninstall.bat`.

## Update

On the Mac: put the production env in `biometric-agent/.env.agent` (gitignored),
run `bash biometric-agent/build.sh`, and copy the new zip to the PC. There, extract it
and double-click `SETUP.bat` again.
