import urllib.request
import urllib.error
import json
import os
import time

CACHE_DIR = os.path.join(os.path.dirname(__file__), "wikipedia_holidays_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

HEADERS = {
    'User-Agent': 'CalendarioDatasComemorativasBot/1.0 (https://github.com/jpmar/calendas; contato@calendas.local)'
}

# Days in each month for 2026 (non-leap year, but we can also include Feb 29 if exists)
MONTH_DAYS = [
    (1, 31),
    (2, 29), # include 29 so we have full coverage
    (3, 31),
    (4, 30),
    (5, 31),
    (6, 30),
    (7, 31),
    (8, 31),
    (9, 30),
    (10, 31),
    (11, 30),
    (12, 31)
]

def main():
    total_dates = sum(days for _, days in MONTH_DAYS)
    processed = 0
    downloaded = 0
    
    print(f"A iniciar verificação/descarregamento de {total_dates} datas da Wikipédia...")
    
    for month, days in MONTH_DAYS:
        for day in range(1, days + 1):
            processed += 1
            cache_file = os.path.join(CACHE_DIR, f"{month:02d}-{day:02d}.json")
            
            if os.path.exists(cache_file) and os.path.getsize(cache_file) > 10:
                continue
            
            url = f"https://pt.wikipedia.org/api/rest_v1/feed/onthisday/holidays/{month:02d}/{day:02d}"
            success = False
            attempts = 0
            
            while not success and attempts < 5:
                attempts += 1
                try:
                    req = urllib.request.Request(url, headers=HEADERS)
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        content = resp.read().decode('utf-8')
                        data = json.loads(content)
                        with open(cache_file, 'w', encoding='utf-8') as f:
                            json.dump(data, f, ensure_ascii=False, indent=2)
                    success = True
                    downloaded += 1
                    time.sleep(0.18) # Polite pause
                except urllib.error.HTTPError as e:
                    if e.code == 429:
                        wait = attempts * 3
                        print(f"Rate limited em {month:02d}/{day:02d}, a aguardar {wait}s...")
                        time.sleep(wait)
                    elif e.code == 404:
                        print(f"404 para {month:02d}/{day:02d}, guardando lista vazia")
                        with open(cache_file, 'w', encoding='utf-8') as f:
                            json.dump({"holidays": []}, f)
                        success = True
                    else:
                        print(f"Erro HTTP {e.code} em {month:02d}/{day:02d}: {e}")
                        time.sleep(2)
                except Exception as e:
                    print(f"Erro de conexão em {month:02d}/{day:02d}: {e}")
                    time.sleep(2)
            
            if processed % 30 == 0 or downloaded % 30 == 0:
                print(f"Progresso: {processed}/{total_dates} (descarregados nesta sessão: {downloaded})")

    print(f"Concluído! Todas as datas guardadas em {CACHE_DIR}.")

if __name__ == "__main__":
    main()
