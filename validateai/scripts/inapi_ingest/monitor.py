"""
Monitor de progreso de la ingesta INAPI.
Consulta la DB cada 10 segundos y muestra el avance.
Correr en una terminal separada mientras phase1_insert.py está activo.
"""
import time
import requests

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZGhjbnR5dnN5ZG52andvcGZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg5MTA5OCwiZXhwIjoyMDkyNDY3MDk4fQ.oNVSkLdX_DBlnwWu25RK1WTsf__W1VbVsK8xo2d8vVs'
URL = 'https://fcdhcntyvsydnvjwopfe.supabase.co/rest/v1/inapi_records'
HEADERS = {'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Prefer': 'count=exact'}

INTERVAL = 10  # segundos entre consultas

def get_count():
    try:
        resp = requests.get(URL, headers=HEADERS, params={'select': 'id', 'limit': '1'}, timeout=10)
        cr = resp.headers.get('content-range', '0/0')
        return int(cr.split('/')[-1])
    except Exception as e:
        return -1

def main():
    print('Monitoreando ingesta INAPI... (Ctrl+C para detener)\n')
    prev = 0
    start = time.time()
    t_prev = start

    while True:
        count = get_count()
        now = time.time()
        elapsed = now - start
        delta = count - prev
        rate = delta / (now - t_prev) if (now - t_prev) > 0 and delta > 0 else 0

        bar_filled = min(int(count / 5000), 40)
        bar = '█' * bar_filled + '░' * (40 - bar_filled)

        print(
            f'\r[{bar}] {count:>8,} reg  |  '
            f'+{delta:,}/10s  |  '
            f'{rate:.0f} reg/s  |  '
            f'{elapsed/60:.0f} min',
            end='', flush=True
        )

        prev = count
        t_prev = now
        time.sleep(INTERVAL)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\nMonitoreo detenido.')
