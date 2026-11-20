# Long-running helper for server/tts-edge.js: reads one JSON request per line on stdin, writes one JSON reply per line on stdout.
# Keeps Python warm so a request costs only the network round trip (no interpreter start). Uses the `edge-tts` package (pip install edge-tts==7.3.1).
import sys, json, base64, asyncio, threading

IMPORT_ERR = ""
try:
    import edge_tts
except Exception as e:  # reported to the parent on the first request
    edge_tts = None
    IMPORT_ERR = str(e)

out_lock = threading.Lock()


def reply(obj):
    with out_lock:
        sys.stdout.write(json.dumps(obj) + "\n")
        sys.stdout.flush()


async def handle(req):
    rid = req.get("id")
    if edge_tts is None:
        return reply({"id": rid, "ok": False, "error": "edge-tts belum terpasang: " + IMPORT_ERR})
    try:
        c = edge_tts.Communicate(req["text"], req["voice"], rate=req["rate"], pitch=req["pitch"], volume=req.get("volume", "+0%"))
        buf = bytearray()
        async for ch in c.stream():
            if ch["type"] == "audio":
                buf += ch["data"]
        if not buf:
            return reply({"id": rid, "ok": False, "error": "tidak ada audio"})
        reply({"id": rid, "ok": True, "audio": base64.b64encode(bytes(buf)).decode("ascii")})
    except Exception as e:
        reply({"id": rid, "ok": False, "error": str(e)[:200]})


async def main():
    loop = asyncio.get_running_loop()
    reply({"ready": True, "edge_tts": edge_tts is not None})
    while True:
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if not line:
            break
        try:
            req = json.loads(line)
        except Exception:
            continue
        asyncio.create_task(handle(req))
    await asyncio.sleep(0.2)


asyncio.run(main())
