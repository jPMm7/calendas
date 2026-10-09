import os
import csv
import json
import glob
import re
import unicodedata
import urllib.parse
from datetime import date

CACHE_DIR = os.path.join(os.path.dirname(__file__), "wikipedia_holidays_cache")
CSV_FILE = os.path.join(os.path.dirname(__file__), "datas_comemorativas_portugal_2026.csv")
JSON_OUTPUT = os.path.join(os.path.dirname(__file__), "datas.json")
JS_OUTPUT = os.path.join(os.path.dirname(__file__), "data.js")

MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

WEEKDAY_FULL = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']
WEEKDAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

MISSING_COMPLEMENTS = [
    {
        "Data": "03/10/2026",
        "Data_ISO": "2026-10-03",
        "Dia": 3,
        "Mes": "Outubro",
        "Mes_Numero": 10,
        "Dia_Semana": "Sábado",
        "Dia_Semana_Abrev": "Sáb",
        "Nome": "Dia do Namorado (Nacional / Tradição)",
        "Tipo": "Dia Comemorativo",
        "URL": ""
    },
    {
        "Data": "30/12/2026",
        "Data_ISO": "2026-12-30",
        "Dia": 30,
        "Mes": "Dezembro",
        "Mes_Numero": 12,
        "Dia_Semana": "Quarta-feira",
        "Dia_Semana_Abrev": "Qua",
        "Nome": "Dia da Sagrada Família (Festividade de Fim de Ano)",
        "Tipo": "Dia Comemorativo",
        "URL": ""
    }
]

def get_category_meta(tipo, nome, page_desc=""):
    tipo_lower = (tipo or "").lower()
    nome_lower = (nome or "").lower()
    desc_lower = (page_desc or "").lower()
    combo = f"{tipo_lower} {nome_lower} {desc_lower}"

    # Defaults
    color = "#1a73e8" # Blue
    badge_bg = "#e8f0fe"
    badge_color = "#1967d2"
    category = "Comemorativo"
    icon = "event"

    if "feriado nacional" in combo or "proclamação da república" in combo or "dia de portugal" in combo:
        color = "#ea4335" # Red
        badge_bg = "#fce8e6"
        badge_color = "#c5221f"
        category = "Feriado Nacional"
        icon = "flag"
    elif "feriado facultativo" in combo:
        color = "#f9ab00" # Amber
        badge_bg = "#fef7e0"
        badge_color = "#b06000"
        category = "Feriado Facultativo"
        icon = "celebration"
    elif any(k in combo for k in [
        "saúde", "médico", "médicos", "médica", "hospital", "sanitarista", "doença", "cancro",
        "câncer", "sangue", "coração", "enfermeir", "vacina", "farmacêutic", "autismo", "alzheimer",
        "depressão", "obesidade", "diabetes", "sida", "aids", "psicologia", "visão", "cegueira", "leucemia"
    ]):
        color = "#d93025"
        badge_bg = "#fce8e6"
        badge_color = "#c5221f"
        category = "Saúde"
        icon = "favorite"
    elif any(k in combo for k in [
        "ambiente", "árvore", "terra", "água", "animal", "animais", "natureza", "floresta",
        "oceano", "planeta", "ecologia", "fauna", "flora", "biodiversidade", "reciclagem", "clima",
        "selva", "mar", "aves", "pássaros", "tartaruga", "baleia", "leopardo", "abelha"
    ]):
        color = "#137333" # Forest green
        badge_bg = "#e6f4ea"
        badge_color = "#0d652d"
        category = "Ambiente & Natureza"
        icon = "eco"
    elif any(k in combo for k in [
        "são ", "santa ", "santo ", "nossa senhora", "senhor", "epifania", "religião", "fé",
        "cristã", "papa ", "bispo ", "cardeal ", "mártir", "beato", "apóstolo", "igreja",
        "bíblia", "padroeir", "evangelista", "deusa", "deus ", "santoral", "orixá"
    ]):
        color = "#e37400" # Orange / Saints
        badge_bg = "#feefe3"
        badge_color = "#b06000"
        category = "Religioso / Santos"
        icon = "auto_awesome"
    elif any(k in combo for k in [
        "curioso", "esquecer", "sono", "fetiche", "gato", "cão", "sorriso", "abraço",
        "piada", "cinema", "jogo", "pizza", "toalha", "nerd", "mágico", "fettuccine",
        "croissant", "ovni", "star wars", "geek", "solteiro", "beijo", "introvertido",
        "puzzle", "queijo", "marmota", "nutella", "batata", "cerveja", "chocolate", "lego"
    ]):
        color = "#a142f4" # Purple
        badge_bg = "#f3e8fd"
        badge_color = "#8430ce"
        category = "Dia Curioso"
        icon = "psychology"
    elif any(k in combo for k in [
        "mundial", "internacional", "global", "povos", "humanidade", "direitos humanos",
        "onu", "unesco", "solidariedade", "fraternidade universal", "paz"
    ]):
        color = "#188038" # Green
        badge_bg = "#e6f4ea"
        badge_color = "#137333"
        category = "Internacional"
        icon = "public"

    return {
        "category": category,
        "color": color,
        "badgeBg": badge_bg,
        "badgeColor": badge_color,
        "icon": icon
    }

