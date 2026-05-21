import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType, Header, Footer,
  PageNumber, ImageRun, PageBreak, PageOrientation, TableLayoutType
} from 'docx';
import { saveAs } from 'file-saver';

const API_URL = 'https://buildphotoapp.ru/backend/api.php';

const STATUS_LABELS = {
  pending:   { label: 'В работе',    color: '#d97706' },
  review:    { label: 'На проверке', color: '#2563eb' },
  completed: { label: 'Выполнено',   color: '#16a34a' },
  rejected:  { label: 'Отклонено',   color: '#dc2626' },
};
const STATUS_RU = {
  pending: 'В работе', review: 'На проверке', completed: 'Выполнено', rejected: 'Отклонено',
};

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' }) + 'г.';
}
function statusColorHex(s) {
  return { pending:'B45309', review:'1D4ED8', completed:'15803D', rejected:'B91C1C' }[s] || '374151';
}

// ── Константы страницы ────────────────────────────────────────
// Альбомная A4: docx-js принимает PORTRAIT-размеры + orientation.LANDSCAPE
// Физически: широкая сторона 16838, короткая 11906
const PW     = 16838; // long edge (ширина в альбомной)
const PH     = 11906; // short edge
const MARGIN = 567; // ~1cm поля
const CW     = PW - MARGIN * 2; // 15704 — ширина контента

const OUTER = { style: BorderStyle.SINGLE,  size: 4,  color: '000000' }; // внешняя рамка
const INNER = { style: BorderStyle.DOTTED,  size: 2,  color: '000000' }; // внутренние разделители
const NONE  = { style: BorderStyle.NONE,    size: 0,  color: 'FFFFFF' }; // нет рамки

const PROXY_URL = 'https://buildphotoapp.ru/backend/proxy.php?file=';

function toProxyUrl(url) {
  // Извлекаем имя файла из URL и подставляем через прокси
  const filename = url.split('/').pop().split('?')[0];
  return PROXY_URL + encodeURIComponent(filename);
}

async function fetchImg(url) {
  const proxyUrl = toProxyUrl(url);
  const cleanUrl = url.toLowerCase().split('?')[0];
  const type = cleanUrl.endsWith('.png') ? 'png' : 'jpg';

  // Через прокси — CORS гарантирован
  try {
    const r = await fetch(proxyUrl);
    if (r.ok) {
      const buf = await r.arrayBuffer();
      if (buf.byteLength > 0) return { data: new Uint8Array(buf), type };
    }
  } catch (_) {}

  // Fallback: прямой fetch
  try {
    const r = await fetch(url);
    if (r.ok) {
      const buf = await r.arrayBuffer();
      if (buf.byteLength > 0) return { data: new Uint8Array(buf), type };
    }
  } catch (_) {}

  return null;
}

// Одна страница карточки = одна таблица как в образце
const PHOTOS_PER_PAGE = 12; // 4 ряда × 3 фото
const ROWS_PER_PAGE   = 4;

