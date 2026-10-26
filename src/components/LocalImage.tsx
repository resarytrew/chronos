"use client";
/* eslint-disable @next/next/no-img-element -- images are local IndexedDB data URLs */
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { uid } from "@/lib/utils";
import type { ActivityTask, ImageAsset } from "@/lib/types";

export async function prepareImage(file: File): Promise<ImageAsset> {
  if (!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Выберите JPEG, PNG или WebP");
  if (file.size>12_000_000) throw new Error("Максимальный размер изображения — 12 МБ");
  const bitmap=await createImageBitmap(file);
  try {
    const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Не удалось обработать изображение");
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const asset={id:uid(),dataUrl:canvas.toDataURL("image/webp",0.86)};
    await api.putImage(asset);return asset;
  }finally{bitmap.close();}
}
export function useImageSources(tasks:ActivityTask[]):Record<string,string> {
  const ids=JSON.stringify([...new Set(tasks.flatMap(t=>t.type==="image"&&t.imageId?[t.imageId]:[]))].sort());
  const [sources,setSources]=useState<Record<string,string>>({});
  useEffect(()=>{let mounted=true;const list=JSON.parse(ids) as string[];void Promise.all(list.map(id=>api.getImage(id))).then(assets=>{if(mounted)setSources(Object.fromEntries(assets.filter((a):a is ImageAsset=>Boolean(a)).map(a=>[a.id,a.dataUrl])));}).catch(()=>{if(mounted)setSources({});});return()=>{mounted=false;};},[ids]);
  return sources;
}
export default function LocalImage({id,alt,caption,className}:{id:string;alt:string;caption?:string;className?:string}) {
  const [asset,setAsset]=useState<ImageAsset|null|undefined>();
  useEffect(()=>{let mounted=true;setAsset(undefined);void api.getImage(id).then(a=>{if(mounted)setAsset(a??null);}).catch(()=>{if(mounted)setAsset(null);});return()=>{mounted=false;};},[id]);
  return <figure className={className}>{asset?<img src={asset.dataUrl} alt={alt} onError={()=>setAsset(null)} className="mx-auto max-h-[35vh] max-w-full rounded-xl object-contain"/>:<p role="status">{asset===null?"Изображение недоступно. Восстановите набор из файла.":"Загрузка изображения…"}</p>}{caption&&<figcaption className="mt-2 text-base text-mute">{caption}</figcaption>}</figure>;
}