def normalize_for_comparison(text):
    if not text:
        return ""
    text = text.lower().strip()
    # Remove contents in parentheses
    text = re.sub(r'\(.*?\)', '', text)
    # Remove trailing country or subtitle notes after dash
    text = re.sub(r'\s*[-–—]\s*(comemoração|portugal|brasil|coreia|austrália|itália|suazilândia|áustria|estados unidos|espanha|alemanha|frança|reino unido|japão|china|rússia|canadá).*$', '', text, flags=re.IGNORECASE)
    # Strip accents
    text = unicodedata.normalize('NFKD', text)
    text = ''.join(c for c in text if not unicodedata.combining(c))
    
    # Common PT-PT / PT-BR variations & singular/plural
    synonyms = [
        (r'\bcancro\b', 'cancer'),
        (r'\bmeio ambiente\b', 'ambiente'),
        (r'\bano-novo\b', 'ano novo'),
        (r'\bmulheres\b', 'mulher'),
        (r'\bcriancas\b', 'crianca'),
        (r'\bpais\b', 'pai'),
        (r'\bmaes\b', 'mae'),
        (r'\bnamorados\b', 'namorado'),
        (r'\banimais\b', 'animal'),
        (r'\bprofessores\b', 'professor'),
        (r'\bestudantes\b', 'estudante'),
        (r'\bmedicos\b', 'medico'),
        (r'\bidosos\b', 'idoso'),
        (r'\blivros\b', 'livro'),
        (r'\bflorestas\b', 'floresta'),
        (r'\bdoencas\b', 'doenca'),
        (r'\badn\b', 'dna'),
        (r'\bvoluntarios\b', 'voluntario'),
        (r'\bjovens\b', 'jovem'),
        (r'\brefugiados\b', 'refugiado'),
        (r'\btrabalhadores\b', 'trabalhador'),
    ]
    for pattern, repl in synonyms:
        text = re.sub(pattern, repl, text)
        
    # Remove punctuation
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def extract_core_topic(norm_text):
    prefixes = [
        r'^dia mundial (?:da|de|do|das|dos|para|contra|sobre|em defesa)?\s+',
        r'^dia internacional (?:da|de|do|das|dos|para|contra|sobre|em defesa)?\s+',
        r'^dia nacional (?:da|de|do|das|dos|para|contra|sobre|em defesa)?\s+',
        r'^dia europeu (?:da|de|do|das|dos|para|contra|sobre|em defesa)?\s+',
        r'^dia (?:da|de|do|das|dos)?\s+',
        r'^festa (?:da|de|do|das|dos)?\s+',
        r'^solenidade (?:da|de|do|das|dos)?\s+',
        r'^memoria (?:da|de|do|das|dos)?\s+',
        r'^(?:sao|santa|santo)\s+'
    ]
    core = norm_text
    changed = True
    while changed:
        changed = False
        for p in prefixes:
            new_core = re.sub(p, '', core).strip()
            if new_core != core and len(new_core) > 2:
                core = new_core
                changed = True
    return core

