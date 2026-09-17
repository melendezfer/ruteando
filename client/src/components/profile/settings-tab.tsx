"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Bell, CheckCircle, LockKey, UserCircle, Warning } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { Skeleton } from "@/components/discovery/skeleton";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { AccountDeletionRequestModal } from "@/components/profile/account-deletion-request-modal";
import { grantNotificationsConsent } from "@/lib/api/consents";
import { changePassword } from "@/lib/api/change-password";
import { updateProfile } from "@/lib/api/update-profile";
import {
  getGrantNotificationsConsentErrorMessage,
  getChangePasswordErrorMessage,
  getUpdateProfileErrorMessage,
} from "@/lib/api/error-messages";
import { useAuth } from "@/lib/auth/auth-context";

type User = components["schemas"]["User"];
type Consent = components["schemas"]["Consent"];
type AccountDeletionRequest = components["schemas"]["AccountDeletionRequest"];

const ROLE_LABELS: Record<NonNullable<User["role"]>, string> = {
  consumer: "Consumidor",
  vendor: "Vendedor",
  administrator: "Administrador",
};

// Los cuatro valores de tipo_consentimiento (CLAUDE.md sección 5) —
// data_processing/terms_conditions son los obligatorios que login()
// exige (ver ConsentRequiredModal); assisted_registration y
// notifications son casos de uso puntuales (registro asistido, Épica
// F5; confirmación de disponibilidad, sección 11) que un usuario
// concreto puede no tener nunca.
const CONSENT_LABELS: Record<NonNullable<Consent["type"]>, string> = {
  data_processing: "Tratamiento de datos personales",
  terms_conditions: "Términos y condiciones",
  assisted_registration: "Registro asistido",
  notifications: "Notificaciones",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" });

interface SettingsTabProps {
  user: User;
}

/**
 * Datos básicos de la cuenta (nombre/celular editables vía
 * PATCH /users/me, sin RF asociado — ver CLAUDE.md; correo/rol siguen
 * siendo de solo lectura, sin endpoint para cambiarlos) + estado de los
 * consentimientos ya otorgados (GET /users/me/consents, Épica 8) — esa
 * parte sigue de solo lectura: el PR #22 ya resolvió el flujo de
 * OTORGARLOS (registro + ConsentRequiredModal en login), acá solo se
 * muestra el resultado, sin repetir ese modal bloqueante ni ofrecer
 * revocarlos (append-only por diseño, sin endpoint de revocación —
 * CLAUDE.md, Épica 6/8).
 */
export function SettingsTab({ user }: SettingsTabProps) {
  const { applyNewTokens, updateUser } = useAuth();
  const [consents, setConsents] = useState<Consent[] | null>(null);
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  // Estado puramente local, no se vuelve a pedir al servidor al recargar
  // la pantalla — no existe (a propósito, no se pidió) un
  // GET "¿ya tengo una solicitud activa?"; POST
  // /users/me/account-deletion-request es idempotente en el backend, así
  // que volver a tocar el botón después de recargar la página no crea
  // una segunda solicitud, solo pierde esta confirmación en pantalla.
  const [deletionRequest, setDeletionRequest] = useState<AccountDeletionRequest | null>(null);

  // PATCH /users/me (sin RF asociado — ver CLAUDE.md): edición de
  // nombre/celular. Estado local inicializado desde `user` — igual que
  // el resto de esta pantalla (ver comentario del componente), sin
  // ningún GET propio: los datos ya llegan por props.
  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  // Fase 4 de "vendiendo ahora" (sin RF asociado — ver CLAUDE.md sección
  // 11/37): a diferencia del resto de esta pantalla (de solo lectura),
  // 'notifications' es el único consentimiento que hoy tiene una acción
  // real para otorgar desde acá — es lo que le faltaba a un vendedor
  // real para que un consumidor pueda preguntarle "¿sigue vendiendo?"
  // (solicitar(), backend, ya lo exigía desde la sección 11).
  const [grantingNotifications, setGrantingNotifications] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  // Cambiar contraseña estando logueado (sin RF asociado — ver
  // CLAUDE.md sección 39/40): distinto del flujo de recuperación por
  // correo (ese vive en /recuperar-contrasena, para cuando no se puede
  // iniciar sesión). Estado puramente local del formulario — sin nada
  // que precargar desde el servidor.
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordChanged, setPasswordChanged] = useState(false);

  useEffect(() => {
    let ignore = false;
    api.GET("/users/me/consents").then(({ data }) => {
      if (!ignore) setConsents(data ?? []);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const hasNotificationsConsent = consents?.some((c) => c.type === "notifications") ?? false;

  async function handleGrantNotifications() {
    setGrantingNotifications(true);
    setNotificationsError(null);
    const result = await grantNotificationsConsent();
    setGrantingNotifications(false);

    if (!result.ok || !result.consent) {
      setNotificationsError(getGrantNotificationsConsentErrorMessage(result.status));
      return;
    }

    setConsents((prev) => [...(prev ?? []), result.consent!]);
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileSaved(false);

    const trimmedName = fullName.trim();
    if (trimmedName.length === 0) {
      setProfileError("El nombre no puede quedar vacío.");
      return;
    }

    setSavingProfile(true);
    const result = await updateProfile({ fullName: trimmedName, phone: phone.trim() });
    setSavingProfile(false);

    if (!result.ok || !result.user) {
      setProfileError(getUpdateProfileErrorMessage(result.status));
      return;
    }

    updateUser(result.user);
    setFullName(result.user.fullName ?? "");
    setPhone(result.user.phone ?? "");
    setProfileSaved(true);
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError("La contraseña nueva debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Las dos contraseñas nuevas no coinciden.");
      return;
    }

    setChangingPassword(true);
    const result = await changePassword(currentPassword, newPassword);
    setChangingPassword(false);

    if (!result.ok || !result.tokens) {
      setPasswordError(getChangePasswordErrorMessage(result.status));
      return;
    }

    // Cambiar la contraseña revoca todas las sesiones (backend) —
    // aplicar el par nuevo acá evita que esta misma pestaña quede
    // "sesión cerrada" justo después de la acción que la cerró.
    await applyNewTokens(result.tokens);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordChanged(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-4">
        <h2 className="flex items-center gap-2 font-heading text-title-2 font-semibold text-text">
          <UserCircle size={20} weight="bold" className="text-terracota" />
          Tu cuenta
        </h2>

        {profileSaved && (
          <p className="flex items-center gap-2 font-sans text-body-sm text-verde">
            <CheckCircle size={16} weight="fill" />
            Tus datos se actualizaron correctamente.
          </p>
        )}

        <form onSubmit={handleSaveProfile} className="flex flex-col gap-3" noValidate>
          <TextField
            label="Nombre"
            autoComplete="name"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
          <TextField
            label="Celular"
            type="tel"
            autoComplete="tel"
            maxLength={20}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />

          {profileError && <p className="font-sans text-body-sm text-rojo">{profileError}</p>}

          <Button type="submit" variant="secondary" loading={savingProfile}>
            Guardar cambios
          </Button>
        </form>

        <dl className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-3">
            <dt className="font-sans text-body-sm text-text-muted">Correo</dt>
            <dd className="font-sans text-body text-text">{user.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="font-sans text-body-sm text-text-muted">Tipo de cuenta</dt>
            <dd className="font-sans text-body text-text">
              {user.role ? (ROLE_LABELS[user.role] ?? user.role) : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-4">
        <h2 className="flex items-center gap-2 font-heading text-title-2 font-semibold text-text">
          <LockKey size={20} weight="bold" className="text-terracota" />
          Contraseña
        </h2>

        {passwordChanged && (
          <p className="flex items-center gap-2 font-sans text-body-sm text-verde">
            <CheckCircle size={16} weight="fill" />
            Tu contraseña se actualizó correctamente.
          </p>
        )}

        <form onSubmit={handleChangePassword} className="flex flex-col gap-3" noValidate>
          <TextField
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <TextField
            label="Contraseña nueva"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <TextField
            label="Repite la contraseña nueva"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />

          {passwordError && <p className="font-sans text-body-sm text-rojo">{passwordError}</p>}

          <Button type="submit" variant="secondary" loading={changingPassword}>
            Cambiar contraseña
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-4">
        <h2 className="font-heading text-title-2 font-semibold text-text">Consentimientos otorgados</h2>

        {consents === null && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        )}

        {consents !== null && consents.length === 0 && (
          <p className="font-sans text-body-sm text-text-muted">
            Todavía no tienes ningún consentimiento registrado.
          </p>
        )}

        {consents !== null && consents.length > 0 && (
          <ul className="flex flex-col gap-2">
            {consents.map((consent) => (
              <li key={consent.id} className="flex items-start gap-2">
                <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-verde" />
                <div className="flex flex-col">
                  <span className="font-sans text-body text-text">
                    {consent.type ? (CONSENT_LABELS[consent.type] ?? consent.type) : "Consentimiento"}
                  </span>
                  {consent.grantedAt && (
                    <span className="font-sans text-caption text-text-muted">
                      Otorgado el {DATE_FORMATTER.format(new Date(consent.grantedAt))}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {consents !== null && !hasNotificationsConsent && (
        <section className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-4">
          <h2 className="flex items-center gap-2 font-heading text-title-2 font-semibold text-text">
            <Bell size={20} weight="bold" className="text-terracota" />
            Preguntas de disponibilidad
          </h2>
          <p className="font-sans text-body-sm text-text-muted">
            Si tienes un negocio, activa esto para que tus clientes puedan preguntarte
            &quot;¿sigue vendiendo?&quot; desde tu perfil — te llegará un aviso y podrás confirmar o
            declinar desde ahí. Requiere aceptar recibir notificaciones (Ley 1581 de 2012).
          </p>
          {notificationsError && (
            <p className="font-sans text-body-sm text-rojo">{notificationsError}</p>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={handleGrantNotifications}
            loading={grantingNotifications}
            className="w-full justify-center gap-2"
          >
            <Bell size={18} weight="bold" />
            Activar notificaciones
          </Button>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-card border border-rojo/30 bg-rojo/5 px-4 py-4">
        <h2 className="font-heading text-title-2 font-semibold text-text">Eliminar cuenta</h2>

        {deletionRequest ? (
          <div className="flex items-start gap-2">
            <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-verde" />
            <p className="font-sans text-body-sm text-text">
              Solicitud recibida el{" "}
              {deletionRequest.createdAt && DATE_FORMATTER.format(new Date(deletionRequest.createdAt))}.
              Tu cuenta y tus datos se procesarán conforme a la Ley 1581 de 2012 dentro de los próximos
              días hábiles.
            </p>
          </div>
        ) : (
          <>
            <p className="font-sans text-body-sm text-text-muted">
              Tu cuenta no se elimina al instante: queda registrada una solicitud para que el equipo de
              Ruteando la procese dentro de los próximos días hábiles, conforme a la Ley 1581 de 2012.
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowDeletionModal(true)}
              className="w-full justify-center gap-2 border-rojo text-rojo hover:bg-rojo/10"
            >
              <Warning size={18} weight="bold" />
              Solicitar eliminación de mi cuenta y mis datos
            </Button>
          </>
        )}
      </section>

      {showDeletionModal && (
        <AccountDeletionRequestModal
          onCancel={() => setShowDeletionModal(false)}
          onSubmitted={(request) => {
            setDeletionRequest(request);
            setShowDeletionModal(false);
          }}
        />
      )}
    </div>
  );
}
