import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[700px] px-8 py-24 text-center">
      <h1 className="text-[2.2rem] font-bold tracking-tight">Страница не найдена</h1>
      <p className="mt-2 text-mute">Возможно, сценарий был удалён.</p>
      <Link href="/" className="btn btn-primary mt-8">
        К сценариям
      </Link>
    </div>
  );
}