def check_duplicate(existing_items_on_day, candidate_title):
    cand_norm = normalize_for_comparison(candidate_title)
    cand_core = extract_core_topic(cand_norm)
    cand_core_tokens = set(cand_core.split())

    for ext_item in existing_items_on_day:
        ext_title = ext_item['title']
        ext_norm = normalize_for_comparison(ext_title)
        ext_core = extract_core_topic(ext_norm)
        ext_core_tokens = set(ext_core.split())
        
        # 1. Exact normalized match
        if cand_norm == ext_norm:
            return True, ext_item
        
        # 2. Exact core topic match
        if cand_core and ext_core and cand_core == ext_core:
            return True, ext_item
        
        # 3. Inclusion check
        if len(cand_norm) >= 6 and (cand_norm in ext_norm or ext_norm in cand_norm):
            return True, ext_item
            
        if len(cand_core) >= 5 and (cand_core in ext_core or ext_core in cand_core):
            return True, ext_item

        # 4. Token overlap
        if len(cand_core_tokens) >= 2 and len(ext_core_tokens) >= 2:
            intersection = cand_core_tokens.intersection(ext_core_tokens)
            smaller = min(len(cand_core_tokens), len(ext_core_tokens))
            if len(intersection) / smaller >= 0.75:
                return True, ext_item

    return False, None

def clean_wiki_title(raw_text):
    text = raw_text.strip()
    # Remove leading bullets or numbers
    text = re.sub(r'^[*\-•\d\.\s]+', '', text).strip()
    # Remove trailing periods
    text = re.sub(r'\.+$', '', text).strip()
    
    # Clean redundant explanations in parentheses if too long
    # e.g., "Dia de Ano-novo (nos países que adotam o calendário gregoriano)" -> "Dia de Ano-Novo"
    text = re.sub(r'\s*\(nos países que adotam o calendário gregoriano\)', '', text, flags=re.IGNORECASE)
    
    # Capitalize first letter cleanly
    if text:
        text = text[0].upper() + text[1:]
    return text

