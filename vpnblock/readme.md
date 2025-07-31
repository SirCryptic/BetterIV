# GTA Connected VPN/Proxy Blocking

For GTA Connected server to block players using VPNs or proxies. The script uses multiple free, no-sign-up APIs to detect VPN and proxy connections, ensuring fair gameplay by preventing ban evasion. It is designed as a standalone resource (`vpnblock`) for GTA Connected servers, compatible with the libcurl update (post-16/08/2024).

The script checks player IPs on connection, kicks detected VPN/proxy users with a message ("You have been kicked for using a VPN. Please disable it and reconnect.").
## Features
- Blocks VPN and proxy connections using free APIs:
  - GetIPIntel.net
  - ip-api.com
  - BlackBox IPInfo
  - ProxyCheck.io
  - IP Teoh
  - ipapi.is
- Sends a kick message to players using VPNs/proxies.
- Caches results to minimize API calls and avoid rate limits.
- Standalone resource.


Update Server Configuration:
Edit server.xml to include the vpnblock resource:
`<resources>
    <resource src="vpnblock"/>
</resources>
`

3. Customize (Optional)

Threshold: Adjust the GetIPIntel.net threshold (default 0.3) for stricter/looser detection:`{ url: "http://check.getipintel.net/check.php?ip=%s&format=json&flags=m", threshold: 0.2, key: 'result' }
`


4. Test the VPN Blocking
Test with a VPN:
Connect to the server using a VPN.
Expected result: Player is kicked with the message “You have been kicked for using a VPN. Please disable it and reconnect.”

Test without VPN:
Connect with a non-VPN IP to ensure legitimate players can join.



- Troubleshooting

VPN Not Blocked:
Free APIs may miss advanced VPNs (e.g., residential IPs). Lower the GetIPIntel.net threshold (e.g., to 0.2) or add IPs to BLOCKLIST.

Check logs for API failures (e.g., HTTP 429 for rate limits).

- Rate Limits:
GetIPIntel.net: 100 checks/day.
ip-api.com: 45 requests/minute.
Others: No strict limits, but caching prevents abuse.
Increase CACHE_TIMEOUT (e.g., to 7200 * 1000) if limits are hit.



- Notes

GTA Connected Version: Ensure ≥1.0.0 for httpGet. Update to ≥1.1.23 for optimal performance.
Hosting: Tested on Linux (e.g., /home/container in Pterodactyl). Contact your hosting provider (e.g., LemeHost) if HTTP requests are restricted.
Enhancements: For advanced VPN detection, consider a paid service like IPQualityScore (requires sign-up).