function makePage(task, photos12, bufs12, headerInfo) {
  const colW = Math.floor(CW / 3);
  const rem  = CW - colW * 2;

  // Размеры в twips (для таблицы) → пиксели (для ImageRun, 96dpi: 1px = 15 twips)
  const TWP_TO_PX = 15;
  const cellWpx  = Math.floor((colW - 20) / TWP_TO_PX);   // ширина ячейки в px, отступ 20 twips
  const pageHpx  = Math.floor((PH - MARGIN * 2) / TWP_TO_PX);
  const reservedPx = 60; // шапка + строка задачи в px
  const cellHpx  = Math.floor((pageHpx - reservedPx) / ROWS_PER_PAGE) - 4;

  // Вписываем фото в ячейку сохраняя пропорции 4:3
  const finalW = Math.max(50, cellWpx);
  const finalH = Math.max(40, Math.min(cellHpx, Math.round(finalW * 0.75)));

  // Высота строки таблицы в twips
  const rowH = finalH * TWP_TO_PX + 10;

  const rows = [];

  // Строка шапки — как в образце: по центру, жирный, последняя строка красная
  const hlines = [
    headerInfo.org      && { text: headerInfo.org,      bold: true,  color: '000000' },
    headerInfo.contract && { text: headerInfo.contract, bold: true,  color: '000000' },
    headerInfo.type     && { text: headerInfo.type,     bold: true,  color: '000000' },
    headerInfo.period   && { text: headerInfo.period,   bold: true,  color: 'C00000' },
  ].filter(Boolean);

  if (hlines.length) {
    rows.push(new TableRow({ children: [new TableCell({
      columnSpan: 3,
      borders: { top: OUTER, bottom: INNER, left: OUTER, right: OUTER },
      margins: { top: 80, bottom: 80, left: 200, right: 200 },
      children: hlines.map(l => new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0, before: 0, line: 276 },
        children: [new TextRun({ text: l.text, font: 'Times New Roman', size: 18, bold: l.bold, color: l.color })]
      }))
    })] }));
  }

  // Строка задачи — слева, обычный шрифт
  const line = [
    task.executor_name || task.executor,
    fmtDate(task.created_at),
    task.title,
  ].filter(Boolean).join(' // ');

  rows.push(new TableRow({ children: [new TableCell({
    columnSpan: 3,
    borders: { top: hlines.length ? INNER : OUTER, bottom: INNER, left: OUTER, right: OUTER },
    margins: { top: 40, bottom: 40, left: 100, right: 100 },
    children: [new Paragraph({
      spacing: { after: 0, before: 0 },
      children: [new TextRun({ text: line, font: 'Times New Roman', size: 16, bold: false, color: '000000' })]
    })]
  })] }));

  // 4 ряда по 3 фото
  for (let row = 0; row < ROWS_PER_PAGE; row++) {
    rows.push(new TableRow({
      height: { value: rowH, rule: 'atLeast' },
      children: [0, 1, 2].map(col => {
        const idx    = row * 3 + col;
        const imgObj = bufs12[idx] || null;
        const cw     = col === 2 ? rem : colW;
        return new TableCell({
          width: { size: cw, type: WidthType.DXA },
          borders: {
            top:    INNER,
            bottom: INNER,
            left:   col === 0 ? OUTER : INNER,
            right:  col === 2 ? OUTER : INNER,
          },
          margins: { top: 20, bottom: 20, left: 20, right: 20 },
          children: (imgObj && imgObj.data)
            ? [new Paragraph({ spacing: { after: 0, before: 0 }, children: [new ImageRun({ data: imgObj.data, transformation: { width: finalW, height: finalH }, type: imgObj.type })] })]
            : [new Paragraph({ children: [] })],
        });
      })
    }));
  }

  // Пустая строка снизу (как в образце)
  rows.push(new TableRow({
    height: { value: 400, rule: 'atLeast' },
    children: [new TableCell({
      columnSpan: 3,
      borders: { top: INNER, bottom: OUTER, left: OUTER, right: OUTER },
      children: [new Paragraph({ children: [] })]
    })]
  }));

  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [colW, colW, rem],
    layout: TableLayoutType.FIXED,
    rows,
  });
}

// Строим docx одной задачи
async function buildSingleTaskDoc(task, photos, headerInfo) {
  const buffers = await Promise.all(photos.map(p => fetchImg(p.url)));
  const pages   = [];
  const total   = Math.max(1, Math.ceil(photos.length / 6));
  for (let i = 0; i < total; i++) {
    pages.push({ p6: photos.slice(i*6, i*6+6), b6: buffers.slice(i*6, i*6+6) });
  }

  const children = [];
  pages.forEach(({ p6, b6 }, idx) => {
    if (idx > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(makePage(task, p6, b6, headerInfo));
  });

  return new Document({
    styles: { default: { document: { run: { font: 'Times New Roman', size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: PW, height: PH, orientation: PageOrientation.LANDSCAPE },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        }
      },
      children,
    }]
  });
}

