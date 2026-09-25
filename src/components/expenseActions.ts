import { toast } from "sonner";
import { useConfirm } from "@/components/Confirm";
import { useData, useStore } from "@/data/store";
import type { Expense } from "@/data/types";

/**
 * Apagar uma despesa, com a mesma confirmação em todo o lado:
 * - já acertada (contas fechadas): sai do histórico, os saldos não mudam;
 * - por acertar, com acertos já registados: avisa que as contas de toda a gente mudam.
 */
export function useRemoveExpense() {
  const { settlements } = useData();
  const { removeExpense, removeClosedExpense } = useStore();
  const confirm = useConfirm();

  return async (e: Expense) => {
    if (e.closedAt) {
      const ok = await confirm({
        title: `Apagar de vez "${e.description}"?`,
        description: "Já estava acertada, por isso os saldos não mudam.",
        confirmLabel: "Apagar",
        destructive: true,
      });
      if (!ok) return;
      removeClosedExpense(e.id);
      toast.success("Despesa apagada.");
      return;
    }
    const hasOpenSettlements = settlements.some((s) => !s.closedAt);
    const ok = await confirm({
      title: `Apagar "${e.description}"?`,
      ...(hasOpenSettlements
        ? {
            description:
              "Já há acertos registados. Se esta despesa já foi paga, não a apagues: quando toda a gente ficar quite, ela passa sozinha para “Contas fechadas”. Apagá-la agora muda as contas de toda a gente.",
          }
        : {}),
      confirmLabel: "Apagar",
      destructive: true,
    });
    if (!ok) return;
    removeExpense(e.id);
    toast.success("Despesa apagada.");
  };
}
