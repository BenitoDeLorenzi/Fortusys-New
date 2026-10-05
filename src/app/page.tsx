import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Home,
  KeyRound,
  MapPin,
  Search,
  ShieldCheck,
} from "lucide-react";

import { featuredListings } from "@/features/public-site/listings";
import { getPublicRealEstateOptions } from "@/features/public-site/options";

export const metadata: Metadata = {
  metadataBase: new URL("https://fortulinoimoveis.com.br"),
  title: "Fortulino Imóveis | Aluguel, venda e administração de imóveis",
  description:
    "Imobiliária para alugar, vender e administrar imóveis com atendimento próximo e processo organizado.",
  openGraph: {
    title: "Fortulino Imóveis",
    description:
      "Atendimento imobiliário para aluguel, venda e administração de propriedades.",
    url: "https://fortulinoimoveis.com.br",
    siteName: "Fortulino Imóveis",
    locale: "pt_BR",
    type: "website",
  },
};

const whatsappPhone = process.env.NEXT_PUBLIC_FORTULINO_WHATSAPP;
const contactMessage =
  "Olá, vim pelo site da Fortulino Imóveis e quero falar sobre um imóvel.";
const contactHref = whatsappPhone
  ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(contactMessage)}`
  : "#atendimento";
const contactTarget = whatsappPhone ? "_blank" : undefined;
const contactRel = whatsappPhone ? "noreferrer" : undefined;

const navItems = [
  { href: "/", label: "Home" },
  { href: "#quem-somos", label: "Quem somos" },
  { href: "/busca?finalidade=venda", label: "Vendas" },
  { href: "/busca?finalidade=aluguel", label: "Locações" },
  { href: "#atendimento", label: "Contato" },
];

const serviceItems = [
  {
    icon: Search,
    title: "Encontrar imóvel",
    description: "Compra e locação com busca orientada por perfil.",
  },
  {
    icon: ShieldCheck,
    title: "Administrar aluguel",
    description: "Contratos, cobranças e documentos em rotina organizada.",
  },
  {
    icon: ClipboardCheck,
    title: "Vender com suporte",
    description: "Apoio na negociação e nas etapas até o fechamento.",
  },
];

const choiceItems = [
  "Atendimento direto",
  "Imóveis para compra e locação",
  "Suporte para proprietários",
  "Processo claro do início ao fim",
];

const selectClassName =
  "h-12 w-full appearance-none rounded-md border border-slate-200 bg-white px-4 pr-9 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#0f7797] focus:ring-3 focus:ring-[#0f7797]/20";

export default async function PublicHome() {
  const options = await getPublicRealEstateOptions();

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f6f8f7] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-center px-4 sm:h-20 md:justify-between sm:px-6 lg:px-8">
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
              <a
                key={item.href}
                href={item.href}
                className="transition hover:text-[#0f7797]"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <section
        className="relative min-h-[430px] overflow-hidden bg-[#103b50] bg-cover bg-center sm:min-h-[500px] lg:min-h-[540px]"
        style={{
          backgroundImage: "url('/images/fortulino-hero-interior.png')",
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,25,37,0.3),rgba(5,25,37,0.64))]" />

        <div className="relative mx-auto flex min-h-[430px] max-w-6xl flex-col items-center justify-center px-4 py-10 text-center text-white sm:min-h-[500px] sm:px-6 lg:min-h-[540px] lg:px-8">
          <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
            Encontre seu próximo imóvel.
          </h1>

          <form
            action="/busca"
            className="mt-8 w-full max-w-5xl rounded-lg bg-white p-3 text-left text-slate-950 shadow-2xl"
          >
            <div className="grid gap-2 md:grid-cols-[1fr_1.25fr_1.25fr_auto]">
              <select
                aria-label="Finalidade"
                className={selectClassName}
                name="finalidade"
                defaultValue=""
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
                defaultValue=""
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
                defaultValue=""
              >
                {options.cities.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center rounded-md bg-[#0f7797] px-6 text-sm font-bold text-white transition hover:bg-[#0b637e]"
              >
                Pesquisar
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-[#f6f8f7]">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-5 sm:grid-cols-3 sm:px-6 lg:px-8">
          {[
            {
              id: "locacoes",
              title: "Locação",
              description: "Imóveis residenciais e comerciais",
            },
            {
              id: "vendas",
              title: "Venda",
              description: "Apoio em negociação e documentação",
            },
            {
              id: "administracao",
              title: "Administração",
              description: "Rotina organizada para proprietários",
            },
          ].map((item) => (
            <div
              id={item.id}
              key={item.id}
              className="rounded-lg border border-slate-200 bg-white px-4 py-4"
            >
              <p className="text-base font-bold text-[#0b2d40]">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="imoveis" className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-normal text-[#0f7797]">
                Imóveis em destaque
              </p>
              <h2 className="mt-2 text-3xl font-bold text-[#0b2d40]">
                Oportunidades selecionadas
              </h2>
            </div>
          </div>

          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            {featuredListings.map((listing) => (
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
                      <h3 className="mt-2 text-lg font-bold leading-snug text-[#0b2d40]">
                        {listing.title}
                      </h3>
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
        </div>
      </section>

      <section id="servicos" className="bg-[#eef7f8]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-bold uppercase tracking-normal text-[#0f7797]">
            Serviços
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[#0b2d40]">
            Como podemos ajudar
          </h2>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {serviceItems.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex size-11 items-center justify-center rounded-lg bg-[#dff4f7] text-[#0f7797]">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-[#0b2d40]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="quem-somos" className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-8">
          <h2 className="text-3xl font-bold leading-tight text-[#0b2d40]">
            Imobiliária para resolver com clareza.
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            {choiceItems.map((item) => (
              <div
                key={item}
                className="flex gap-3 rounded-lg border border-slate-200 bg-[#fbfcfc] p-4"
              >
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#0f7797]" />
                <p className="text-sm font-semibold leading-6 text-slate-700">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="atendimento" className="bg-[#103b50] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-normal text-cyan-100">
              <KeyRound className="size-4" />
              Atendimento Fortulino Imóveis
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">
              Pronto para conversar?
            </h2>
          </div>
          <a
            href={contactHref}
            target={contactTarget}
            rel={contactRel}
            className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-5 text-sm font-bold text-[#103b50] transition hover:bg-cyan-50"
          >
            Iniciar atendimento
            <ArrowRight className="ml-2 size-4" />
          </a>
        </div>
      </section>
    </main>
  );
}
