/* Hooks React Query da feature projects. */

import { useQuery } from "@tanstack/react-query";
import { getProjects } from "./api.js";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects().then((data) => (Array.isArray(data) ? data : [])),
  });
}
