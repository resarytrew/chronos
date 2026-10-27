"use client";
/* eslint-disable @next/next/no-img-element -- local prepared data URL preview */
import {useEffect,useRef,useState} from "react";
import type {ImageAsset} from "@/lib/types";
import {Dialog,Seg} from "./ui";
import {prepareImage,type PreparedImage} from "./LocalImage";

export default function ImageUpload({onSave,onBusyChange,label="Изображение"}:{onSave:(asset:ImageAsset)=>Promise<void>;onBusyChange?:(busy:boolean)=>void;label?:string}) {
  const input=useRef<HTMLInputElement>(null);
  const [file,setFile]=useState<File|null>(null);
  const [profile,setProfile]=useState<"standard"|"detail">("standard");
  const [prepared,setPrepared]=useState<PreparedImage|null>(null);
  const [error,setError]=useState("");
  const [processing,setProcessing]=useState(false);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    if(!file)return;
    let live=true;setProcessing(true);setPrepared(null);setError("");
    void prepareImage(file,profile).then(p=>{if(live)setPrepared(p);}).catch(e=>{if(live)setError(e instanceof Error?e.message:"Не удалось прочитать изображение");}).finally(()=>{if(live)setProcessing(false);});
    return()=>{live=false;};
  },[file,profile]);
  const close=()=>{if(!saving){setFile(null);setPrepared(null);setError("");}};
  const apply=async()=>{
    if(!prepared||saving)return;
    setSaving(true);onBusyChange?.(true);setError("");
    try{await onSave({id:prepared.id,dataUrl:prepared.dataUrl});setFile(null);setPrepared(null);}
    catch(e){setError(e instanceof Error?e.message:"Не удалось сохранить изображение. Повторите действие.");}
    finally{setSaving(false);onBusyChange?.(false);}
  };
  return <>
    <label className="block text-sm text-mute">{label}: JPEG, PNG или WebP
      <input ref={input} type="file" className="field mt-1" aria-label={label} accept="image/jpeg,image/png,image/webp" disabled={saving} onChange={e=>{if(e.target.files?.[0]){setProfile("standard");setFile(e.target.files[0]);}e.target.value="";}}/>
    </label>
    <Dialog open={Boolean(file)} title="Подготовка изображения" onClose={close} wide footer={<><button className="btn" disabled={saving} onClick={close}>Отмена</button><button className="btn btn-primary" disabled={!prepared||processing||saving} onClick={()=>void apply()}>{saving?"Сохранение…":"Сохранить изображение"}</button></>}>
      <Seg value={profile} onChange={setProfile} options={[{value:"standard",label:"Обычная иллюстрация"},{value:"detail",label:"Карта / мелкие детали"}]}/>
      <p className="my-3 text-sm text-mute">До {profile==="detail"?"3200 px, PNG":"1600 px, WebP"}. Маленькие изображения не увеличиваются. Для улучшения старой карты загрузите исходник повторно.</p>
      {processing?<p role="status">Подготовка изображения…</p>:prepared&&<><img className="mx-auto max-h-[40vh] max-w-full object-contain" src={prepared.dataUrl} alt="Предпросмотр обработанного изображения"/><p className="mt-3" role="status">{prepared.width} × {prepared.height} px · {(prepared.bytes/1_000_000).toFixed(2)} МБ</p></>}
      {error&&<p className="mt-3 text-[#8c3f3f]" role="alert">{error}</p>}
    </Dialog>
  </>;
}
