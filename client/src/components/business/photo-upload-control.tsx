"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageSquare, Trash, X } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { validatePhotoFile } from "@/lib/photos/photo-constraints";
import type { UploadedPhoto } from "@/lib/api/photos";

interface PhotoUploadControlProps {
  id: string;
  label: string;
  currentPhoto: UploadedPhoto | null;
  uploadPhoto: (file: File) => Promise<{ ok: boolean; photo: UploadedPhoto | null; status: number | undefined }>;
  deletePhoto: (photoId: string) => Promise<{ ok: boolean; status: number | undefined }>;
  onPhotoChange: (photo: UploadedPhoto | null) => void;
  uploadErrorMessage: (status: number | undefined) => string;
  deleteErrorMessage: (status: number | undefined) => string;
}

/**
 * Control de carga de fotos, sin épica de frontend asignada hasta ahora
 * (petición directa del usuario) — reusado tal cual para la foto
 * principal del negocio (business-profile-screen.tsx) y la foto de cada
 * producto/servicio del catálogo (product-row.tsx), pasando las
 * funciones reales de subida/borrado como props (ver
 * client/src/lib/api/photos.ts) en vez de que este componente sepa
 * distinguir "negocio" de "producto" — la lógica de reemplazo es
 * idéntica para los dos.
 *
 * **Reemplazo, no acumulación**: si ya había una foto (real o la de
 * relleno de picsum.photos que deja el seed de demo, CLAUDE.md sección
 * 25/26 — desde acá son indistinguibles y se tratan igual a propósito),
 * subir una nueva la reemplaza — nunca se acumulan fotos sin criterio.
 * Orden de las dos llamadas, deliberado: primero se sube la nueva foto,
 * y solo si eso tuvo éxito se borra la anterior — igual que el criterio
 * ya documentado en CLAUDE.md para el borrado de fotos en el backend
 * ("el peor caso es un objeto huérfano, nunca us negocio que se queda
 * sin ninguna foto"). El borrado de la foto anterior es best-effort: si
 * falla, no se revierte la nueva ni se bloquea al vendedor — el negocio
 * puede terminar con dos fotos hasta que se reintente a mano, pero
 * nunca sin ninguna. `business-profile-screen.tsx`/`product-row.tsx`
 * ya muestran la foto de MAYOR `displayOrder` (la más reciente), no la
 * primera — así, aunque el borrado de la vieja falle, la que se ve en
 * el perfil sigue siendo la nueva.
 */
export function PhotoUploadControl({
  id,
  label,
  currentPhoto,
  uploadPhoto,
  deletePhoto,
  onPhotoChange,
  uploadErrorMessage,
  deleteErrorMessage,
}: PhotoUploadControlProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoca el object URL de la vista previa al desmontar o al cambiar de
  // archivo — sin esto, cada selección deja un blob vivo en memoria.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite volver a elegir el mismo archivo después de cancelar
    if (!file) return;

    const validationError = validatePhotoFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleCancelSelection() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
  }

  async function handleConfirmUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);

    const previous = currentPhoto;
    const result = await uploadPhoto(selectedFile);

    if (!result.ok || !result.photo) {
      setUploading(false);
      setError(uploadErrorMessage(result.status));
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploading(false);
    onPhotoChange(result.photo);

    // Reemplazo: la anterior (real o de relleno) se borra después de
    // confirmar que la nueva ya quedó — best-effort, sin bloquear ni
    // revertir nada si falla (ver el comentario de cabecera).
    if (previous) {
      await deletePhoto(previous.id);
    }
  }

  async function handleDeleteCurrent() {
    if (!currentPhoto) return;
    setDeleting(true);
    setError(null);

    const result = await deletePhoto(currentPhoto.id);

    setDeleting(false);
    if (!result.ok) {
      setError(deleteErrorMessage(result.status));
      return;
    }
    onPhotoChange(null);
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <Camera size={20} weight="duotone" className="text-terracota" />
        <p className="font-sans text-body font-medium text-text">{label}</p>
      </div>

      {previewUrl ? (
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (object URL), no una foto remota */}
          <img src={previewUrl} alt="Vista previa" className="h-40 w-full rounded-input object-cover" />
          <div className="flex gap-2">
            <Button type="button" onClick={handleConfirmUpload} loading={uploading} className="flex-1">
              Subir foto
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancelSelection}
              disabled={uploading}
              className="flex-1"
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : currentPhoto ? (
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto remota, sin dominio de next/image configurado todavía (mismo criterio que el resto del perfil) */}
          <img src={currentPhoto.url} alt={label} className="h-40 w-full rounded-input object-cover" />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} className="flex-1">
              Cambiar foto
            </Button>
            <button
              type="button"
              onClick={handleDeleteCurrent}
              disabled={deleting}
              aria-label={`Eliminar ${label.toLowerCase()}`}
              className="flex h-btn w-12 shrink-0 items-center justify-center rounded-input border border-border text-rojo transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash size={18} weight="bold" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-32 w-full flex-col items-center justify-center gap-1 rounded-input border border-dashed border-border text-text-muted transition-colors hover:bg-background"
        >
          <ImageSquare size={28} weight="duotone" />
          <span className="font-sans text-body-sm">Agregar foto</span>
        </button>
      )}

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="sr-only"
      />

      {error && (
        <p className="flex items-center gap-1 font-sans text-body-sm text-rojo">
          <X size={14} weight="bold" />
          {error}
        </p>
      )}

      <p className="font-sans text-caption text-text-muted">
        Al subir una foto nueva, reemplaza automáticamente la anterior — incluida la foto de muestra, si
        todavía no habías subido una propia. JPEG, PNG o WEBP, hasta 8 MB.
      </p>
    </div>
  );
}
