import type { Metadata } from "next";

export const metadata: Metadata = { title: "Términos y condiciones — Ruteando" };

export default function TermsAndConditionsPage() {
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-title-1 font-bold text-text">Términos y condiciones</h1>
        <p className="font-sans text-body-sm text-text-muted">Versión 1.0 — texto provisional</p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-title-2 font-semibold text-text">Qué es Ruteando</h2>
        <p className="font-sans text-body text-text">
          Ruteando es una plataforma de geolocalización que conecta consumidores con vendedores de comida
          callejera y gastronomía informal en Ciudad Verde, Soacha. Un vendedor se registra sin necesidad
          de registro mercantil ni facturación electrónica; un consumidor lo encuentra en un mapa y lo
          contacta directamente por WhatsApp.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-title-2 font-semibold text-text">Ruteando es intermediario, no vendedor</h2>
        <p className="font-sans text-body text-text">
          Ruteando no participa en la transacción de compraventa entre consumidor y vendedor — solo pone en
          contacto a ambos. No hay pago ni pedido dentro de la aplicación: la compra ocurre directamente en
          el punto de venta físico del vendedor.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-title-2 font-semibold text-text">Tu responsabilidad como usuario</h2>
        <p className="font-sans text-body text-text">
          Si registras un negocio, eres responsable de que la información que publiques (nombre,
          ubicación, horario, fotos, precios) sea veraz y esté actualizada. Si publicas una reseña, debe
          reflejar tu experiencia real. Contenido falso, engañoso o inapropiado puede ser reportado y
          moderado.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-title-2 font-semibold text-text">Cambios a estos términos</h2>
        <p className="font-sans text-body text-text">
          Podemos actualizar estos términos a medida que la plataforma evolucione. Cuando eso ocurra, te
          pediremos aceptar la nueva versión antes de continuar usando funciones que dependan de ella.
        </p>
      </section>
    </article>
  );
}
