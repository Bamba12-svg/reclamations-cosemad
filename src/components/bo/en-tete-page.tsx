import type { ReactNode } from "react";
import { Icone } from "@/components/icone";

/** Titre de page du back-office (h1 + sous-titre), comme dans la maquette. */
export function EnTetePage({ titre, sousTitre, actions }: { titre: string; sousTitre?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] leading-tight font-bold tracking-[-0.02em]">{titre}</h1>
        {sousTitre && <p className="m-0 text-encre-3">{sousTitre}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Emplacement d'un écran livré à une étape suivante. */
export function EcranAVenir({ etape, contenu }: { etape: number; contenu: string }) {
  return (
    <div className="flex items-start gap-4 rounded-carte border border-dashed border-bord-fort bg-surface p-6">
      <span className="grid size-10 flex-none place-items-center rounded-champ bg-marque-pale text-marque">
        <Icone nom="chantier" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="m-0 font-semibold">Écran livré à l&apos;étape {etape}</p>
        <p className="m-0 text-encre-3">{contenu}</p>
      </div>
    </div>
  );
}

/** Page interdite pour le rôle de l'utilisateur. */
export function AccesReserve({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-4 rounded-carte border border-retard-bord bg-retard-fond p-6 text-retard">
      <Icone nom="cadenas" className="mt-0.5 flex-none" />
      <div className="flex flex-col gap-1">
        <p className="m-0 font-semibold">Accès réservé</p>
        <p className="m-0">{message}</p>
      </div>
    </div>
  );
}
