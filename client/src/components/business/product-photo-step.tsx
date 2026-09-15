"use client";

import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { PhotoUploadControl } from "@/components/business/photo-upload-control";
import { uploadProductPhoto, deletePhoto, type UploadedPhoto } from "@/lib/api/photos";
import { getPhotoUploadErrorMessage, getPhotoDeleteErrorMessage } from "@/lib/api/error-messages";

interface ProductPhotoStepProps {
  productId: string;
  productName: string;
  currentPhoto: UploadedPhoto | null;
  onPhotoChange: (photo: UploadedPhoto | null) => void;
  onDone: () => void;
}

/**
 * Segundo paso del modal de "Agregar {ítem}" — corrige un hueco real
 * encontrado por el usuario: antes, `ProductForm` se cerraba apenas se
 * creaba el producto, y había que volver a entrar al producto ya creado
 * (expandir su fila) para que apareciera `PhotoUploadControl` y recién
 * ahí poder agregarle una foto. Ahora, tras un `POST` exitoso en modo
 * "crear", el mismo modal cambia de contenido (este componente, en vez
 * de cerrarse) para ofrecer la foto de una sola vez, sin un segundo
 * viaje al catálogo.
 *
 * Sin botón de cerrar/X a propósito, a diferencia de `ProductForm`: acá
 * no hay nada que "cancelar" — el producto ya se creó de verdad en el
 * backend en el momento en que se llega a este paso, así que la única
 * salida es "Listo"/"Continuar sin foto" (mismo botón, el texto cambia
 * solo según si ya hay una foto subida).
 *
 * Solo se usa en el modo "crear" — al editar, `PhotoUploadControl` ya
 * aparece dentro de la fila expandida del producto (ver
 * `product-row.tsx`), no hace falta este paso extra ahí.
 */
export function ProductPhotoStep({
  productId,
  productName,
  currentPhoto,
  onPhotoChange,
  onDone,
}: ProductPhotoStepProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-photo-step-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
    >
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-t-card bg-surface p-6 shadow-xl sm:rounded-card">
        <div className="flex items-center gap-2">
          <CheckCircle size={24} weight="fill" className="text-verde" />
          <h2 id="product-photo-step-title" className="font-heading text-title-1 font-bold text-text">
            &quot;{productName}&quot; se agregó
          </h2>
        </div>
        <p className="font-sans text-body-sm text-text-muted">
          ¿Quieres agregarle una foto ahora? Puedes hacerlo después desde el catálogo si prefieres.
        </p>

        <PhotoUploadControl
          id={`product-photo-create-${productId}`}
          label="Foto"
          currentPhoto={currentPhoto}
          uploadPhoto={(file) => uploadProductPhoto(productId, file)}
          deletePhoto={deletePhoto}
          onPhotoChange={onPhotoChange}
          uploadErrorMessage={getPhotoUploadErrorMessage}
          deleteErrorMessage={getPhotoDeleteErrorMessage}
        />

        <Button type="button" onClick={onDone} className="w-full">
          {currentPhoto ? "Listo" : "Continuar sin foto"}
        </Button>
      </div>
    </div>
  );
}
