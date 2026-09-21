import csv
import json
import os
import re

CSV_FILE = os.path.join(os.path.dirname(__file__), "datas_comemorativas_portugal_2026.csv")
JSON_OUTPUT = os.path.join(os.path.dirname(__file__), "datas.json")

# Complementos para datas sem registo específico no ano
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

def get_category_meta(tipo, nome):
    tipo_lower = tipo.lower()
    nome_lower = nome.lower()
    
    # Defaults
    color = "#1a73e8" # Google Blue
    badge_bg = "#e8f0fe"
    badge_color = "#1967d2"
    category = "Comemorativo"
    icon = "event"

    if "feriado nacional" in tipo_lower:
        color = "#ea4335" # Google Red
        badge_bg = "#fce8e6"
        badge_color = "#c5221f"
        category = "Feriado Nacional"
        icon = "flag"
    elif "feriado facultativo" in tipo_lower:
        color = "#f9ab00" # Amber
        badge_bg = "#fef7e0"
        badge_color = "#b06000"
        category = "Feriado Facultativo"
        icon = "celebration"
    elif "curioso" in tipo_lower or "esquecer" in nome_lower or "sono" in nome_lower or "fetiche" in nome_lower or "gato" in nome_lower or "cão" in nome_lower:
        color = "#a142f4" # Purple
        badge_bg = "#f3e8fd"
        badge_color = "#8430ce"
        category = "Dia Curioso"
        icon = "psychology"
    elif "são " in nome_lower or "santa " in nome_lower or "santo " in nome_lower or "nossa senhora" in nome_lower or "senhor" in nome_lower or "epifania" in nome_lower or "religião" in nome_lower or "fé" in nome_lower:
        color = "#e37400" # Deep orange / Saints
        badge_bg = "#feefe3"
        badge_color = "#b06000"
        category = "Religioso / Santos"
        icon = "auto_awesome"
    elif "mundial" in nome_lower or "internacional" in nome_lower:
        color = "#188038" # Google Green
        badge_bg = "#e6f4ea"
        badge_color = "#137333"
        category = "Internacional"
        icon = "public"
    elif "ambiente" in nome_lower or "árvore" in nome_lower or "terra" in nome_lower or "água" in nome_lower or "animal" in nome_lower or "natureza" in nome_lower or "floresta" in nome_lower:
        color = "#137333" # Forest green
        badge_bg = "#e6f4ea"
        badge_color = "#0d652d"
        category = "Ambiente & Natureza"
        icon = "eco"
    elif "saúde" in nome_lower or "médico" in nome_lower or "doença" in nome_lower or "cancro" in nome_lower or "sangue" in nome_lower or "coração" in nome_lower or "enfermeir" in nome_lower:
        color = "#d93025" # Health red
        badge_bg = "#fce8e6"
        badge_color = "#c5221f"
        category = "Saúde"
        icon = "favorite"

    return {
        "category": category,
        "color": color,
        "badgeBg": badge_bg,
        "badgeColor": badge_color,
        "icon": icon
    }

def main():
    rows = []
    if os.path.exists(CSV_FILE):
        with open(CSV_FILE, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for r in reader:
                rows.append(r)
    
    # Adicionar complementos
    rows.extend(MISSING_COMPLEMENTS)
    
    # Ordenar por data ISO
    rows.sort(key=lambda x: (x.get('Data_ISO', ''), x.get('Nome', '')))
    
    # Agrupar por data ISO (ex: "2026-01-01") e por chave de mês-dia ("01-01")
    by_date = {}
    by_month_day = {}
    items_list = []
    
    for idx, row in enumerate(rows):
        iso_date = row['Data_ISO']
        month_day = f"{int(row['Mes_Numero']):02d}-{int(row['Dia']):02d}"
        tipo = row.get('Tipo', 'Dia Comemorativo')
        nome = row.get('Nome', '').strip()
        url = row.get('URL', '').strip()
        
        meta = get_category_meta(tipo, nome)
        
        item = {
            "id": idx + 1,
            "date": iso_date,
            "monthDay": month_day,
            "day": int(row['Dia']),
            "month": int(row['Mes_Numero']),
            "monthName": row['Mes'],
            "weekday": row['Dia_Semana'],
            "weekdayShort": row['Dia_Semana_Abrev'],
            "title": nome,
            "type": tipo,
            "category": meta["category"],
            "color": meta["color"],
            "badgeBg": meta["badgeBg"],
            "badgeColor": meta["badgeColor"],
            "icon": meta["icon"],
            "url": url,
            "isHoliday": "feriado" in tipo.lower()
        }
        
        items_list.append(item)
        
        if iso_date not in by_date:
            by_date[iso_date] = []
        by_date[iso_date].append(item)
        
        if month_day not in by_month_day:
            by_month_day[month_day] = []
        by_month_day[month_day].append(item)

    data_payload = {
        "year": 2026,
        "totalItems": len(items_list),
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
        "byMonthDay": by_month_day,
        "items": items_list
    }

    with open(JSON_OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(data_payload, f, ensure_ascii=False, indent=2)

    print(f"Sucesso! Gerado {JSON_OUTPUT} com {len(items_list)} eventos em {len(by_date)} dias.")

if __name__ == "__main__":
    main()
