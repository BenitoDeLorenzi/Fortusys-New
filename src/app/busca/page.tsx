import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Home, MapPin, Search, SlidersHorizontal } from "lucide-react";

import { getPublicListings } from "@/features/public-site/listings";
import { getPublicRealEstateOptions } from "@/features/public-site/options";

export const metadata: Metadata = {
  title: "Busca de imóveis | Fortulino Imóveis",
  description:
    "Encontre imóveis para venda e locação com filtros públicos da Fortulino Imóveis.",
};

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const navItems = [
  { href: "/", label: "Home" },
  { href: "/#quem-somos", label: "Quem somos" },
  { href: "/busca?finalidade=venda", label: "Vendas" },
  { href: "/busca?finalidade=aluguel", label: "Locações" },
  { href: "/#atendimento", label: "Contato" },
];

const whatsappPhone = process.env.NEXT_PUBLIC_FORTULINO_WHATSAPP;
const contactMessage =
  "Olá, vim pelo site da Fortulino Imóveis e quero falar sobre um imóvel.";
const contactHref = whatsappPhone
  ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(contactMessage)}`
  : "/#atendimento";
const contactTarget = whatsappPhone ? "_blank" : undefined;
const contactRel = whatsappPhone ? "noreferrer" : undefined;

const selectClassName =
  "h-12 w-full appearance-none rounded-md border border-slate-200 bg-white px-4 pr-9 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#0f7797] focus:ring-3 focus:ring-[#0f7797]/20";

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const filters = {
    finalidade: getSingleParam(params.finalidade) ?? "",
    tipo: getSingleParam(params.tipo) ?? "",
    cidade: getSingleParam(params.cidade) ?? "",
  };
  const [options, result] = await Promise.all([
    getPublicRealEstateOptions(),
    getPublicListings(filters),
  ]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f6f8f7] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-center px-4 sm:h-20 sm:px-6 md:justify-between lg:px-8">
          <Link
            href="/"
            aria-label="Fortulino Imóveis"
            className="flex items-center gap-2.5 sm:gap-3"
          >
            <span className="flex size-11 items-center justify-center overflow-hidden rounded-lg bg-white sm:size-14">
              <Image
                src="/images/fortulino-symbol.png"
                alt=""
                width={56}
                height={56}
                priority
                className="h-full w-full object-contain"
              />
            </span>
            <span className="text-lg font-bold leading-none text-[#103b50] sm:text-xl">
              Fortulino Imóveis
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition hover:text-[#0f7797]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <section className="bg-[#103b50] text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-100 transition hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Voltar para home
          </Link>
          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-normal text-cyan-100">
                Busca Fortulino
              </p>
              <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
                Imóveis para venda e locação
              </h1>
            </div>
            <p className="text-sm font-semibold text-cyan-50">
              {result.total === 1
                ? "1 imóvel encontrado"
                : `${result.total} imóveis encontrados`}
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <form action="/busca" className="grid gap-2 md:grid-cols-[1fr_1.2fr_1.2fr_auto_auto]">
            <select
              aria-label="Finalidade"
              className={selectClassName}
              name="finalidade"
              defaultValue={filters.finalidade}
            >
              {options.purposes.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Tipo de imóvel"
              className={selectClassName}
              name="tipo"
              defaultValue={filters.tipo}
            >
              {options.types.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Cidade"
              className={selectClassName}
              name="cidade"
              defaultValue={filters.cidade}
            >
              {options.cities.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-md bg-[#0f7797] px-5 text-sm font-bold text-white transition hover:bg-[#0b637e]"
            >
              <Search className="mr-2 size-4" />
              Pesquisar
            </button>

            <Link
              href="/busca"
              className="inline-flex h-12 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-[#0f7797] hover:text-[#0f7797]"
            >
              Limpar
            </Link>
          </form>
        </div>
      </section>

      <section className="bg-[#f6f8f7]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div className="mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-normal text-[#0f7797]">
            <SlidersHorizontal className="size-4" />
            Resultado da busca
          </div>

          {result.listings.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {result.listings.map((listing) => (
                <article
                  key={listing.id}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                >
                  <div className="relative aspect-[4/3] bg-slate-100">
                    <Image
                      src={listing.image}
                      alt={listing.title}
                      fill
                      sizes="(min-width: 1024px) 33vw, 100vw"
                      className="object-cover"
                    />
                    <div className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0f5368] shadow-sm">
                      {listing.purpose}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-normal text-[#0f7797]">
                          {listing.type} | {listing.code}
                        </p>
                        <h2 className="mt-2 text-lg font-bold leading-snug text-[#0b2d40]">
                          {listing.title}
                        </h2>
                      </div>
                      <Home className="mt-1 size-5 shrink-0 text-[#0f7797]" />
                    </div>

                    <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <MapPin className="size-4 text-[#0f7797]" />
                      {listing.district}, {listing.city} - {listing.state}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
                      <span className="rounded-md bg-white px-2.5 py-1 ring-1 ring-slate-200">
                        {listing.area}
                      </span>
                      {listing.bedrooms ? (
                        <span className="rounded-md bg-white px-2.5 py-1 ring-1 ring-slate-200">
                          {listing.bedrooms}
                        </span>
                      ) : null}
                      {listing.parking ? (
                        <span className="rounded-md bg-white px-2.5 py-1 ring-1 ring-slate-200">
                          {listing.parking}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                      <p className="text-lg font-bold text-[#103b50]">
                        {listing.price}
                      </p>
                      <a
                        href={contactHref}
                        target={contactTarget}
                        rel={contactRel}
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-[#103b50] px-3 text-sm font-bold text-white transition hover:bg-[#0b2d40]"
                      >
                        Tenho interesse
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-center">
              <p className="text-lg font-bold text-[#0b2d40]">
                Nenhum imóvel encontrado
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Ajuste os filtros para ver outras opções disponíveis.
              </p>
              <Link
                href="/busca"
                className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-[#0f7797] px-5 text-sm font-bold text-white transition hover:bg-[#0b637e]"
              >
                Ver todos
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
