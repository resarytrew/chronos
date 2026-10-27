"use client";
/* eslint-disable @next/next/no-img-element -- local IndexedDB images */
import {useEffect,useRef,useState} from "react";

export default function ImageViewer({src,alt,onClose}:{src:string;alt:string;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const area=useRef<HTMLDivElement>(null);
  const picture=useRef<HTMLImageElement>(null);
  const pointers=useRef(new Map<number,{x:number;y:number}>());
  const [view,setView]=useState({scale:1,x:0,y:0});
  useEffect(()=>{const d=dialog.current;d?.showModal();return()=>d?.close();},[]);
  const constrain=(v:typeof view)=>{
    const a=area.current,p=picture.current;
    const mx=a&&p?Math.max(0,(p.offsetWidth*v.scale-a.clientWidth)/2):0;
    const my=a&&p?Math.max(0,(p.offsetHeight*v.scale-a.clientHeight)/2):0;
    return {...v,x:Math.max(-mx,Math.min(mx,v.x)),y:Math.max(-my,Math.min(my,v.y))};
  };
  const zoom=(factor:number)=>setView(v=>constrain({...v,scale:Math.max(1,Math.min(6,v.scale*factor))}));
  const fit=()=>setView({scale:1,x:0,y:0});
  return <dialog className="image-viewer" ref={dialog} aria-label="Просмотр изображения" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>e.stopPropagation()} onKeyDown={e=>{
    e.stopPropagation();
    if(e.key==="Escape"){e.preventDefault();onClose();}
    else if(e.key==="+"||e.key==="="){e.preventDefault();zoom(1.25);}
    else if(e.key==="-"||e.key==="−"){e.preventDefault();zoom(0.8);}
    else if(e.key==="0"){e.preventDefault();fit();}
  }}>
    <div className="image-viewer-toolbar">
      <button type="button" onClick={()=>zoom(1.25)} disabled={view.scale>=6}>Увеличить</button>
      <button type="button" onClick={()=>zoom(0.8)} disabled={view.scale<=1}>Уменьшить</button>
      <button type="button" onClick={fit}>Вписать</button>
      <span aria-live="polite">{Math.round(view.scale*100)}%</span>
      <button type="button" onClick={onClose}>Закрыть</button>
    </div>
    <div ref={area} className="image-viewer-area" onPointerDown={e=>{
      e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    }} onPointerMove={e=>{
      const points=pointers.current;if(!points.has(e.pointerId))return;
      const before=[...points.values()];
      points.set(e.pointerId,{x:e.clientX,y:e.clientY});
      const after=[...points.values()];
      const dx=after.reduce((s,p)=>s+p.x,0)/after.length-before.reduce((s,p)=>s+p.x,0)/before.length;
      const dy=after.reduce((s,p)=>s+p.y,0)/after.length-before.reduce((s,p)=>s+p.y,0)/before.length;
      const distance=(ps:typeof before)=>Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);
      const factor=before.length===2&&distance(before)>0?distance(after)/distance(before):1;
      setView(v=>constrain({scale:Math.max(1,Math.min(6,v.scale*factor)),x:v.x+dx,y:v.y+dy}));
    }} onPointerUp={e=>pointers.current.delete(e.pointerId)} onPointerCancel={e=>pointers.current.delete(e.pointerId)}>
      <img ref={picture} src={src} alt={alt} draggable={false} style={{transform:`translate(${view.x}px,${view.y}px) scale(${view.scale})`}}/>
    </div>
  </dialog>;
}
