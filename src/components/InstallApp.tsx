import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Evento do Chrome/Android para instalar a app (não existe no iPhone). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  // Guardado logo ao carregar: o evento pode chegar antes de o aviso aparecer.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

const DISMISS_KEY = "erasmus-pisa:install-dismissed";

function useInstallState() {
  const [, force] = useState(0);
  const [env, setEnv] = useState<{ installed: boolean; ios: boolean; safari: boolean } | null>(null);

  useEffect(() => {
    const update = () => force((n) => n + 1);
    listeners.add(update);
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    setEnv({
      installed:
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
      ios,
      safari: ios && !/CriOS|FxiOS|EdgiOS/.test(ua),
    });
    return () => {
      listeners.delete(update);
    };
  }, []);

  return { env, canPrompt: !!deferred };
}

async function promptInstall() {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice.catch(() => undefined);
  deferred = null;
  listeners.forEach((l) => l());
}

/** Explicação de como instalar, conforme o telemóvel. */
function Steps({ ios, safari, canPrompt }: { ios: boolean; safari: boolean; canPrompt: boolean }) {
  if (canPrompt)
    return (
      <Button size="sm" onClick={() => void promptInstall()}>
        <Download /> Instalar app
      </Button>
    );
  if (ios)
    return safari ? (
      <p className="text-xs text-muted-foreground">
        No Safari, toca em <Share className="inline size-3.5 -translate-y-px" /> <b className="text-foreground">Partilhar</b> e
        depois em <SquarePlus className="inline size-3.5 -translate-y-px" />{" "}
        <b className="text-foreground">Adicionar ao ecrã principal</b>.
      </p>
    ) : (
      <p className="text-xs text-muted-foreground">
        Abre este site no <b className="text-foreground">Safari</b> e usa Partilhar → Adicionar ao ecrã principal.
      </p>
    );
  return (
    <p className="text-xs text-muted-foreground">
      No Chrome, abre o menu <b className="text-foreground">⋮</b> e escolhe{" "}
      <b className="text-foreground">Instalar app</b> (ou “Adicionar ao ecrã principal”).
    </p>
  );
}

/** Aviso no Painel (só no telemóvel, só se ainda não estiver instalada; pode fechar-se). */
export function InstallBanner({ className }: { className?: string }) {
  const { env, canPrompt } = useInstallState();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!env || env.installed || dismissed) return null;
  const mobile = env.ios || /Android/.test(navigator.userAgent);
  if (!mobile && !canPrompt) return null;

  return (
    <div className={cn("card-soft fade-up flex items-start gap-3 p-4", className)}>
      <img src="/icon-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-semibold">Instala a app no telemóvel</p>
        <p className="text-xs text-muted-foreground">Fica com ícone no ecrã principal, abre em ecrã inteiro e mais depressa.</p>
        <Steps ios={env.ios} safari={env.safari} canPrompt={canPrompt} />
      </div>
      <button
        type="button"
        aria-label="Fechar"
        className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-accent"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            /* ignore */
          }
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Secção nas Definições (sempre disponível, mesmo depois de fechar o aviso). */
export function InstallSection() {
  const { env, canPrompt } = useInstallState();
  if (!env) return null;
  return (
    <div className="card-soft flex items-start gap-3 p-5">
      <img src="/icon-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        {env.installed ? (
          <p className="text-sm">A app já está instalada neste dispositivo. 🎉</p>
        ) : (
          <>
            <p className="text-sm">Ícone no ecrã principal, ecrã inteiro e abre mais depressa.</p>
            <Steps ios={env.ios} safari={env.safari} canPrompt={canPrompt} />
          </>
        )}
      </div>
    </div>
  );
}
