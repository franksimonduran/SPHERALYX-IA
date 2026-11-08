"""HTTP acotado y reintentos conservadores para servicios de IRSA."""
import logging
import math
import random
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import httpx

log = logging.getLogger(__name__)
RETRY_STATUSES = {429, 502, 503, 504}


def fetch_bytes(url, params, limit, timeout=45, attempts=3):
    start = time.monotonic()
    for index in range(attempts):
        with httpx.Client(timeout=httpx.Timeout(timeout, connect=10), follow_redirects=False) as client:
            with client.stream('GET', url, params=params) as response:
                if response.status_code in RETRY_STATUSES and index + 1 < attempts:
                    retry_after = response.headers.get('Retry-After')
                    try:
                        if not retry_after:
                            delay = .5 * 2**index + random.uniform(0, .25)
                        else:
                            try: delay = float(retry_after)
                            except ValueError: delay = (parsedate_to_datetime(retry_after) - datetime.now(timezone.utc)).total_seconds()
                    except (ValueError, TypeError, OverflowError):
                        # Cabecera desconocida: no adivinar ni insistir en el servicio.
                        response.raise_for_status()
                    # No ignorar una petición de espera larga de IRSA.
                    if not math.isfinite(delay) or delay > 10: response.raise_for_status()
                    delay = max(0, delay)
                    log.warning('IRSA HTTP %d, reintento %d en %.2fs', response.status_code, index+1, delay)
                else:
                    response.raise_for_status()
                    chunks, size = [], 0
                    for chunk in response.iter_bytes():
                        size += len(chunk)
                        if size > limit: raise ValueError('Respuesta de IRSA supera el límite de tamaño')
                        chunks.append(chunk)
                    log.info('IRSA: %d bytes en %.2fs (%d intento/s)', size, time.monotonic()-start, index+1)
                    return b''.join(chunks)
        time.sleep(delay)
    raise RuntimeError('Reintentos agotados')