// Экспорт всех задач (каждая = отдельный файл в zip или один за другим)
async function exportAllTasks(tasks, token, headerInfo) {
  // Собираем все задачи в один документ (страница = задача),
  // чтобы не делать zip в браузере.
  // Сначала загружаем фото всех задач
  const photosMap = {};
  await Promise.all(tasks.map(async t => {
    try {
      const r = await fetch(`${API_URL}/photos/${t.id}?token=${token}`);
      photosMap[t.id] = r.ok ? (await r.json()) : [];
    } catch { photosMap[t.id] = []; }
  }));

  const children = [];
  for (let ti = 0; ti < tasks.length; ti++) {
    const task    = tasks[ti];
    const photos  = photosMap[task.id] || [];
    const buffers = await Promise.all(photos.map(p => fetchImg(p.url)));
    const total   = Math.max(1, Math.ceil(photos.length / PHOTOS_PER_PAGE));

    for (let i = 0; i < total; i++) {
      if (ti > 0 || i > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(makePage(task, photos.slice(i*PHOTOS_PER_PAGE, i*PHOTOS_PER_PAGE+PHOTOS_PER_PAGE), buffers.slice(i*PHOTOS_PER_PAGE, i*PHOTOS_PER_PAGE+PHOTOS_PER_PAGE), headerInfo));
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Times New Roman', size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: PW, height: PH, orientation: PageOrientation.LANDSCAPE },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        }
      },
      children,
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `отчёт-${new Date().toISOString().slice(0,10)}.docx`);
}

// ── Модалка шапки ─────────────────────────────────────────────
function ExportModal({ onClose, onExport, loading, title }) {
  const [org,setOrg]=useState('');const [contract,setContract]=useState('');
  const [type,setType]=useState('');const [period,setPeriod]=useState('');
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl">
        <h3 className="text-xl font-bold text-gray-800 mb-1">{title||'Экспорт в Word'}</h3>
        <p className="text-sm text-gray-500 mb-4">Заполните шапку отчёта (необязательно)</p>
        <div className="space-y-3">
          {[
            {label:'Организация',val:org,set:setOrg,ph:'ООО "Зодиак-Электро"'},
            {label:'Договор',val:contract,set:setContract,ph:'Договор РСП'},
            {label:'Тип / объект',val:type,set:setType,ph:'АХП тип НА-10 – 6 шт.'},
            {label:'Описание работ / период',val:period,set:setPeriod,ph:'Демонтаж конструкции. Отчетный период c 18.03.2025г. по 21.03.2025г.'},
          ].map(({label,val,set,ph})=>(
            <div key={label}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
              <input type="text" value={val} onChange={e=>set(e.target.value)} placeholder={ph}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"/>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={()=>onExport({org,contract,type,period})} disabled={loading}
            className={`flex-1 py-3 rounded-lg font-medium text-sm transition ${loading?'bg-gray-300 text-gray-500 cursor-not-allowed':'bg-green-600 text-white hover:bg-green-700'}`}>
            {loading?'Создание...':'Скачать'}
          </button>
          <button onClick={onClose} disabled={loading} className="px-5 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm">Отмена</button>
        </div>
      </div>
    </div>
  );
}

// ── Tasks ─────────────────────────────────────────────────────
function Tasks() {
  const navigate=useNavigate();
  const [tasks,setTasks]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showExport,setShowExport]=useState(false);
  const [exporting,setExporting]=useState(false);
  const [filterStatus,setFilterStatus]=useState('');
  const [filterExecutor,setFilterExecutor]=useState('');
  const token=localStorage.getItem('token');
  const user=JSON.parse(localStorage.getItem('user')||'{}');

  useEffect(()=>{
    (async()=>{
      try{
        const r=await fetch(`${API_URL}/tasks?token=${token}`);
        if(r.status===401){localStorage.clear();navigate('/login');return;}
        const d=await r.json();setTasks(Array.isArray(d)?d:[]);
      }catch(e){console.error(e);}finally{setLoading(false);}
    })();
  },[]);

  const handleDelete=async(id)=>{
    if(!window.confirm('Удалить задачу?'))return;
    try{const r=await fetch(`${API_URL}/tasks/${id}?token=${token}`,{method:'DELETE'});if(!r.ok)throw 0;setTasks(p=>p.filter(t=>t.id!==id));}catch{alert('Ошибка');}
  };
  const handleLogout=async()=>{
    try{await fetch(`${API_URL}/logout?token=${token}`,{method:'POST'});}catch(_){}localStorage.clear();navigate('/login');
  };

  const executors=useMemo(()=>{
    const m=new Map();tasks.forEach(t=>{if(t.executor&&!m.has(t.executor))m.set(t.executor,t.executor_name||t.executor);});
    return[...m.entries()].map(([l,n])=>({login:l,name:n}));
  },[tasks]);

  const filtered=useMemo(()=>tasks.filter(t=>(!filterStatus||t.status===filterStatus)&&(!filterExecutor||t.executor===filterExecutor)),[tasks,filterStatus,filterExecutor]);
  const hasF=filterStatus||filterExecutor;

  const handleExport=async(headerInfo)=>{
    setExporting(true);
    try{await exportAllTasks(filtered,token,headerInfo);}
    catch(e){alert('Ошибка экспорта');console.error(e);}
    finally{setExporting(false);setShowExport(false);}
  };

  if(loading)return<div className="flex items-center justify-center min-h-screen bg-gray-50"><p>Загрузка...</p></div>;
  const reviewTasks=tasks.filter(t=>t.status==='review');

  return(
    <div className="min-h-screen bg-gray-50 p-6">
      {showExport&&<ExportModal title="Экспорт всех задач в Word" onClose={()=>setShowExport(false)} onExport={handleExport} loading={exporting}/>}
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 leading-tight">Мои задачи</h1>
            <p className="text-sm text-gray-500">{user.name} · <span style={{color:user.role==='admin'?'#9333ea':'#2563eb'}} className="font-medium">{user.role==='admin'?'Администратор':'Исполнитель'}</span></p>
          </div>
          <div className="flex gap-3 flex-wrap justify-end">
            {user.role==='admin'&&<><button onClick={()=>navigate('/create-task')} className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm">Создать задачу</button><button onClick={()=>navigate('/users')} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">Пользователи</button></>}
            <button onClick={handleLogout} className="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm">Выйти</button>
          </div>
        </div>

        {user.role==='admin'&&reviewTasks.length>0&&(
          <div className="mb-4 px-5 py-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-blue-700 font-medium">{reviewTasks.length} {reviewTasks.length===1?'задача ожидает':'задачи ожидают'} проверки</p>
          </div>
        )}

        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Статус</label>
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm">
                <option value="">Все статусы</option>
                {Object.entries(STATUS_LABELS).map(([v,{label}])=><option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            {user.role==='admin'&&(
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Исполнитель</label>
                <select value={filterExecutor} onChange={e=>setFilterExecutor(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm">
                  <option value="">Все исполнители</option>
                  {executors.map(({login,name})=><option key={login} value={login}>{name} ({login})</option>)}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {hasF&&<button onClick={()=>{setFilterStatus('');setFilterExecutor('');}} className="px-4 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition whitespace-nowrap">Сбросить</button>}
              {user.role==='admin'&&<button onClick={()=>setShowExport(true)} disabled={filtered.length===0}
                className={`px-4 py-2 text-sm rounded-lg border font-medium transition whitespace-nowrap ${filtered.length===0?'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed':'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'}`}>
                Экспорт в Word
              </button>}
              <p className="text-sm text-gray-400 whitespace-nowrap">Показано: {filtered.length} из {tasks.length}</p>
            </div>
          </div>
        </div>

        {filtered.length===0?(
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">{hasF?'Нет задач по выбранным фильтрам.':'Нет задач.'}</p>
            {hasF&&<button onClick={()=>{setFilterStatus('');setFilterExecutor('');}} className="mt-3 text-purple-600 hover:underline text-sm">Сбросить фильтры</button>}
          </div>
        ):(
          <div className="space-y-4">
            {filtered.map(task=>{
              const si=STATUS_LABELS[task.status]||STATUS_LABELS.pending;
              return(
                <div key={task.id} style={{
                  borderLeft:task.status==='completed'?'4px solid #22c55e':task.status==='review'?'4px solid #2563eb':task.status==='rejected'?'4px solid #ef4444':'4px solid #d97706',
                  backgroundColor:task.status==='completed'?'#f0fdf4':task.status==='review'?'#eff6ff':task.status==='rejected'?'#fef2f2':'#fefce8',
                }} className="p-6 rounded-xl shadow-md hover:shadow-lg transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 mr-4">
                      <h3 className="text-xl font-semibold text-gray-800" style={{wordBreak:'break-all',overflowWrap:'anywhere'}}>{task.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">Статус: <span style={{color:si.color}} className="font-medium">{si.label}</span></p>
                      <p className="text-sm text-gray-600">Исполнитель: {task.executor_name?`${task.executor_name} (${task.executor})`:task.executor}</p>
                      <p className="text-sm text-gray-600">Фото: {task.photos_count||0} / {task.required_photos||0}</p>
                    </div>
                    <button onClick={()=>navigate(`/tasks/${task.id}`)} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm whitespace-nowrap">Подробнее</button>
                  </div>
                  {user.role==='admin'&&<button onClick={()=>handleDelete(task.id)} className="mt-4 text-red-500 hover:text-red-700 text-sm">Удалить</button>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Tasks;