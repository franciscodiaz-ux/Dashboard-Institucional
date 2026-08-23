#!/usr/bin/env python3
"""Convierte una exportación XLSX del SIGA/ESI del CFT Laplace en dos CSV anuales.

Salida:
  siga_oferta_<ANO>.csv      una fila por asignatura ofrecida en cada curso activo.
  siga_resultados_<ANO>.csv  una fila por resultado de asignatura, sin RUT ni nombre.

No requiere librerías externas: usa únicamente la biblioteca estándar de Python.
"""
import argparse, csv, re, zipfile, xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
RNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NSMAP={'a':NS,'r':RNS}

def _col(ref):
    n=0
    for ch in re.match(r'([A-Z]+)',ref).group(1): n=n*26+ord(ch)-64
    return n

def _leer_xlsx(path):
    z=zipfile.ZipFile(path)
    wb=ET.fromstring(z.read('xl/workbook.xml'))
    rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    relmap={e.attrib['Id']:e.attrib['Target'] for e in rels}
    shared=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        root=ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in root.findall('a:si',NSMAP):
            shared.append(''.join(t.text or '' for t in si.iter(f'{{{NS}}}t')))
    paths={}
    for s in wb.find('a:sheets',NSMAP):
        target=relmap[s.attrib[f'{{{RNS}}}id']]
        paths[s.attrib['name']]=('xl/'+target.lstrip('/')) if not target.startswith('xl/') else target
    def valor(c):
        typ=c.attrib.get('t'); v=c.find('a:v',NSMAP)
        if typ=='inlineStr':
            x=c.find('a:is',NSMAP)
            return ''.join(n.text or '' for n in x.iter(f'{{{NS}}}t')) if x is not None else ''
        if v is None:return ''
        s=v.text or ''
        return shared[int(s)] if typ=='s' and s else s
    def hoja(nombre):
        if nombre not in paths: raise ValueError(f'No existe la hoja requerida: {nombre}')
        root=ET.fromstring(z.read(paths[nombre])); rows=[]
        for row in root.findall('.//a:sheetData/a:row',NSMAP):
            d={}; mx=0
            for c in row.findall('a:c',NSMAP):
                i=_col(c.attrib.get('r','A1')); d[i]=valor(c); mx=max(mx,i)
            vals=[d.get(i,'') for i in range(1,mx+1)]
            if any(str(x).strip() for x in vals): rows.append(vals)
        hdr=[str(x).strip() for x in rows[0]]
        return [dict(zip(hdr,r+['']*(len(hdr)-len(r)))) for r in rows[1:]]
    return hoja

def _sem(v):
    try:return str(int(float(v)))
    except:return ''

def convertir(xlsx, outdir):
    hoja=_leer_xlsx(xlsx)
    cursos=hoja('CURSOS_ESI'); pautas=hoja('PAUTAS_ESI'); resultados=hoja('PUBLICACION_SIGA')
    cursos_por_pauta=defaultdict(list)
    for c in cursos:
        if c.get('PAUTA_ID') and str(c.get('ESTADO','')).strip().lower()=='activo': cursos_por_pauta[c['PAUTA_ID']].append(c)
    asignaturas=defaultdict(set)
    for p in pautas:
        if p.get('PAUTA_ID') and p.get('ASIGNATURA'): asignaturas[p['PAUTA_ID']].add(p['ASIGNATURA'])
    ofertas=[]
    for pauta,clist in cursos_por_pauta.items():
        for c in clist:
            for a in sorted(asignaturas.get(pauta,set())):
                ofertas.append({'ANIO':c['PERIODO'].split('-')[0],'PERIODO':c['PERIODO'],'ID_CURSO':c['ID_CURSO'],'SEDE':c['SEDE'],'CARRERA':c['CARRERA'],'SEMESTRE':_sem(c.get('SEMESTRE')),'NIVEL':c.get('NIVEL',''),'JORNADA':c.get('JORNADA',''),'ASIGNATURA':a})
    res=[]
    for r in resultados:
        if not r.get('ID_CURSO') or not r.get('ASIGNATURA'): continue
        res.append({'ANIO':r.get('PERIODO','').split('-')[0],'PERIODO':r.get('PERIODO',''),'ID_CURSO':r.get('ID_CURSO',''),'SEDE':r.get('SEDE',''),'CARRERA':r.get('CARRERA',''),'SEMESTRE':_sem(r.get('SEMESTRE')),'JORNADA':r.get('JORNADA',''),'ASIGNATURA':r.get('ASIGNATURA',''),'PROMEDIO_FINAL':r.get('PROMEDIO_FINAL',''),'SITUACION':str(r.get('SITUACION','')).strip().upper(),'TIPO_EVALUACION':r.get('TIPO_EVALUACION',''),'ESTADO_ENVIO':r.get('ESTADO_ENVIO','')})
    anos=sorted(set([r['ANIO'] for r in ofertas+res if re.fullmatch(r'20\d{2}',r['ANIO'])]))
    outdir=Path(outdir); outdir.mkdir(parents=True,exist_ok=True)
    for ano in anos:
        for nombre,campos,rows in [
            (f'siga_oferta_{ano}.csv',['ANIO','PERIODO','ID_CURSO','SEDE','CARRERA','SEMESTRE','NIVEL','JORNADA','ASIGNATURA'],[r for r in ofertas if r['ANIO']==ano]),
            (f'siga_resultados_{ano}.csv',['ANIO','PERIODO','ID_CURSO','SEDE','CARRERA','SEMESTRE','JORNADA','ASIGNATURA','PROMEDIO_FINAL','SITUACION','TIPO_EVALUACION','ESTADO_ENVIO'],[r for r in res if r['ANIO']==ano])]:
            with open(outdir/nombre,'w',encoding='utf-8-sig',newline='') as f:
                w=csv.DictWriter(f,fieldnames=campos,delimiter=';'); w.writeheader(); w.writerows(rows)
            print(f'{nombre}: {len(rows)} registros')

if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('xlsx'); ap.add_argument('-o','--outdir',default='.'); args=ap.parse_args(); convertir(args.xlsx,args.outdir)
