"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { getBusinessFormErrorMessage, getAssistedRegistrationErrorMessage, getFieldErrors, getNetworkErrorMessage } from "@/lib/api/error-messages";
import { logBusinessRegisteredEvent } from "@/lib/api/events";
import type { components } from "@/lib/api/schema";
import { WizardShell } from "@/components/business/registration/wizard-shell";
import { DetailsStep, type BusinessDetailsValues } from "@/components/business/registration/details-step";
import {
  LocationStep,
  MISSING_LOCATION_MESSAGE,
  type BusinessLocationValues,
} from "@/components/business/registration/location-step";
import { clearDraft, loadDraft, saveDraft, type DraftStep } from "@/lib/registration/draft";
import {
  ScheduleStep,
  DEFAULT_WEEK_SCHEDULE,
  scheduleFromRows,
  type WeekSchedule,
} from "@/components/business/registration/schedule-step";
import { DoneStep } from "@/components/business/registration/done-step";
import {
  AssistedFormStep,
  type AssistedRegistrationValues,
} from "@/components/business/registration/assisted-form-step";
import { AssistedDoneStep } from "@/components/business/registration/assisted-done-step";

type Category = components["schemas"]["Category"];
type Day = components["schemas"]["ScheduleDay"]["day"];
type AssistedRegistrationResult = components["schemas"]["AssistedRegistrationResult"];

type SelfStep = "details" | "location" | "schedule" | "done";

const SELF_STEP_NUMBER: Record<Exclude<SelfStep, "done">, number> = {
  details: 1,
  location: 2,
  schedule: 3,
};
const SELF_STEP_TOTAL = 3;

const EMPTY_DETAILS: BusinessDetailsValues = {
  name: "",
  description: "",
  categoryId: "",
  contactPhone: "",
  ownDelivery: false,
  seatingAvailable: false,
};
const EMPTY_LOCATION: BusinessLocationValues = {
  type: "fixed",
  referenceAddress: "",
  latitude: "",
  longitude: "",
  // "Zona aproximada" por defecto — pedido explícito del usuario, ver
  // CLAUDE.md: protege por defecto a un vendedor que opera desde su casa.
  showExactLocation: false,
  placed: false,
};

/**
 * Orquestador del asistente de registro de negocio (Épica F5). La rama
 * que se muestra depende del rol del usuario autenticado — no de una
 * elección libre — porque el backend mismo ya lo exige así (encontrado
 * leyendo businesses.routes.js/auth.routes.js, no solo la prosa de
 * CLAUDE.md): POST /businesses exige requireRole('vendor') y
 * POST /auth/assisted-registration exige requireRole('administrator').
 * Un `consumer` no puede hacer ninguna de las dos — se le explica por
 * qué en vez de dejarlo entrar a un formulario que el servidor va a
 * rechazar con 403.
 */
