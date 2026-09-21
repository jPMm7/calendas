import urllib.request
import re
import html
import csv
import os

URL = "https://www.calendarr.com/portugal/datas-comemorativas-2026/"
OUTPUT_CSV = os.path.join(os.path.dirname(__file__), "datas_comemorativas_portugal_2026.csv")

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

html_cache = os.path.join(os.path.dirname(__file__), "page_2026.html")
if os.path.exists(html_cache):
    print("A carregar HTML do ficheiro local...")
    with open(html_cache, "r", encoding="utf-8") as f:
        page_html = f.read()
else:
    print(f"A descarregar página de: {URL}")
    req = urllib.request.Request(URL, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        page_html = resp.read().decode('utf-8')

print(f"Página carregada ({len(page_html):,} bytes). A processar dados...")

months_map = {
    'jan': (1, 'Janeiro'),
    'fev': (2, 'Fevereiro'),
    'mar': (3, 'Março'),
    'abr': (4, 'Abril'),
    'mai': (5, 'Maio'),
    'jun': (6, 'Junho'),
    'jul': (7, 'Julho'),
    'ago': (8, 'Agosto'),
    'set': (9, 'Setembro'),
    'out': (10, 'Outubro'),
    'nov': (11, 'Novembro'),
    'dez': (12, 'Dezembro')
}

weekday_map = {
    'Seg': 'Segunda-feira',
    'Ter': 'Terça-feira',
    'Qua': 'Quarta-feira',
    'Qui': 'Quinta-feira',
    'Sex': 'Sexta-feira',
    'Sáb': 'Sábado',
    'Dom': 'Domingo',
}

month_blocks = re.findall(
    r'<div class="calendar-list-holiday-box-subtitle" id="para-([a-z]+)">\s*<span>(.*?)</span>\s*</div>\s*<ul class="calendar-list-holiday-box-list"[^>]*>(.*?)</ul>',
    page_html,
    re.DOTALL
)

if not month_blocks:
    raise ValueError("Não foi possível encontrar blocos de meses no HTML!")

records = []

for m_id, m_name, ul_content in month_blocks:
    if m_id not in months_map:
        continue
    month_num, month_canonical_name = months_map[m_id]
    items = re.findall(r'<li([^>]*)>(.*?)</li>', ul_content, re.DOTALL)
    
    for attrs, content in items:
        # Categorização
        categories = []
        if 'data-holiday' in attrs:
            categories.append('Feriado Nacional')
        if 'data-optional' in attrs:
            categories.append('Feriado Facultativo')
        if 'data-curious' in attrs:
            categories.append('Dia Curioso')
        if 'data-dayof' in attrs:
            categories.append('Dia Comemorativo')
        if 'data-other' in attrs:
            categories.append('Outro')
        
        category_str = "; ".join(categories) if categories else "Outro"

        # Extrair dia e dia da semana
        dayweek_match = re.search(r'class="list-holiday-dayweek-wrapper[^"]*">\s*(\d+)\s+([^\s<]+)', content)
        if not dayweek_match:
            continue
        day_num = int(dayweek_match.group(1))
        weekday_abrev = html.unescape(dayweek_match.group(2).strip())
        weekday_full = weekday_map.get(weekday_abrev, weekday_abrev)

        # Extrair nome e URL
        link_match = re.search(r'<a[^>]*class="holiday-name"[^>]*href="([^"]*)"[^>]*>(.*?)</a>', content, re.DOTALL)
        if link_match:
            url_path = link_match.group(1)
            full_url = f"https://www.calendarr.com{url_path}" if url_path.startswith('/') else url_path
            name = html.unescape(re.sub(r'<[^>]+>', '', link_match.group(2)).strip())
        else:
            title_match = re.search(r'class="list-holiday-title"[^>]*>(.*?)</div>', content, re.DOTALL)
            if title_match:
                name = html.unescape(re.sub(r'<[^>]+>', '', title_match.group(1)).strip())
                full_url = ""
            else:
                continue

        iso_date = f"2026-{month_num:02d}-{day_num:02d}"
        formatted_date = f"{day_num:02d}/{month_num:02d}/2026"

        records.append({
            'Data': formatted_date,
            'Data_ISO': iso_date,
            'Dia': day_num,
            'Mes': month_canonical_name,
            'Mes_Numero': month_num,
            'Dia_Semana': weekday_full,
            'Dia_Semana_Abrev': weekday_abrev,
            'Nome': name,
            'Tipo': category_str,
            'URL': full_url
        })

print(f"Total de datas comemorativas extraídas: {len(records)}")

fieldnames = [
    'Data',
    'Data_ISO',
    'Dia',
    'Mes',
    'Mes_Numero',
    'Dia_Semana',
    'Dia_Semana_Abrev',
    'Nome',
    'Tipo',
    'URL'
]

# Escrever ficheiro CSV com utf-8-sig para total compatibilidade com Excel e leitores de texto
os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
with open(OUTPUT_CSV, mode='w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(records)

print(f"Ficheiro CSV gravado com sucesso em: {OUTPUT_CSV}")