def build_database():
    print("=== A INICIAR CONSTRUÇÃO DA BASE DE DADOS UNIFICADA ===")
    
    # 1. Carregar dados existentes do Calendarr
    base_rows = []
    if os.path.exists(CSV_FILE):
        with open(CSV_FILE, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for r in reader:
                base_rows.append(r)
    base_rows.extend(MISSING_COMPLEMENTS)
    
    print(f"Carregados {len(base_rows)} registos base do Calendarr.")
    
    # Agrupar itens existentes por MM-DD
    items_by_month_day = {}
    total_existing = 0
    
    for row in base_rows:
        dia = int(row['Dia'])
        mes = int(row['Mes_Numero'])
        month_day = f"{mes:02d}-{dia:02d}"
        iso_date = row.get('Data_ISO', f"2026-{mes:02d}-{dia:02d}")
        
        tipo = row.get('Tipo', 'Dia Comemorativo')
        nome = row.get('Nome', '').strip()
        url = row.get('URL', '').strip()
        
        meta = get_category_meta(tipo, nome)
        
        item = {
            "date": iso_date,
            "monthDay": month_day,
            "day": dia,
            "month": mes,
            "monthName": row.get('Mes', MONTH_NAMES[mes - 1]),
            "weekday": row.get('Dia_Semana', ''),
            "weekdayShort": row.get('Dia_Semana_Abrev', ''),
            "title": nome,
            "type": tipo,
            "category": meta["category"],
            "color": meta["color"],
            "badgeBg": meta["badgeBg"],
            "badgeColor": meta["badgeColor"],
            "icon": meta["icon"],
            "url": url,
            "isHoliday": "feriado" in tipo.lower(),
            "source": "calendarr"
        }
        
        if month_day not in items_by_month_day:
            items_by_month_day[month_day] = []
        items_by_month_day[month_day].append(item)
        total_existing += 1
        
    print(f"Itens base organizados em {len(items_by_month_day)} dias.")
    
    # 2. Processar cache da Wikipédia
    wiki_files = sorted(glob.glob(os.path.join(CACHE_DIR, "*.json")))
    print(f"A processar {len(wiki_files)} ficheiros da Wikipédia...")
    
    wiki_added = 0
    wiki_duplicates = 0
    wiki_skipped = 0
    urls_enriched = 0
    
    for fpath in wiki_files:
        fname = os.path.basename(fpath).replace('.json', '')
        # Formato esperado: MM-DD
        if not re.match(r'^\d{2}-\d{2}$', fname):
            continue
            
        month_day = fname
        mes, dia = map(int, month_day.split('-'))
        
        # Ignorar 29 de fevereiro se 2026 não for bissexto, ou mapear para 28
        if mes == 2 and dia == 29:
            dia = 28
            month_day = "02-28"
            
        d_obj = date(2026, mes, dia)
        weekday_idx = d_obj.weekday()
        weekday_str = WEEKDAY_FULL[weekday_idx]
        weekday_short_str = WEEKDAY_SHORT[weekday_idx]
        iso_date = f"2026-{mes:02d}-{dia:02d}"
        
        if month_day not in items_by_month_day:
            items_by_month_day[month_day] = []
            
        with open(fpath, 'r', encoding='utf-8') as fp:
            wdata = json.load(fp)
            
        for h in wdata.get('holidays', []):
            raw_text = h.get('text', '').strip()
            if not raw_text:
                continue
                
            lower = raw_text.lower()
            # Filtrar não-comemorações
            if (lower.startswith('aniversário dos municípios') or 
                lower.startswith('aniversário do município') or
                lower.startswith('aniversario dos municípios') or
                lower.startswith('aniversario do município')):
                wiki_skipped += 1
                continue
            if 'toma posse o presidente' in lower or 'dia da posse dos cargos eletivos' in lower:
                wiki_skipped += 1
                continue
            if 'criação dos estados brasileiros' in lower or 'fim da noite polar' in lower:
                wiki_skipped += 1
                continue
            if len(raw_text) > 130 and not lower.startswith('dia'):
                wiki_skipped += 1
                continue
                
            title = clean_wiki_title(raw_text)
            
            # Extrair página e URL da Wikipédia
            pages = h.get('pages', [])
            primary_page = pages[0] if pages else {}
            wiki_url = primary_page.get('content_urls', {}).get('desktop', {}).get('page', '')
            page_desc = primary_page.get('description', '')
            
            # Se não houver url direta, criar link de pesquisa direta na Wikipédia
            if not wiki_url:
                encoded_search = urllib.parse.quote(title) if 'urllib' in globals() else title.replace(' ', '_')
                wiki_url = f"https://pt.wikipedia.org/wiki/Especial:Pesquisa?search={encoded_search}"
                
            # Verificar duplicação inteligente com os itens existentes deste dia
            is_dup, matched_item = check_duplicate(items_by_month_day[month_day], title)
            
            if is_dup:
                wiki_duplicates += 1
                # Se o item existente não tinha link, enriquecer com o link explicativo da Wikipédia!
                if matched_item and not matched_item.get('url') and wiki_url:
                    matched_item['url'] = wiki_url
                    urls_enriched += 1
            else:
                # É um novo dia comemorativo excelente e inédito!
                tipo = "Dia Comemorativo"
                if "feriado" in lower:
                    tipo = "Feriado"
                
                meta = get_category_meta(tipo, title, page_desc)
                
                new_item = {
                    "date": iso_date,
                    "monthDay": month_day,
                    "day": dia,
                    "month": mes,
                    "monthName": MONTH_NAMES[mes - 1],
                    "weekday": weekday_str,
                    "weekdayShort": weekday_short_str,
                    "title": title,
                    "type": tipo,
                    "category": meta["category"],
                    "color": meta["color"],
                    "badgeBg": meta["badgeBg"],
                    "badgeColor": meta["badgeColor"],
                    "icon": meta["icon"],
                    "url": wiki_url,
                    "isHoliday": "feriado" in tipo.lower() or meta["category"] == "Feriado Nacional",
                    "source": "wikipedia"
                }
                
                items_by_month_day[month_day].append(new_item)
                wiki_added += 1

    print("\n--- ESTATÍSTICAS DE INTEGRAÇÃO ---")
    print(f"Itens originais Calendarr: {total_existing}")
    print(f"Duplicados identificados e prevenidos: {wiki_duplicates}")
    print(f"Links de itens originais enriquecidos com Wikipédia: {urls_enriched}")
    print(f"Itens irrelevantes/municipais ignorados: {wiki_skipped}")
    print(f"NOVOS dias comemorativos da Wikipédia adicionados: {wiki_added}")
    
    # 3. Consolidar e ordenar
    all_items = []
    by_date = {}
    by_month_day_final = {}
    
    # Percorrer todos os 365 dias em ordem cronológica
    current_id = 1
    for m in range(1, 13):
        # Determinar dias no mês em 2026
        max_d = 28 if m == 2 else (30 if m in [4, 6, 9, 11] else 31)
        for d in range(1, max_d + 1):
            m_d = f"{m:02d}-{d:02d}"
            iso_d = f"2026-{m:02d}-{d:02d}"
            
            day_items = items_by_month_day.get(m_d, [])
            
            # Ordenar itens do dia: Feriados primeiro, depois Comemorativos/Internacionais, etc.
            def sort_key(it):
                pri = 1
                if it.get('isHoliday'): pri = 0
                elif it.get('category') == 'Internacional': pri = 2
                return (pri, it.get('title', ''))
                
            day_items.sort(key=sort_key)
            
            for it in day_items:
                it['id'] = current_id
                current_id += 1
                all_items.append(it)
                
            by_date[iso_d] = day_items
            by_month_day_final[m_d] = day_items

    print(f"Total final de comemorações integradas: {len(all_items)} (distribuídas por {len(by_date)} dias)")

    data_payload = {
        "year": 2026,
        "totalItems": len(all_items),
        "totalDaysWithItems": len(by_date),
        "categories": [
            "Todas",
            "Feriado Nacional",
            "Internacional",
            "Comemorativo",
            "Dia Curioso",
            "Saúde",
            "Ambiente & Natureza",
            "Religioso / Santos"
        ],
        "byDate": by_date,
        "byMonthDay": by_month_day_final,
        "items": all_items
    }

    # Gravar datas.json
    with open(JSON_OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(data_payload, f, ensure_ascii=False, indent=2)
    print(f"Gravado com sucesso: {JSON_OUTPUT}")

    # Gravar data.js (compacto com window.CALENDAR_DATA)
    with open(JS_OUTPUT, 'w', encoding='utf-8') as f:
        f.write("window.CALENDAR_DATA = ")
        json.dump(data_payload, f, ensure_ascii=False)
        f.write(";\n")
    print(f"Gravado com sucesso: {JS_OUTPUT}")
    print("=== PROCESSO CONCLUÍDO COM SUCESSO! ===")

if __name__ == '__main__':
    build_database()