export function BusinessRegistrationWizard() {
  const { user } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    api.GET("/categories").then(({ data }) => {
      if (ignore) return;
      if (data) setCategories(data);
      setCategoriesLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, []);

  if (user?.role === "vendor") {
    return <SelfRegistrationFlow categories={categories} categoriesLoading={categoriesLoading} />;
  }

  if (user?.role === "administrator") {
    return <AssistedRegistrationFlow categories={categories} categoriesLoading={categoriesLoading} />;
  }

  return (
    <div className="reserva-columna flex flex-1 flex-col items-center justify-center gap-3 bg-background pl-6 text-center">
      <h1 className="font-heading text-title-1 font-bold text-text">Necesitas una cuenta de vendedor</h1>
      <p className="max-w-sm font-sans text-body text-text-muted">
        Para registrar tu propio negocio en Ruteando, tu cuenta debe estar marcada como vendedor. Si un
        administrador de Ruteando te está ayudando en persona, puede registrar tu negocio por ti con
        registro asistido.
      </p>
      <Button type="button" onClick={() => router.push("/")} className="mt-2">
        Ir al inicio
      </Button>
    </div>
  );
}

interface FlowProps {
  categories: Category[];
  categoriesLoading: boolean;
}

function SelfRegistrationFlow({ categories, categoriesLoading }: FlowProps) {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const resumeBusinessId = searchParams.get("negocio");
  // Retomar (borrador local o, si no hay, lo ya guardado en el servidor)
  // antes de mostrar el primer paso: los pasos leen sus valores iniciales
  // una sola vez al montarse.
  const [ready, setReady] = useState(false);
  const [savingForLater, setSavingForLater] = useState(false);

  const [step, setStep] = useState<SelfStep>("details");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");

  const [detailsValues, setDetailsValues] = useState<BusinessDetailsValues>(EMPTY_DETAILS);
  const [locationValues, setLocationValues] = useState<BusinessLocationValues>(EMPTY_LOCATION);
  const [scheduleValues, setScheduleValues] = useState<WeekSchedule>(DEFAULT_WEEK_SCHEDULE);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Lo último que el vendedor escribió en cada paso, guardado o no — para
  // "Guardar y terminar después". Ref (no estado): no redibuja nada.
  const live = useRef({ details: EMPTY_DETAILS, location: EMPTY_LOCATION, schedule: DEFAULT_WEEK_SCHEDULE });
  const onDetailsChange = useCallback((v: BusinessDetailsValues) => {
    live.current.details = v;
  }, []);
  const onLocationChange = useCallback((v: BusinessLocationValues) => {
    live.current.location = v;
  }, []);
  const onScheduleChange = useCallback((v: WeekSchedule) => {
    live.current.schedule = v;
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let ignore = false;
    (async () => {
      const draft = loadDraft(user.id!);
      if (draft && (!resumeBusinessId || draft.businessId === resumeBusinessId)) {
        live.current = { details: draft.details, location: draft.location, schedule: draft.schedule };
        setDetailsValues(draft.details);
        setLocationValues(draft.location);
        setScheduleValues(draft.schedule);
        setBusinessId(draft.businessId);
        setBusinessName(draft.details.name);
        setStep(draft.businessId ? draft.step : "details");
      } else if (resumeBusinessId) {
        const [{ data: business }, { data: rows }] = await Promise.all([
          api.GET("/businesses/{businessId}", { params: { path: { businessId: resumeBusinessId } } }),
          api.GET("/businesses/{businessId}/schedule", { params: { path: { businessId: resumeBusinessId } } }),
        ]);
        if (ignore) return;
        if (business && business.ownerId === user.id) {
          const details: BusinessDetailsValues = {
            name: business.name ?? "",
            description: business.description ?? "",
            categoryId: business.categoryId ?? "",
            contactPhone: business.contactPhone ?? "",
            ownDelivery: Boolean(business.ownDelivery),
            seatingAvailable: Boolean(business.seatingAvailable),
          };
          const loc = business.location;
          const location: BusinessLocationValues = loc
            ? {
                type: loc.type ?? "fixed",
                referenceAddress: loc.referenceAddress ?? "",
                latitude: loc.latitude != null ? String(loc.latitude) : "",
                longitude: loc.longitude != null ? String(loc.longitude) : "",
                showExactLocation: Boolean(loc.showExactLocation),
                placed: true,
              }
            : EMPTY_LOCATION;
          const schedule = rows && rows.length > 0 ? scheduleFromRows(rows) : DEFAULT_WEEK_SCHEDULE;
          live.current = { details, location, schedule };
          setDetailsValues(details);
          setLocationValues(location);
          setScheduleValues(schedule);
          setBusinessId(business.id ?? null);
          setBusinessName(details.name);
          setStep(loc ? "schedule" : "location");
        }
      }
      if (!ignore) setReady(true);
    })();
    return () => {
      ignore = true;
    };
  }, [user?.id, resumeBusinessId]);

  /**
   * "Guardar y terminar después": guarda en el servidor lo que el paso
   * actual ya permite guardar (sin mostrar errores de validación: el
   * vendedor se va, no está enviando), deja el resto como borrador en este
   * navegador y sale al inicio, donde su negocio (si ya existe) le ofrece
   * "Terminar registro".
   */
  async function handleSaveForLater() {
    if (!user?.id || step === "done") return;
    setSavingForLater(true);
    const { details, location, schedule } = live.current;
    let id = businessId;
    try {
      if (step === "details" && details.name.trim() && details.categoryId !== "") {
        const body = {
          name: details.name.trim(),
          categoryId: details.categoryId,
          description: details.description.trim() ? details.description.trim() : undefined,
          contactPhone: details.contactPhone.trim() ? details.contactPhone.trim() : undefined,
          ownDelivery: details.ownDelivery,
          seatingAvailable: details.seatingAvailable,
        };
        const { data } = id
          ? await api.PATCH("/businesses/{businessId}", { params: { path: { businessId: id } }, body })
          : await api.POST("/businesses", { body });
        if (data?.id) id = data.id;
      } else if (step === "location" && id && location.placed && location.latitude && location.longitude) {
        await api.PUT("/businesses/{businessId}/location", {
          params: { path: { businessId: id } },
          body: {
            type: location.type,
            referenceAddress: location.referenceAddress.trim() ? location.referenceAddress.trim() : undefined,
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
            showExactLocation: location.showExactLocation,
          },
        });
      }
    } catch {
      // Red caída: queda igual el borrador local.
    }
    saveDraft(user.id, { businessId: id, step: step as DraftStep, details, location, schedule });
    router.push("/");
  }

  function resetSubmitState() {
    setError(null);
    setFieldErrors({});
  }

  async function handleDetailsSubmit(values: BusinessDetailsValues) {
    if (values.categoryId === "") {
      setError("Selecciona una categoría.");
      return;
    }

    setSubmitting(true);
    resetSubmitState();

    const body = {
      name: values.name,
      categoryId: values.categoryId,
      description: values.description.trim() ? values.description.trim() : undefined,
      contactPhone: values.contactPhone.trim() ? values.contactPhone.trim() : undefined,
      ownDelivery: values.ownDelivery,
      seatingAvailable: values.seatingAvailable,
    };

    const { data, error: apiError, response } = businessId
      ? await api.PATCH("/businesses/{businessId}", { params: { path: { businessId } }, body })
      : await api.POST("/businesses", { body });

    if (apiError || !data?.id) {
      setSubmitting(false);
      if (!response) {
        setError(getNetworkErrorMessage());
        return;
      }
      setError(getBusinessFormErrorMessage(response.status));
      setFieldErrors(getFieldErrors(apiError));
      return;
    }

    setBusinessId(data.id);
    setBusinessName(data.name ?? values.name);
    setDetailsValues(values);
    setSubmitting(false);
    setStep("location");
  }

  async function handleLocationSubmit(values: BusinessLocationValues) {
    if (!businessId) return;

    // Vacíos: Number("") es 0 y el servidor respondía "fuera de Cundinamarca".
    if (!values.placed || values.latitude.trim() === "" || values.longitude.trim() === "") {
      setError(MISSING_LOCATION_MESSAGE);
      return;
    }
    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setError("Ingresa coordenadas numéricas válidas.");
      return;
    }

    setSubmitting(true);
    resetSubmitState();

    const { error: apiError, response } = await api.PUT("/businesses/{businessId}/location", {
      params: { path: { businessId } },
      body: {
        type: values.type,
        referenceAddress: values.referenceAddress.trim() ? values.referenceAddress.trim() : undefined,
        latitude,
        longitude,
        showExactLocation: values.showExactLocation,
      },
    });

    setSubmitting(false);

    // No se narrowea con `if (apiError)` a propósito: este endpoint no
    // declara ninguna respuesta de error en openapi.yaml (solo '200'),
    // así que TypeScript infiere `error` como `undefined` siempre — narrowear
    // por ahí colapsaría `response` a `never` dentro del bloque (mismo
    // motivo documentado en error-messages.ts sobre no tipar contra el
    // schema generado). `response.ok` es la señal real en tiempo de
    // ejecución, sin depender de esa declaración incompleta del contrato.
    if (!response.ok) {
      setError(getBusinessFormErrorMessage(response.status));
      setFieldErrors(getFieldErrors(apiError));
      return;
    }

    setLocationValues(values);
    setStep("schedule");
  }

  async function handleScheduleSubmit(values: WeekSchedule) {
    if (!businessId) return;

    setSubmitting(true);
    resetSubmitState();

    const body = (Object.keys(values) as Day[]).map((day) => {
      const dayValue = values[day];
      if (dayValue.closed) return { day, closed: true };
      return { day, closed: false, openTime: dayValue.openTime, closeTime: dayValue.closeTime };
    });

    const { response } = await api.PUT("/businesses/{businessId}/schedule", {
      params: { path: { businessId } },
      body,
    });

    setSubmitting(false);

    // Ver el comentario equivalente en handleLocationSubmit — mismo
    // motivo: este endpoint tampoco declara respuestas de error.
    if (!response.ok) {
      setError(getBusinessFormErrorMessage(response.status));
      return;
    }

    setScheduleValues(values);
    logBusinessRegisteredEvent(businessId);
    if (user?.id) clearDraft(user.id);
    setStep("done");
  }

  function handleClose() {
    if (businessId && step !== "done") {
      const confirmLeave = window.confirm(
        "Ya registramos tu negocio, pero el registro todavía no está completo. ¿Seguro que quieres salir?",
      );
      if (!confirmLeave) return;
    }
    router.push("/");
  }

  if (!ready) {
    return <div className="flex flex-1 items-center justify-center font-sans text-body text-text-muted">Cargando…</div>;
  }

  if (step === "done" && businessId) {
    return (
      <DoneStep
        businessName={businessName}
        businessId={businessId}
        contactPhone={detailsValues.contactPhone.trim() || null}
      />
    );
  }

  if (step === "location") {
    return (
      <WizardShell
        title="¿Dónde te encontramos?"
        stepLabel={`Paso ${SELF_STEP_NUMBER.location} de ${SELF_STEP_TOTAL}`}
        progress={SELF_STEP_NUMBER.location / SELF_STEP_TOTAL}
        onClose={handleClose}
        onSaveForLater={handleSaveForLater}
        savingForLater={savingForLater}
      >
        <LocationStep
          onValuesChange={onLocationChange}
          initialValues={locationValues}
          submitting={submitting}
          error={error}
          fieldErrors={fieldErrors}
          onSubmit={handleLocationSubmit}
          onBack={() => {
            resetSubmitState();
            setStep("details");
          }}
        />
      </WizardShell>
    );
  }

  if (step === "schedule") {
    return (
      <WizardShell
        title="¿Cuál es tu horario?"
        stepLabel={`Paso ${SELF_STEP_NUMBER.schedule} de ${SELF_STEP_TOTAL}`}
        progress={SELF_STEP_NUMBER.schedule / SELF_STEP_TOTAL}
        onClose={handleClose}
        onSaveForLater={handleSaveForLater}
        savingForLater={savingForLater}
      >
        <ScheduleStep
          onValuesChange={onScheduleChange}
          initialValues={scheduleValues}
          submitting={submitting}
          error={error}
          onSubmit={handleScheduleSubmit}
          onBack={() => {
            resetSubmitState();
            setStep("location");
          }}
        />
      </WizardShell>
    );
  }

  return (
    <WizardShell
      title="Cuéntanos de tu negocio"
      stepLabel={`Paso ${SELF_STEP_NUMBER.details} de ${SELF_STEP_TOTAL}`}
      progress={SELF_STEP_NUMBER.details / SELF_STEP_TOTAL}
      onClose={handleClose}
      onSaveForLater={handleSaveForLater}
      savingForLater={savingForLater}
    >
      <DetailsStep
        onValuesChange={onDetailsChange}
        categories={categories}
        categoriesLoading={categoriesLoading}
        initialValues={detailsValues}
        submitting={submitting}
        error={error}
        fieldErrors={fieldErrors}
        onSubmit={handleDetailsSubmit}
      />
    </WizardShell>
  );
}

