import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tratamiento de datos personales — Ruteando" };

export default function DataProcessingPolicyPage() {
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-title-1 font-bold text-text">Tratamiento de datos personales</h1>
        <p className="font-sans text-body-sm text-text-muted">Versión 1.0 — texto provisional</p>
      </header>

      <p className="font-sans text-body text-text">
        Ruteando conecta consumidores con vendedores de comida callejera y gastronomía informal en Ciudad
        Verde, Soacha. Para prestar ese servicio recolectamos algunos datos personales, siempre con tu
        consentimiento previo, expreso e informado, conforme a la Ley 1581 de 2012 de Colombia.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-title-2 font-semibold text-text">Qué datos recolectamos</h2>
        <ul className="list-disc pl-5 font-sans text-body text-text">
          <li>Nombre completo, correo y, si lo compartes, un teléfono de contacto.</li>
          <li>
            Si registras un negocio: su ubicación, que es pública (necesaria para que los consumidores te
            encuentren en el mapa).
          </li>
          <li>
            Tu ubicación como consumidor: se usa solo para calcular cercanía en el momento de buscar, y no
            se guarda de forma permanente salvo que tú mismo la guardes como preferencia.
          </li>
        </ul>
        <p className="font-sans text-body-sm text-text-muted">
          Tratamos la ubicación de un negocio y la de un consumidor de forma distinta a propósito: la
          primera es un dato público del servicio; la segunda es solo tuya.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-title-2 font-semibold text-text">Para qué los usamos</h2>
        <p className="font-sans text-body text-text">
          Para mostrar negocios en el mapa y en los resultados de búsqueda, permitir que consumidores y
          vendedores se contacten directamente por WhatsApp, y generar métricas agregadas que nos ayuden a
          mejorar la plataforma. Ruteando es un intermediario de información — no participa en la
          transacción de compraventa entre consumidor y vendedor.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-title-2 font-semibold text-text">Tus derechos</h2>
        <p className="font-sans text-body text-text">
          Puedes conocer, actualizar, rectificar o solicitar la eliminación de tus datos personales en
          cualquier momento, y revocar este consentimiento cuando quieras — revocarlo puede implicar que ya
          no podamos ofrecerte partes del servicio que dependen de esos datos.
        </p>
      </section>
    </article>
  );
}
