"use client";
/* eslint-disable @next/next/no-img-element -- images are local IndexedDB data URLs */
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { uid } from "@/lib/utils";
import type { Illustration, ImageAsset } from "@/lib/types";
import ImageViewer from "./ImageViewer";

export interface PreparedImage extends ImageAsset {width:number;height:number;bytes:number}
export async function prepareImage(file: File,profile:"standard"|"detail"="standard"): Promise<PreparedImage> {
  if (!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Выберите JPEG, PNG или WebP");
  if (file.size>12_000_000) throw new Error("Максимальный размер изображения — 12 МБ");
  let bitmap:ImageBitmap;
  try{bitmap=await createImageBitmap(file);}catch{throw new Error("Не удалось прочитать изображение. Выберите исправный JPEG, PNG или WebP.");}
  try {
    const scale=Math.min(1,(profile==="detail"?3200:1600)/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Не удалось обработать изображение");
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const dataUrl=canvas.toDataURL(profile==="detail"?"image/png":"image/webp",0.86);
    const bytes=Math.floor((dataUrl.length-dataUrl.indexOf(",")-1)*3/4);
    if(bytes>8_000_000)throw new Error("Результат больше 8 МБ. Выберите обычную иллюстрацию или другой исходный файл.");
    return {id:uid(),dataUrl,width:canvas.width,height:canvas.height,bytes};
  }finally{bitmap.close();}
}
export function useImageSources(tasks:{type?:string;imageId?:string;illustration?:Illustration}[]):Record<string,string> {
  const ids=JSON.stringify([...new Set(tasks.flatMap(t=>t.type==="image"&&t.imageId?[t.imageId]:t.illustration?.imageId?[t.illustration.imageId]:[]))].sort());
  const [sources,setSources]=useState<Record<string,string>>({});
  useEffect(()=>{let mounted=true;const list=JSON.parse(ids) as string[];void Promise.all(list.map(id=>api.getImage(id))).then(assets=>{if(mounted)setSources(Object.fromEntries(assets.filter((a):a is ImageAsset=>Boolean(a)).map(a=>[a.id,a.dataUrl])));}).catch(()=>{if(mounted)setSources({});});return()=>{mounted=false;};},[ids]);
  return sources;
}
export default function LocalImage({id,alt,caption,className,onViewerOpen,onFailure,onReady,onTextFallback}:{id:string;alt:string;caption?:string;className?:string;onViewerOpen?:()=>void;onFailure?:()=>void;onReady?:()=>void;onTextFallback?:()=>void}) {
  const [asset,setAsset]=useState<ImageAsset|null|undefined>();
  const [attempt,setAttempt]=useState(0);
  const [viewing,setViewing]=useState(false);
  const failure=useRef(onFailure);failure.current=onFailure;
  useEffect(()=>{let mounted=true;setAsset(undefined);setViewing(false);void api.getImage(id).then(a=>{if(mounted){setAsset(a??null);if(!a)failure.current?.();}}).catch(()=>{if(mounted){setAsset(null);failure.current?.();}});return()=>{mounted=false;};},[id,attempt]);
  return <figure className={className} onClick={e=>e.stopPropagation()}>{asset?<button type="button" className="local-image-open" aria-label="Увеличить изображение" onClick={()=>{onViewerOpen?.();setViewing(true);}}><img src={asset.dataUrl} alt={alt} onLoad={onReady} onError={()=>{setAsset(null);failure.current?.();}} className="mx-auto max-h-[35vh] max-w-full rounded-xl object-contain"/><span className="local-image-hint">Увеличить</span></button>:<div role="status">{asset===null?<><p>Изображение недоступно. Восстановите набор из файла.</p><button className="btn" onClick={()=>setAttempt(v=>v+1)}>Повторить загрузку</button>{onTextFallback&&<button className="btn" onClick={onTextFallback}>Показать текст</button>}</>:"Загрузка изображения…"}</div>}{caption&&<figcaption className="mt-2 text-base text-mute">{caption}</figcaption>}{viewing&&asset&&<ImageViewer key={id} src={asset.dataUrl} alt={alt} onClose={()=>setViewing(false)}/>}</figure>;
}
