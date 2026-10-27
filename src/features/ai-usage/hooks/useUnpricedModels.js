import { useQuery } from "@tanstack/react-query";
import * as usage from "../api.js";

export const UNPRICED_MODELS_KEY = ["ai-usage", "unpriced-models"];

/** Modelos com uso e sem preço de saída (todo o uso registrado). Sem retry automático: a
 * tela tem o botão "Tentar de novo". */
export function useUnpricedModels() {
  return useQuery({
    queryKey: UNPRICED_MODELS_KEY,
    queryFn: usage.getUnpricedModels,
    staleTime: 0,
    retry: false,
  });
}