function AssistedRegistrationFlow({ categories, categoriesLoading }: FlowProps) {
  const router = useRouter();

  const [step, setStep] = useState<"form" | "done">("form");
  const [result, setResult] = useState<AssistedRegistrationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Contador para forzar que AssistedFormStep reinicie sus campos internos
  // al reutilizar el formulario para un segundo registro asistido.
  const [formKey, setFormKey] = useState(0);

  async function handleSubmit(values: AssistedRegistrationValues) {
    if (values.businessCategoryId === "") {
      setError("Selecciona una categoría.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    const { data, error: apiError, response } = await api.POST("/auth/assisted-registration", {
      body: {
        vendor: {
          fullName: values.vendorFullName,
          email: values.vendorEmail.trim() ? values.vendorEmail.trim() : undefined,
          phone: values.vendorPhone.trim() ? values.vendorPhone.trim() : undefined,
        },
        business: {
          name: values.businessName,
          categoryId: values.businessCategoryId,
          description: values.businessDescription.trim() ? values.businessDescription.trim() : undefined,
          contactPhone: values.businessContactPhone.trim() ? values.businessContactPhone.trim() : undefined,
        },
        // Pendiente (CLAUDE.md sección 10, Épica 8): todavía no hay una
        // pantalla real de términos legales versionados (Épica F6) — se
        // usa un valor fijo hasta que exista.
        consentTextVersion: "1.0",
      },
    });

    setSubmitting(false);

    if (apiError || !data) {
      if (!response) {
        setError(getNetworkErrorMessage());
        return;
      }
      setError(getAssistedRegistrationErrorMessage(response.status));
      setFieldErrors(getFieldErrors(apiError));
      return;
    }

    setResult(data);
    if (data.business?.id) logBusinessRegisteredEvent(data.business.id);
    setStep("done");
  }

  function handleClose() {
    router.push("/");
  }

  if (step === "done" && result) {
    return (
      <AssistedDoneStep
        result={result}
        onRegisterAnother={() => {
          setResult(null);
          setError(null);
          setFieldErrors({});
          setFormKey((key) => key + 1);
          setStep("form");
        }}
      />
    );
  }

  return (
    <WizardShell title="Registro asistido" onClose={handleClose}>
      <AssistedFormStep
        key={formKey}
        categories={categories}
        categoriesLoading={categoriesLoading}
        submitting={submitting}
        error={error}
        fieldErrors={fieldErrors}
        onSubmit={handleSubmit}
      />
    </WizardShell>
  );
}
